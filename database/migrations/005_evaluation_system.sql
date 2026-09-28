-- ============================================================================
-- Migration: 005_evaluation_system.sql
-- Description: Comprehensive evaluation infrastructure.
--   Adds per-question detail rows, evaluation configurations, canary tracking,
--   and extends evaluation_runs with richer metadata.
-- Run this in the Supabase SQL Editor.
-- ============================================================================

-- A. Extend evaluation_runs with run configuration metadata
ALTER TABLE evaluation_runs
  ADD COLUMN IF NOT EXISTS run_type        TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS eval_mode       TEXT DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS judge_model     TEXT,
  ADD COLUMN IF NOT EXISTS total_cost_usd  FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS duration_sec    FLOAT,
  ADD COLUMN IF NOT EXISTS passed          BOOLEAN,
  ADD COLUMN IF NOT EXISTS config          JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS triggered_by    TEXT,
  ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'completed';

-- Index for efficient evaluation history queries
CREATE INDEX IF NOT EXISTS idx_eval_runs_timestamp ON evaluation_runs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_eval_runs_type ON evaluation_runs (run_type);

-- B. Per-question evaluation detail rows
CREATE TABLE IF NOT EXISTS evaluation_details (
  detail_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES evaluation_runs(run_id) ON DELETE CASCADE,
  question_index    INTEGER NOT NULL,
  input_query       TEXT NOT NULL,
  expected_output   TEXT,
  actual_output     TEXT,
  retrieval_context TEXT[],

  -- Core RAG Metrics (0.0 - 1.0)
  faithfulness      FLOAT,
  answer_relevancy  FLOAT,
  context_precision FLOAT,
  context_recall    FLOAT,

  -- Extended Metrics
  citation_quality  FLOAT,
  hallucination_rate FLOAT,
  hit_at_1          BOOLEAN,
  hit_at_5          BOOLEAN,

  -- Operational
  latency_ms        INTEGER,
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  eval_cost_usd     FLOAT DEFAULT 0.0,

  -- Metadata
  question_type     TEXT DEFAULT 'standard',
  topic_category    TEXT,
  source_dataset    TEXT,
  target_doi        TEXT,
  notes             TEXT,

  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eval_details_run ON evaluation_details (run_id);
CREATE INDEX IF NOT EXISTS idx_eval_details_type ON evaluation_details (question_type);

-- C. Canary Questions Registry
CREATE TABLE IF NOT EXISTS canary_questions (
  canary_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text     TEXT NOT NULL,
  topic_category    TEXT,
  expected_behavior TEXT DEFAULT 'abstain',
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial canary questions (answers verifiably absent from KB)
INSERT INTO canary_questions (question_text, topic_category, expected_behavior) VALUES
  ('What were the fire management policies of ancient Rome?', 'fire_management', 'abstain'),
  ('How does quantum computing affect peatland hydrology?', 'peatlands', 'abstain'),
  ('What is the recipe for chocolate cake using agroforestry ingredients?', 'general', 'reject'),
  ('Describe the Mars colonization soil science experiments from 2030.', 'soil_science', 'abstain'),
  ('What is the GDP growth rate of Wakanda due to forest carbon credits?', 'climate_change', 'abstain'),
  ('Who won the 2025 Nobel Prize in agroforestry?', 'agroforestry', 'abstain'),
  ('What are the effects of 5G radiation on tropical forests?', 'methodology', 'abstain'),
  ('How do peatland organisms communicate using telepathy?', 'peatlands', 'reject')
ON CONFLICT DO NOTHING;

-- D. Evaluation score trend view (for dashboard charts)
CREATE OR REPLACE VIEW evaluation_score_trends AS
  SELECT
    er.run_id,
    er.timestamp,
    er.run_type,
    er.dataset_name,
    er.judge_model,
    er.passed,
    er.num_questions,
    er.status,
    er.duration_sec,
    er.total_cost_usd AS run_cost_usd,
    AVG(ed.faithfulness)       AS avg_faithfulness,
    AVG(ed.answer_relevancy)   AS avg_answer_relevancy,
    AVG(ed.context_precision)  AS avg_context_precision,
    AVG(ed.context_recall)     AS avg_context_recall,
    AVG(ed.citation_quality)   AS avg_citation_quality,
    AVG(ed.hallucination_rate) AS avg_hallucination_rate,
    AVG(ed.latency_ms)         AS avg_latency_ms,
    SUM(CASE WHEN ed.hit_at_5 THEN 1 ELSE 0 END)::FLOAT
      / NULLIF(COUNT(*), 0) * 100 AS hit_rate_at_5_pct,
    SUM(CASE WHEN ed.hit_at_1 THEN 1 ELSE 0 END)::FLOAT
      / NULLIF(COUNT(*), 0) * 100 AS hit_rate_at_1_pct,
    COUNT(CASE WHEN ed.question_type = 'canary'
               AND ed.actual_output IS NOT NULL
               AND LENGTH(ed.actual_output) > 50 THEN 1 END) AS canary_violations,
    COUNT(CASE WHEN ed.question_type = 'canary' THEN 1 END) AS canary_total,
    COUNT(*) AS total_details
  FROM evaluation_runs er
  LEFT JOIN evaluation_details ed ON er.run_id = ed.run_id
  GROUP BY er.run_id, er.timestamp, er.run_type, er.dataset_name,
           er.judge_model, er.passed, er.num_questions, er.status,
           er.duration_sec, er.total_cost_usd
  ORDER BY er.timestamp DESC;
