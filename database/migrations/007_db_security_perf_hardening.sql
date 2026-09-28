-- ============================================================================
-- Migration: 007_db_security_perf_hardening.sql
-- Description: Addresses Supabase security + performance advisors WITHOUT
--   changing application behaviour:
--     * make `popular_documents` an invoker view (was SECURITY DEFINER)
--     * pin `search_path` on the RPC/helper functions
--     * add covering indexes for unindexed foreign keys
--     * drop the duplicate HNSW index on document_embeddings
--
-- Applied to project ihglhsqegpfkeajrbmgn on 2026-09-28. Idempotent.
-- ============================================================================

-- A. popular_documents was a SECURITY DEFINER view (bypasses the RLS of the
--    querying role). Make it an invoker view so it honours the caller's RLS.
ALTER VIEW public.popular_documents SET (security_invoker = true);

-- B. Pin search_path on the flagged functions (they are SECURITY INVOKER;
--    this removes the mutable-search-path warning).
ALTER FUNCTION public.match_documents(vector, double precision, integer) SET search_path = public;
ALTER FUNCTION public.match_semantic_cache(vector, double precision) SET search_path = public;
ALTER FUNCTION public.match_documents_hybrid(text, vector, integer, integer) SET search_path = public;
ALTER FUNCTION public.get_analytics_timeseries(date, date, text, text, text) SET search_path = public;
ALTER FUNCTION public.get_user_cost_breakdown(date, date, integer) SET search_path = public;
ALTER FUNCTION public.get_hourly_heatmap(date, date) SET search_path = public;

-- C. Covering indexes for foreign keys (advisor: unindexed_foreign_keys).
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON public.conversation_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id ON public.document_embeddings (document_id);
CREATE INDEX IF NOT EXISTS idx_production_eval_scores_feedback_id ON public.production_eval_scores (feedback_id);
CREATE INDEX IF NOT EXISTS idx_query_chunk_logs_chunk_id ON public.query_chunk_logs (chunk_id);
CREATE INDEX IF NOT EXISTS idx_query_chunk_logs_log_id ON public.query_chunk_logs (log_id);
CREATE INDEX IF NOT EXISTS idx_query_feedback_log_id ON public.query_feedback (log_id);

-- D. Drop the duplicate HNSW index only when the pre-existing identical index
--    is present (keeps at least one vector index on fresh installs too).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'document_embeddings_embedding_idx' AND relkind = 'i')
     AND EXISTS (SELECT 1 FROM pg_class WHERE relname = 'document_embeddings_hnsw' AND relkind = 'i') THEN
    DROP INDEX public.document_embeddings_hnsw;
  END IF;
END $$;
