-- ============================================================================
-- Migration: 010_native_pgvector_semantic_cache.sql
-- Description: Native pgvector HNSW index and topic-bounded RPC for semantic cache.
--              Eliminates Python-side memory scans and scales to 100k+ entries.
-- ============================================================================

-- Ensure HNSW index exists on query_embedding
CREATE INDEX IF NOT EXISTS idx_semantic_cache_query_embedding_hnsw
  ON public.semantic_cache USING hnsw (query_embedding vector_cosine_ops);

-- Ensure index exists on topic_category
CREATE INDEX IF NOT EXISTS idx_semantic_cache_topic_category
  ON public.semantic_cache (topic_category);

-- RPC for native pgvector similarity matching with topic guard
DROP FUNCTION IF EXISTS public.match_semantic_cache_pgvector;

CREATE OR REPLACE FUNCTION public.match_semantic_cache_pgvector (
  p_query_embedding vector(768),
  p_match_threshold float default 0.95,
  p_filter_topic text default null
)
RETURNS TABLE (
  cache_id uuid,
  query_text text,
  response_text text,
  sources jsonb,
  topic_category text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    c.cache_id,
    c.query_text,
    c.response_text,
    c.sources,
    c.topic_category,
    1 - (c.query_embedding <=> p_query_embedding) AS similarity
  FROM semantic_cache c
  WHERE c.query_embedding IS NOT NULL
    AND 1 - (c.query_embedding <=> p_query_embedding) >= p_match_threshold
    AND (p_filter_topic IS NULL OR c.topic_category = p_filter_topic)
  ORDER BY c.query_embedding <=> p_query_embedding ASC
  LIMIT 1;
$$;
