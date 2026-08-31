-- ============================================================================
-- Migration: 004_fix_semantic_cache_topic_guard.sql
-- Description: Add topic_category column to semantic_cache for domain-bounded
--              cache lookups, purge legacy corrupt cache entries, and enforce
--              raw-query embedding matching with threshold 0.98.
-- ============================================================================

-- Add topic_category column to semantic_cache
ALTER TABLE semantic_cache ADD COLUMN IF NOT EXISTS topic_category text DEFAULT 'general';

-- Purge existing rows to ensure all cache entries have exact raw user query embeddings and topic tags
DELETE FROM semantic_cache;

-- Create index on topic_category for faster filtered cache lookups
CREATE INDEX IF NOT EXISTS idx_semantic_cache_topic ON semantic_cache (topic_category);
