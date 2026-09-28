# 03 — Prioritized Roadmap

> Phased execution plan with success metrics, mapped to GitHub issues.
> For the comprehensive product backlog cards and ADR traceability, see [`../BACKLOG.md`](../BACKLOG.md).

---

## Priority Legend

| Priority | Label | Meaning |
|---|---|---|
| **P0** | `priority:p0` | Production hotfix / security baseline — ship immediately. Zero/low effort, fixes active bugs or ADR violations. |
| **P1** | `priority:p1` | High ROI, moderate effort — Phase 1. Direct UX, reliability, or cost modeling payoff. |
| **P2** | `priority:p2` | Meaningful improvement, higher effort — Phase 2. Enables multi-replica scale and automated quality gates. |
| **P3** | `priority:p3` | Long-term hardening / cleanup — Phase 3. Nice-to-have, model upgrades, or legacy deprecation. |

---

## Phase 0 — Hotfixes & Production Security (P0)

Zero-to-low effort fixes that eliminate active runtime failures, security policy violations (ADR 0010), and telemetry distortions in production. Ship immediately in a single batch.

| # | Issue | Effort | Metric |
|---|---|---|---|
| 13 | [Fix Migration 005 (RLS & Security Invoker) + Apply to Supabase](https://github.com/BongweKE/acAIcia/issues/13) | S (0.5d) | 100% ADR 0010 RLS compliance; eval tables persist |
| 14 | [Fix Admin CSV Export 401 Unauthorized via Query Param Auth](https://github.com/BongweKE/acAIcia/issues/14) | S (0.5d) | Zero 401 errors on admin CSV downloads |
| 15 | [Exact Token Telemetry & Eliminate Heuristic 50/50 Token Split](https://github.com/BongweKE/acAIcia/issues/15) | S (1d) | Exact prompt/completion token tracking; eliminates 300% cost skew |
| 16 | [Fix Evaluation Background Worker Uncaught Exception Handling](https://github.com/BongweKE/acAIcia/issues/16) | S (0.5d) | Zero infinite loading hangs in Admin UI on eval failure |
| 17 | [Secure Legacy Modal Rollback `POST /settings` with Admin Auth](https://github.com/BongweKE/acAIcia/issues/17) | S (0.2d) | Zero unauthenticated admin endpoints on rollback |
| 18 | [Update Stale Modal Backend URLs in Dev & Test Tooling](https://github.com/BongweKE/acAIcia/issues/18) | S (0.2d) | Out-of-the-box working CLI and DeepEval test suite |

**Phase 0 success criteria**:
- Supabase SQL Editor applies Migration 005 with RLS enabled on `evaluation_details` and `canary_questions`.
- Admin CSV download works directly from frontend `/admin` dashboard.
- `query_interaction_logs` records exact input and output tokens matching provider usage.
- Failed eval runs set `status = 'failed'` and alert admin UI cleanly.
- `POST /settings` on legacy `app.py` requires `ADMIN_API_KEY`.
- `cli_admin.py` and `tests/deepeval_suite.py` target Railway backend by default.

**Suggested order within Phase 0 (Sprint 0)**:
1. **#13** (Migration 005 RLS & Invoker Fix) — Essential DB migration; establishes ADR 0010 security baseline and unblocks eval persistence.
2. **#14** (Admin CSV 401 Fix) — Fixes broken query param auth for admin log exports.
3. **#15** (Exact Token Telemetry) — Eliminates 50/50 token split heuristic and stops 300% cost inflation in subsequent query logs.
4. **#16** (Eval Worker Failure State Handling) — Prevents admin UI infinite loading spin on eval background worker exceptions.
5. **#17** (Legacy Modal Rollback Auth) — Closes unauthenticated settings endpoint in rollback `backend/app.py`.
6. **#18** (Fix Dev Tool URLs) — Updates fallback URLs in CLI and test tooling to point to active Railway backend.

---

## Phase 1 — Immediate Wins & Strategic Calibration (P1)

High ROI, moderate effort. Delivers visible UX improvements, cost transparency, and retrieval gains.

| # | Issue | Effort | Metric |
|---|---|---|---|
| 1 | [Streaming responses + replace file polling (SSE)](https://github.com/BongweKE/acAIcia/issues/1) | M (5–8d) | Time-to-first-token < 2.0s; eliminates polling |
| 20 | [Cost Model Refinements: Cache Progression, Multi-Replica Overages, Mistral Seat](https://github.com/BongweKE/acAIcia/issues/20) | S (1d) | Accurate multi-replica budget & cache savings curve |
| 3 | [Cross-encoder reranker for hybrid retrieval](https://github.com/BongweKE/acAIcia/issues/3) | S (2–3d) | hit@1 +5pp on test questions |
| 2 | [Unified LLM gateway via LiteLLM with provider fallback](https://github.com/BongweKE/acAIcia/issues/2) | M (3–5d) | Zero downtime on Mistral 429/503; automatic fallback to Gemini/DeepSeek |

**Phase 1 success criteria**:
- Frontend streams tokens with stage indicators (Guardian → Architect → Retrieving → Synthesizing).
- Cost model documents multi-replica compute overages and 10% → 30% cache progression.
- `hit@1` improves by ≥ 5pp with cross-encoder reranker.
- LLM calls automatically fail over if the primary provider encounters errors.

**Suggested order within Phase 1**:
1. **#20** (Cost Model Refinements) — Quick 1-day documentation update; clarifies multi-replica compute overheads and cache compounding to establish budgets before major refactors.
2. **#1** (Streaming Responses via SSE) — Highest-ROI user-facing improvement; drops perceived TTFT from ~25s to <2s.
3. **#3** (Cross-Encoder Reranker) — Low effort (2–3d) retrieval precision boost (+5pp hit@1) directly on top of hybrid retrieval.
4. **#2** (LiteLLM Unified Gateway) — Standardizes multi-provider LLM calling and enables automated failover on 429/503 errors.

---

## Phase 2 — Horizontal Scaling & Architectural Quality Gates (P2)

Enables scaling from 50 to 500 users, unlocks multi-replica horizontal deployment on Railway, and automates regression testing.

| # | Issue | Effort | Metric |
|---|---|---|---|
| 19 | [Shared Query Status Store (Supabase/Redis) for Multi-Replica Scaling](https://github.com/BongweKE/acAIcia/issues/19) | M (3–4d) | Seamless load-balancing across 2+ Railway backend replicas |
| 6 | [Semantic cache → native pgvector HNSW query](https://github.com/BongweKE/acAIcia/issues/6) | S (2–3d) | Cache lookup < 15ms; scales past 100k cached queries |
| 8 | [Automated CI evaluation suite (DeepEval / RAGAS) + regression gate](https://github.com/BongweKE/acAIcia/issues/8) | M (4–6d) | CI blocks PR merges if Faithfulness or Recall drops > 0.05 |
| 7 | [LLM observability (Langfuse / OpenTelemetry)](https://github.com/BongweKE/acAIcia/issues/7) | M (3–5d) | Distributed multi-agent waterfall traces in Langfuse |
| 4 | [HyDE / multi-query expansion](https://github.com/BongweKE/acAIcia/issues/4) | S (2–4d) | hit@1 +3pp on vague or conversational queries |
| 5 | [Corrective RAG (CRAG) relevance gate](https://github.com/BongweKE/acAIcia/issues/5) | M (4–6d) | Faithfulness +0.05; zero hallucinations on absent topics |
| 12 | [Re-architect pipeline with LangGraph](https://github.com/BongweKE/acAIcia/issues/12) | XL (8–12d) | Directed state graph with node-level retries and checkpoints |

**Suggested order within Phase 2**:
1. **#19** (Shared Status Store) — **Must precede** increasing Railway replica count.
2. **#6** (pgvector cache) — Eliminates Python brute-force memory bottleneck.
3. **#8** (CI evaluation gate) — Establishes baseline quality protection before major refactors.
4. **#7** (Langfuse observability) — Provides visual tracing for debugging subsequent nodes.
5. **#4 + #5** (HyDE + CRAG) — Adds search expansion and relevance gating.
6. **#12** (LangGraph orchestration) — Refactors pipeline into modular state machine.

---

## Phase 3 — Long-Term Hardening & Cleanup (P3)

Deferred improvements. Lower immediate urgency but high long-term quality and maintenance payoff.

| # | Issue | Effort | Metric |
|---|---|---|---|
| 9 | [Embeddings + chunking upgrade (`BAAI/bge-m3` + parent-child)](https://github.com/BongweKE/acAIcia/issues/9) | L (6–10d) | Multilingual search support; context precision +0.08 |
| 11 | [Structured outputs + retries for Guardian/Architect](https://github.com/BongweKE/acAIcia/issues/11) | S (2–3d) | Zero malformed output parsing errors via JSON schema |
| 10 | [Deprecate & archive legacy Modal codebase (`app.py`, `gemma_inference.py`)](https://github.com/BongweKE/acAIcia/issues/10) | S (2–3d) | Root `backend/` contains only active Railway modules |

**Suggested order within Phase 3**:
1. **#11** (Structured Outputs via JSON Schema) — Low-effort win (2–3d) that eliminates regex/string parsing for Guardian and Architect.
2. **#9** (Embeddings + Chunking Upgrade) — High-effort upgrade (6–10d) to `bge-m3` with parent-child chunking and database re-embedding.
3. **#10** (Deprecate & Archive Modal Codebase) — Move `backend/app.py` to `archive/` once Railway backend demonstrates 90+ days of production stability.

---

## Quick Reference Matrix

```
Phase 0 (P0) - Sprint 0   Phase 1 (P1)           Phase 2 (P2)             Phase 3 (P3)
───────────────────────   ────────────────────   ──────────────────────   ──────────────────────
#13 Migration 005 RLS     #1  Streaming (SSE)    #19 Shared Status Store  #9  bge-m3 Embeddings
#14 Admin CSV 401 Fix     #20 Cost Model Rev     #6  pgvector Cache       #11 Structured Output
#15 Exact Token Telem     #3  Reranker           #8  CI Eval Gate         #10 Archive Modal Code
#16 Eval Worker Hang Fix  #2  LiteLLM Gateway    #7  Langfuse Tracing
#17 Legacy Modal Auth                            #4  HyDE Expansion
#18 Fix Dev Tool URLs                            #5  CRAG Relevance Gate
                                                 #12 LangGraph Engine
```
