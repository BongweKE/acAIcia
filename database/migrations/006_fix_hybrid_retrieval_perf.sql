-- ============================================================================
-- Migration: 006_fix_hybrid_retrieval_perf.sql
-- Description: Fix `match_documents_hybrid` statement-timeout failures by adding
--   the indexes the RPC needs for both its dense (vector) and sparse
--   (full-text) branches, then pinning a sane per-function statement_timeout.
--
--   Symptom this fixes: POST /rest/v1/rpc/match_documents_hybrid returns
--   HTTP 500 `{"code":"57014","message":"canceling statement due to statement
--   timeout"}` so the backend silently falls back to vector-only retrieval.
--
-- Run this in the Supabase SQL Editor (project ihglhsqegpfkeajrbmgn) or via
-- `psql "$DATABASE_URL" -f 006_fix_hybrid_retrieval_perf.sql`.
-- Safe to run more than once (all statements are idempotent).
-- ============================================================================

-- A. Dense branch: HNSW index for `embedding <=> query_embedding` kNN search.
CREATE INDEX IF NOT EXISTS document_embeddings_hnsw
  ON document_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- B. Sparse branch: GIN index on the exact tsvector expression the RPC filters on.
--    The expression must match the function body verbatim for the planner to use it.
CREATE INDEX IF NOT EXISTS document_embeddings_fts
  ON document_embeddings
  USING gin (to_tsvector('english', chunk_text));

-- C. Refresh planner statistics so the new indexes are chosen immediately.
ANALYZE document_embeddings;

-- D. Recreate the RPC (unchanged logic) and pin a per-function statement timeout
--    as a safety net if the planner still picks a sequential scan on cold data.
CREATE OR REPLACE FUNCTION match_documents_hybrid (
  query_text text,
  query_embedding vector(768),
  match_count int default 5,
  rrf_k int default 60
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  title text,
  authors text[],
  publication_year integer,
  url_link text,
  doi text,
  rrf_score float
)
LANGUAGE sql STABLE
SET statement_timeout = '25s'
AS $$
  WITH vector_matches AS (
    SELECT e.id, row_number() OVER (ORDER BY e.embedding <=> query_embedding) AS rank
    FROM document_embeddings e
    ORDER BY e.embedding <=> query_embedding
    LIMIT 20
  ),
  text_matches AS (
    SELECT e.id,
           row_number() OVER (
             ORDER BY ts_rank(to_tsvector('english', e.chunk_text),
                              websearch_to_tsquery('english', query_text)) DESC
           ) AS rank
    FROM document_embeddings e
    WHERE to_tsvector('english', e.chunk_text) @@ websearch_to_tsquery('english', query_text)
    LIMIT 20
  ),
  combined AS (
    SELECT
      COALESCE(v.id, t.id) AS chunk_id,
      COALESCE(1.0 / (rrf_k + v.rank), 0.0) + COALESCE(1.0 / (rrf_k + t.rank), 0.0) AS rrf_score
    FROM vector_matches v
    FULL OUTER JOIN text_matches t ON v.id = t.id
  )
  SELECT
    e.id,
    e.document_id,
    e.chunk_text,
    c.title,
    c.authors,
    c.publication_year,
    c.url_link,
    c.doi,
    cb.rrf_score
  FROM combined cb
  JOIN document_embeddings e ON cb.chunk_id = e.id
  JOIN documents_catalog c ON e.document_id = c.id
  ORDER BY cb.rrf_score DESC
  LIMIT match_count;
$$;
