-- ============================================================================
-- Migration: 009_shared_query_status.sql
-- Description: Multi-replica shared query status store for Railway scaling.
--              Enables horizontal scaling without polling 404s.
--              Deny-by-default RLS posture enforced per ADR 0010.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.query_jobs (
    query_id UUID PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'processing',
    stage TEXT DEFAULT 'Initializing',
    original_query TEXT,
    response TEXT,
    sources JSONB DEFAULT '[]'::jsonb,
    error TEXT,
    cache_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deny-by-default RLS posture (service_role backend bypasses RLS)
ALTER TABLE public.query_jobs ENABLE ROW LEVEL SECURITY;

-- Index for lookup and TTL cleanup
CREATE INDEX IF NOT EXISTS idx_query_jobs_status_created ON public.query_jobs (status, created_at DESC);
