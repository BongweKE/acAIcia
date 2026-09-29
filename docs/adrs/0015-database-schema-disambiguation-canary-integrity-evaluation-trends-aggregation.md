# ADR 0015: Database Schema Disambiguation, Canary Integrity & Evaluation Trends Aggregation

## Status
Accepted

## Context
During implementation and hardening of Phase 1 and 2 capabilities (native pgvector semantic cache and continuous evaluation system):
1. **RPC Parameter Shadowing**: In migration `010_native_pgvector_semantic_cache.sql`, the PostgreSQL function `match_semantic_cache_pgvector` declared parameter names matching column names (`query_embedding`, `match_threshold`, `filter_topic`). In SQL function bodies, column references can shadow unqualified parameter names, creating ambiguity and driver-level mapping friction.
2. **Canary Question Duplication**: The `canary_questions` table created in `005_evaluation_system.sql` lacked a `UNIQUE(question_text)` constraint. Consequently, re-running seed scripts or migrations caused duplicate canary entries, artificially distorting canary violation rates and canary count metrics.
3. **LEFT JOIN Trend View Skew**: The `evaluation_score_trends` SQL view joined `evaluation_runs` with `evaluation_details` using a `LEFT JOIN`, but computed hit rates and totals using `COUNT(*)`. When an evaluation run had zero detail records (e.g., cancelled or failed before detail rows were written), `COUNT(*)` evaluated to 1 rather than 0, resulting in erroneous metrics and non-zero counts for non-existent details.

## Decision
We deploy migration `011_fix_pgvector_cache_and_evaluation_system.sql` (and align migration `010`):
1. **Prefix RPC Parameters with `p_`**: Re-declare `match_semantic_cache_pgvector` with `(p_query_embedding, p_match_threshold, p_filter_topic)` and update both batch and streaming pipeline call sites in `backend/pipeline.py`.
2. **Deduplicate Canary Questions & Enforce Uniqueness**: Delete duplicate rows from `canary_questions` preserving the earliest record (`ctid` / `created_at`), and enforce `ALTER TABLE canary_questions ADD CONSTRAINT canary_questions_question_text_key UNIQUE (question_text)`.
3. **Correct Aggregations in `evaluation_score_trends`**: Replace `COUNT(*)` with `COUNT(ed.detail_id)` in the view definition and denominator calculations (`NULLIF(COUNT(ed.detail_id), 0)`), ensuring runs with zero details accurately report 0 details and NULL hit rates. Retain `security_invoker = true`.

## Consequences
- **Positive:** Unambiguous SQL parameter scoping in pgvector cache matching, strict data integrity preventing duplicate canary records, and mathematically accurate evaluation score trend reporting.
- **Negative:** Requires aligning RPC invocation keys between Python application code and Postgres schema definitions.
