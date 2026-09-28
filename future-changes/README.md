# Future Changes — acAIcia Pipeline Research & Roadmap

This folder contains research findings, architecture alternatives, and a
prioritized roadmap for improving the acAIcia AI research assistant pipeline.
Each change is cross-referenced to a GitHub issue for tracking.

> 💡 **Product Backlog**: For the consolidated, authoritative backlog and preferred implementation sequence, see [`BACKLOG.md`](../BACKLOG.md) at the repository root.

---

## Files

| File | Contents |
|---|---|
| [`01-current-pipeline-analysis.md`](./01-current-pipeline-analysis.md) | How the pipeline works today — the full `POST /query` flow with code references. |
| [`02-improvement-opportunities.md`](./02-improvement-opportunities.md) | Researched alternatives per improvement theme, with tradeoffs and effort estimates. |
| [`03-prioritized-roadmap.md`](./03-prioritized-roadmap.md) | Phased execution plan with success metrics. |
| [`../BACKLOG.md`](../BACKLOG.md) | Authoritative product backlog with comprehensive issue cards, execution order, and ADR traceability. |

---

## Priority Legend

| Priority | Label | Meaning |
|---|---|---|
| **P0** | `priority:p0` | Production hotfix / security baseline — ship immediately. Zero/low effort, fixes active bugs or ADR violations. |
| **P1** | `priority:p1` | High ROI, moderate effort — ship in Phase 1. Direct UX, reliability, or cost modeling payoff. |
| **P2** | `priority:p2` | Meaningful improvement, higher effort — Phase 2. Requires P1 groundwork or enables multi-replica scale. |
| **P3** | `priority:p3` | Long-term hardening / cleanup — Phase 3. Nice-to-have, model migrations, or legacy deprecation. |

---

## Issue Index

| # | Title | Priority | Phase |
|---|---|---|---|
| 13 | Fix Migration 005 (RLS & Security Invoker) + Apply to Supabase | P0 | Sprint 0 |
| 14 | Fix Admin CSV Export 401 Unauthorized via Query Param Auth | P0 | Sprint 0 |
| 15 | Exact Token Telemetry & Eliminate Heuristic 50/50 Token Split | P0 | Sprint 0 |
| 16 | Fix Evaluation Background Worker Uncaught Exception Handling | P0 | Sprint 0 |
| 17 | Secure Legacy Modal Rollback `POST /settings` with Admin Auth | P0 | Sprint 0 |
| 18 | Update Stale Modal Backend URLs in Dev & Test Tooling | P0 | Sprint 0 |
| 1 | Streaming responses + replace volume-file polling (SSE) | P1 | Phase 1 |
| 20 | Cost Model Refinements: Cache Progression, Multi-Replica Overages, Mistral Seat | P1 | Phase 1 |
| 3 | Cross-encoder reranker for hybrid retrieval | P1 | Phase 1 |
| 2 | Unified LLM gateway via LiteLLM with provider fallback | P1 | Phase 1 |
| 19 | Shared Query Status Store (Supabase/Redis) for Multi-Replica Scaling | P2 | Phase 2 |
| 6 | Semantic cache → native pgvector HNSW query | P2 | Phase 2 |
| 8 | Automated CI evaluation suite (DeepEval / RAGAS) + regression gate | P2 | Phase 2 |
| 7 | LLM observability (Langfuse / Phoenix) | P2 | Phase 2 |
| 4 | HyDE / multi-query expansion | P2 | Phase 2 |
| 5 | Corrective RAG (CRAG) relevance gate | P2 | Phase 2 |
| 12 | Re-architect pipeline with LangGraph | P2 | Phase 2 |
| 9 | Embeddings + chunking upgrade (`BAAI/bge-m3` + parent-child) | P3 | Phase 3 |
| 11 | Structured outputs + retries for Guardian/Architect | P3 | Phase 3 |
| 10 | Deprecate & archive legacy Modal codebase (`app.py`, `gemma_inference.py`) | P3 | Phase 3 |
