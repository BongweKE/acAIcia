-- ============================================================================
-- Migration: 011_fix_pgvector_cache_and_evaluation_system.sql
-- Description:
--   1. Parameter disambiguation (p_query_embedding, p_match_threshold, p_filter_topic)
--      in match_semantic_cache_pgvector to prevent column name shadowing.
--   2. Deduplication of canary_questions and UNIQUE(question_text) constraint.
--   3. Fix LEFT JOIN aggregation in evaluation_score_trends view (COUNT(ed.detail_id)).
-- ============================================================================

-- 1. Parameter disambiguation for match_semantic_cache_pgvector
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

-- 2. Deduplication of canary_questions and UNIQUE(question_text) constraint
DELETE FROM public.canary_questions
WHERE canary_id NOT IN (
  SELECT DISTINCT ON (question_text) canary_id
  FROM public.canary_questions
  ORDER BY question_text, created_at ASC
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'canary_questions_question_text_key'
       OR conname = 'uq_canary_questions_question_text'
  ) THEN
    ALTER TABLE public.canary_questions
      ADD CONSTRAINT canary_questions_question_text_key UNIQUE (question_text);
  END IF;
END $$;

-- 3. Fix LEFT JOIN aggregation in evaluation_score_trends view (COUNT(ed.detail_id))
CREATE OR REPLACE VIEW public.evaluation_score_trends WITH (security_invoker = true) AS
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
      / NULLIF(COUNT(ed.detail_id), 0) * 100 AS hit_rate_at_5_pct,
    SUM(CASE WHEN ed.hit_at_1 THEN 1 ELSE 0 END)::FLOAT
      / NULLIF(COUNT(ed.detail_id), 0) * 100 AS hit_rate_at_1_pct,
    COUNT(CASE WHEN ed.question_type = 'canary'
               AND ed.actual_output IS NOT NULL
               AND LENGTH(ed.actual_output) > 50 THEN 1 END) AS canary_violations,
    COUNT(CASE WHEN ed.question_type = 'canary' THEN 1 END) AS canary_total,
    COUNT(ed.detail_id) AS total_details
  FROM evaluation_runs er
  LEFT JOIN evaluation_details ed ON er.run_id = ed.run_id
  GROUP BY er.run_id, er.timestamp, er.run_type, er.dataset_name,
           er.judge_model, er.passed, er.num_questions, er.status,
           er.duration_sec, er.total_cost_usd
  ORDER BY er.timestamp DESC;
