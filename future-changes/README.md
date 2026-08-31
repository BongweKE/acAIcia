# Future Changes — acAIcia Pipeline Research & Roadmap

This folder contains research findings, architecture alternatives, and a
prioritized roadmap for improving the acAIcia AI research assistant pipeline.
Each change is cross-referenced to a GitHub issue for tracking.

---

## Files

| File | Contents |
|---|---|
| [`01-current-pipeline-analysis.md`](./01-current-pipeline-analysis.md) | How the pipeline works today — the full `POST /query` flow with code references. |
| [`02-improvement-opportunities.md`](./02-improvement-opportunities.md) | Researched alternatives per improvement theme, with tradeoffs and effort estimates. |
| [`03-prioritized-roadmap.md`](./03-prioritized-roadmap.md) | Phased execution plan with success metrics. |

---

## Priority Legend

| Priority | Label | Meaning |
|---|---|---|
| **P1** | `priority:p1` | High ROI, moderate effort — ship first. Direct UX or reliability payoff. |
| **P2** | `priority:p2` | Meaningful improvement, higher effort — Phase 2. Requires P1 groundwork. |
| **P3** | `priority:p3` | Long-term hardening / cleanup — Phase 3. Nice-to-have or deferred. |

---

## Issue Index

| # | Title | Priority | Phase |
|---|---|---|---|
| 1 | Streaming responses + replace volume-file polling | P1 | Phase 1 |
| 2 | Unified LLM gateway via LiteLLM with provider fallback | P1 | Phase 1 |
| 3 | Cross-encoder reranker for hybrid retrieval | P1 | Phase 1 |
| 4 | HyDE / multi-query expansion | P2 | Phase 2 |
| 5 | Corrective RAG (CRAG) relevance gate | P2 | Phase 2 |
| 6 | Re-architect pipeline with LangGraph | P2 | Phase 2 |
| 7 | Semantic cache → native pgvector HNSW query | P2 | Phase 2 |
| 8 | LLM observability (Langfuse / Phoenix) | P2 | Phase 2 |
| 9 | Proper RAGAS / DeepEval eval suite + CI gate | P2 | Phase 2 |
| 10 | Embeddings + chunking upgrade | P3 | Phase 3 |
| 11 | Modularize `app.py` + remove dead infra | P3 | Phase 3 |
| 12 | Structured outputs + retries for Guardian/Architect | P3 | Phase 3 |
