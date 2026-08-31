-- ============================================================================
-- Migration: 003_advanced_analytics.sql
-- Description: Advanced Admin Analytics & Observability Platform.
--   Adds topic classification, per-query cost attribution, user-level analytics,
--   time-of-day heatmap, RAGAS production sampling, system alerts, and
--   pre-aggregated daily/user summary tables for scalable charting.
-- Run this in the Supabase SQL Editor.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- A. Extend query_interaction_logs with analytics columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE query_interaction_logs
  ADD COLUMN IF NOT EXISTS topic_category       TEXT,
  ADD COLUMN IF NOT EXISTS query_type           TEXT,        -- 'database_match' | 'general_fallback' | 'cache_hit'
  ADD COLUMN IF NOT EXISTS provider_used        TEXT,        -- 'gemini' | 'nvidia' | 'deepseek' | 'modal'
  ADD COLUMN IF NOT EXISTS estimated_cost_usd   FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS input_tokens         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guest_session_id     TEXT;        -- anonymous UUID for guest users

-- Index for efficient analytics queries
CREATE INDEX IF NOT EXISTS idx_qil_timestamp ON query_interaction_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_qil_topic     ON query_interaction_logs (topic_category);
CREATE INDEX IF NOT EXISTS idx_qil_provider  ON query_interaction_logs (provider_used);
CREATE INDEX IF NOT EXISTS idx_qil_user      ON query_interaction_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_qil_cache_hit ON query_interaction_logs (cache_hit);

-- ─────────────────────────────────────────────────────────────────────────────
-- B. Topic Taxonomy Reference Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS topic_taxonomy (
  topic_id    TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  keywords    TEXT[],             -- keyword strings for rule-based classification
  parent_topic TEXT,              -- for hierarchical grouping (future)
  icon        TEXT,               -- lucide icon name or emoji
  sort_order  SMALLINT DEFAULT 99
);

-- Seed the domain taxonomy (matches Guardian agent allowed topics)
INSERT INTO topic_taxonomy (topic_id, label, keywords, icon, sort_order) VALUES
  ('peatlands',      'Peatland Hydrology',       ARRAY['peat','peatland','groundwater','hydrology','subsidence','drainage','tropical peat','hemic','sapric'], '🌊', 1),
  ('fire_management','Fire & Smoke Management',  ARRAY['fire','prescribed burn','smoke','haze','globalrx','wildfire','burning','respiratory','combustion','burnt area'], '🔥', 2),
  ('food_systems',   'Food Systems & Emissions', ARRAY['food system','ghg','greenhouse gas','emission','food supply','crop','livestock','land use','diet','agriculture'], '🌾', 3),
  ('agroforestry',   'Agroforestry & Forestry',  ARRAY['agroforestry','silvopasture','tree','forest','woodland','canopy','shade','intercrop','fallow','reforestation','afforestation'], '🌳', 4),
  ('climate_change', 'Climate Change',            ARRAY['climate','carbon','co2','sequestration','mitigation','adaptation','warming','ipcc','temperature','blue carbon','mangrove'], '🌡️', 5),
  ('soil_science',   'Soil Science',              ARRAY['soil','organic carbon','soc','erosion','degradation','fertility','nitrogen','phosphorus','microbiome','rhizosphere'], '🪱', 6),
  ('biodiversity',   'Biodiversity & Ecology',   ARRAY['biodiversity','species','wildlife','mammal','habitat','ecology','conservation','endemic','fauna','flora'], '🦋', 7),
  ('policy',         'Policy & Governance',       ARRAY['policy','governance','law','regulation','ndcs','redd','treaty','convention','cbd','unfccc','land rights','tenure'], '📜', 8),
  ('methodology',    'Research Methodology',     ARRAY['remote sensing','satellite','lidar','survey','methodology','mapping','modelling','dataset','machine learning','ai'], '🔬', 9),
  ('general',        'General / Other',           ARRAY[]::TEXT[], '💬', 99)
ON CONFLICT (topic_id) DO UPDATE
  SET label = EXCLUDED.label, keywords = EXCLUDED.keywords;

-- ─────────────────────────────────────────────────────────────────────────────
-- C. Pre-aggregated Daily Analytics Summary
--    Populated nightly by cron_eval_and_warmup
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics_daily_summary (
  day                   DATE PRIMARY KEY,
  total_queries         INTEGER DEFAULT 0,
  unique_users          INTEGER DEFAULT 0,
  guest_queries         INTEGER DEFAULT 0,
  cache_hits            INTEGER DEFAULT 0,
  guardian_fails        INTEGER DEFAULT 0,
  hybrid_searches       INTEGER DEFAULT 0,
  fallback_searches     INTEGER DEFAULT 0,
  avg_latency_ms        FLOAT,
  p50_latency_ms        FLOAT,
  p95_latency_ms        FLOAT,
  total_input_tokens    BIGINT DEFAULT 0,
  total_output_tokens   BIGINT DEFAULT 0,
  estimated_cost_usd    FLOAT DEFAULT 0.0,
  cost_by_provider      JSONB DEFAULT '{}',
  topic_distribution    JSONB DEFAULT '{}',
  query_type_breakdown  JSONB DEFAULT '{}',
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- D. Hour-of-Day Activity Heatmap Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hourly_activity (
  day             DATE,
  hour_utc        SMALLINT CHECK (hour_utc >= 0 AND hour_utc <= 23),
  day_of_week     SMALLINT,        -- 0=Sun, 6=Sat (extracted from day)
  query_count     INTEGER DEFAULT 0,
  cache_hits      INTEGER DEFAULT 0,
  avg_latency_ms  FLOAT,
  PRIMARY KEY (day, hour_utc)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- E. User Analytics Summary (populated nightly)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_analytics_summary (
  user_id            TEXT NOT NULL,   -- UUID or 'guest:session_id'
  email              TEXT,
  period_start       DATE NOT NULL,
  period_end         DATE NOT NULL,
  total_queries      INTEGER DEFAULT 0,
  cache_hits         INTEGER DEFAULT 0,
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  estimated_cost_usd FLOAT DEFAULT 0.0,
  avg_satisfaction   FLOAT,
  top_topics         JSONB DEFAULT '{}',
  PRIMARY KEY (user_id, period_start)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- F. Production RAGAS Evaluation Scores (sampled ~5% of live traffic)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS production_eval_scores (
  eval_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id            UUID REFERENCES query_interaction_logs(log_id) ON DELETE CASCADE,
  feedback_id       UUID REFERENCES query_feedback(feedback_id) ON DELETE SET NULL,
  timestamp         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  faithfulness      FLOAT,        -- 0.0-1.0: answer supported by retrieved context
  answer_relevance  FLOAT,        -- 0.0-1.0: answer addresses the query
  context_precision FLOAT,        -- 0.0-1.0: retrieved chunks are relevant
  context_recall    FLOAT,        -- 0.0-1.0: retrieved chunks contain needed info
  overall_score     FLOAT,        -- avg of the above
  judge_model       TEXT,         -- e.g. 'modal_gemma', 'gemini-2.5-flash'
  raw_output        JSONB         -- full judge response for debugging
);

CREATE INDEX IF NOT EXISTS idx_pes_timestamp ON production_eval_scores (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pes_log_id ON production_eval_scores (log_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- G. System Alerts Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_alerts (
  alert_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  severity    TEXT CHECK (severity IN ('info', 'warning', 'error')) DEFAULT 'warning',
  category    TEXT,               -- 'retrieval_gap' | 'high_latency' | 'low_cache' | 'high_rejection'
  message     TEXT NOT NULL,
  value       FLOAT,              -- the measured value that triggered the alert
  threshold   FLOAT,              -- the threshold it crossed
  resolved    BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON system_alerts (resolved, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- H. Popular Documents View (replaces manual aggregation in Python)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW popular_documents AS
  SELECT
    c.id AS document_id,
    c.title,
    c.doi,
    c.authors,
    c.publication_year,
    COUNT(DISTINCT qcl.log_id) AS query_count,
    ROUND(AVG(qcl.rrf_score)::NUMERIC, 4) AS avg_rrf_score,
    MAX(qil.timestamp) AS last_retrieved_at
  FROM query_chunk_logs qcl
  JOIN document_embeddings de ON qcl.chunk_id = de.id
  JOIN documents_catalog c ON de.document_id = c.id
  JOIN query_interaction_logs qil ON qcl.log_id = qil.log_id
  GROUP BY c.id, c.title, c.doi, c.authors, c.publication_year
  ORDER BY query_count DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- I. Parametric Time-Series RPC Function
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_analytics_timeseries(
  p_start_date   DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date     DATE DEFAULT CURRENT_DATE,
  p_topic        TEXT DEFAULT NULL,
  p_provider     TEXT DEFAULT NULL,
  p_query_type   TEXT DEFAULT NULL
)
RETURNS TABLE (
  day                 DATE,
  total_queries       BIGINT,
  cache_hits          BIGINT,
  guardian_fails      BIGINT,
  avg_latency_ms      FLOAT,
  total_input_tokens  BIGINT,
  total_output_tokens BIGINT,
  estimated_cost_usd  FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    date_trunc('day', timestamp)::DATE AS day,
    COUNT(*) AS total_queries,
    SUM(CASE WHEN cache_hit = TRUE THEN 1 ELSE 0 END) AS cache_hits,
    SUM(CASE WHEN guardian_passed = FALSE THEN 1 ELSE 0 END) AS guardian_fails,
    AVG(latency_ms)::FLOAT AS avg_latency_ms,
    COALESCE(SUM(input_tokens), 0)::BIGINT AS total_input_tokens,
    COALESCE(SUM(output_tokens), 0)::BIGINT AS total_output_tokens,
    COALESCE(SUM(estimated_cost_usd), 0.0)::FLOAT AS estimated_cost_usd
  FROM query_interaction_logs
  WHERE
    timestamp >= p_start_date::TIMESTAMP WITH TIME ZONE
    AND timestamp < (p_end_date + INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE
    AND (p_topic IS NULL OR topic_category = p_topic)
    AND (p_provider IS NULL OR provider_used = p_provider)
    AND (p_query_type IS NULL OR query_type = p_query_type)
  GROUP BY 1
  ORDER BY 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- J. Per-User Cost Breakdown RPC Function
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_cost_breakdown(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date   DATE DEFAULT CURRENT_DATE,
  p_limit      INT DEFAULT 25
)
RETURNS TABLE (
  user_key           TEXT,
  email              TEXT,
  total_queries      BIGINT,
  cache_hits         BIGINT,
  total_tokens       BIGINT,
  estimated_cost_usd FLOAT,
  avg_satisfaction   FLOAT,
  top_topic          TEXT
)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(l.user_id::TEXT, 'guest:' || COALESCE(l.guest_session_id, 'unknown')) AS user_key,
    p.email,
    COUNT(*) AS total_queries,
    SUM(CASE WHEN l.cache_hit = TRUE THEN 1 ELSE 0 END)::BIGINT AS cache_hits,
    COALESCE(SUM(l.input_tokens + l.output_tokens), 0)::BIGINT AS total_tokens,
    COALESCE(SUM(l.estimated_cost_usd), 0.0)::FLOAT AS estimated_cost_usd,
    AVG(f.rating)::FLOAT AS avg_satisfaction,
    MODE() WITHIN GROUP (ORDER BY l.topic_category) AS top_topic
  FROM query_interaction_logs l
  LEFT JOIN user_profiles p ON l.user_id = p.user_id
  LEFT JOIN query_feedback f ON l.log_id = f.log_id
  WHERE
    l.timestamp >= p_start_date::TIMESTAMP WITH TIME ZONE
    AND l.timestamp < (p_end_date + INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE
  GROUP BY user_key, p.email
  ORDER BY estimated_cost_usd DESC NULLS LAST
  LIMIT p_limit;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- K. Hour-of-Day Heatmap RPC Function
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_hourly_heatmap(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  hour_utc       INT,
  day_of_week    INT,      -- 0=Sunday .. 6=Saturday
  query_count    BIGINT,
  cache_hits     BIGINT,
  avg_latency_ms FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    EXTRACT(HOUR FROM timestamp AT TIME ZONE 'UTC')::INT AS hour_utc,
    EXTRACT(DOW FROM timestamp AT TIME ZONE 'UTC')::INT AS day_of_week,
    COUNT(*) AS query_count,
    SUM(CASE WHEN cache_hit = TRUE THEN 1 ELSE 0 END)::BIGINT AS cache_hits,
    AVG(latency_ms)::FLOAT AS avg_latency_ms
  FROM query_interaction_logs
  WHERE
    timestamp >= p_start_date::TIMESTAMP WITH TIME ZONE
    AND timestamp < (p_end_date + INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE
  GROUP BY 1, 2
  ORDER BY 2, 1;
$$;
