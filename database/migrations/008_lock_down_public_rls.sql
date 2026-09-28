-- ============================================================================
-- Migration: 008_lock_down_public_rls.sql
-- Description: Enables Row Level Security on the four core tables that had it
--   disabled. NO policies are intentionally added — access is deny-by-default
--   for the `anon` and `authenticated` roles.
--
--   SAFE for acAIcia because the backend connects with the `service_role` key,
--   which BYPASSES RLS, and the frontend never talks to Supabase directly.
--
-- Applied to project ihglhsqegpfkeajrbmgn on 2026-09-28. Idempotent.
--
-- Rollback: ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;  (see ADR 0010)
-- ============================================================================

ALTER TABLE public.documents_catalog      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_embeddings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_interaction_logs ENABLE ROW LEVEL SECURITY;
