-- ============================================================================
-- Migration: 002_fix_semantic_cache.sql
-- Description: Add stored_embedding_text column to semantic_cache for reliable
--              Python-side cosine similarity lookups, bypassing pgvector
--              string serialization issues with PostgREST.
-- ============================================================================

-- Add the new text column for storing embeddings as comma-separated floats
ALTER TABLE semantic_cache ADD COLUMN IF NOT EXISTS stored_embedding_text text;

-- Purge all existing rows - they have corrupted/invalid query_embedding entries
-- that would cause false-positive cache hits (similarity always = 1.0)
DELETE FROM semantic_cache;

-- Recreate the match_semantic_cache RPC for backwards compatibility
-- (This is now only used for reference; Python-side cosine similarity is primary)
CREATE OR REPLACE FUNCTION match_semantic_cache (
  query_embedding vector(768),
  match_threshold float default 0.97
)
RETURNS TABLE (
  cache_id uuid,
  query_text text,
  response_text text,
  sources jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.cache_id,
    c.query_text,
    c.response_text,
    c.sources,
    1 - (c.query_embedding <=> query_embedding) AS similarity
  FROM semantic_cache c
  WHERE 1 - (c.query_embedding <=> query_embedding) >= match_threshold
    AND c.stored_embedding_text IS NOT NULL  -- only consider properly migrated rows
  ORDER BY c.query_embedding <=> query_embedding
  LIMIT 1;
$$;
