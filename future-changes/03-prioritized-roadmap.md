# 03 — Prioritized Roadmap

> Phased execution plan with success metrics, mapped to GitHub issues.

---

## Priority legend

| Priority | Label | Meaning |
|---|---|---|
| **P1** | `priority:p1` | High ROI, moderate effort — ship first. Direct UX or reliability payoff. |
| **P2** | `priority:p2` | Meaningful improvement, higher effort — Phase 2. Often requires P1 groundwork. |
| **P3** | `priority:p3` | Long-term hardening / cleanup — Phase 3. Nice-to-have or deferred. |

---

## Phase 1 — Immediate wins (P1)

High ROI, moderate effort. These deliver visible UX and reliability improvements
with minimal architectural risk.

| # | Issue | Effort | Metric |
|---|---|---|---|
| 1 | [Streaming responses + replace volume-file polling](https://github.com/BongweKE/acAIcia/issues/1) | M (5–8d) | Time-to-first-token < 2s |
| 2 | [Unified LLM gateway via LiteLLM](https://github.com/BongweKE/acAIcia/issues/2) | L (3–5d) | Cold-start auto-fallback; unified cost tracking |
| 3 | [Cross-encoder reranker](https://github.com/BongweKE/acAIcia/issues/3) | S (2–3d) | hit@1 +5pp |

**Phase 1 success criteria**:
- Frontend streams tokens with stage indicators (no polling).
- Gemma cold-start failures silently fall back to Gemini.
- `hit@1` from `eval_runner.py` improves by ≥ 5pp after reranker.

**Dependencies**: #1 and #2 are independent; #3 depends on retrieval only.
Can be parallelized across two developers.

---

## Phase 2 — Architectural improvements (P2)

Meaningful improvements that build on Phase 1. Require more architectural
changes but unlock compounding gains.

| # | Issue | Effort | Metric |
|---|---|---|---|
| 4 | [HyDE / multi-query expansion](https://github.com/BongweKE/acAIcia/issues/4) | S (2–4d) | hit@1 +3pp |
| 5 | [Corrective RAG (CRAG) relevance gate](https://github.com/BongweKE/acAIcia/issues/5) | M (4–6d) | Faithfulness +0.05 |
| 6 | [Semantic cache → native pgvector](https://github.com/BongweKE/acAIcia/issues/6) | S (2–3d) | Remove Python brute-force; cache scales to 10k+ |
| 7 | [LLM observability (Langfuse)](https://github.com/BongweKE/acAIcia/issues/7) | M (3–5d) | Full trace per query in < 2 min |
| 8 | [Eval suite (RAGAS/DeepEval)](https://github.com/BongweKE/acAIcia/issues/8) | M (4–6d) | CI blocks metric regression > 0.05 |
| 12 | [Re-architect with LangGraph](https://github.com/BongweKE/acAIcia/issues/12) | XL (8–12d) | Per-stage streaming, node retries, checkpoint resume |

**Phase 2 success criteria**:
- Pipeline is a LangGraph graph with streaming, retries, and conditional edges.
- Every LLM call is traced in Langfuse.
- Eval suite runs in CI and blocks regressions.
- Semantic cache uses native pgvector.

**Suggested order within Phase 2**:
1. **#6** (pgvector cache) — independent, quick win.
2. **#7** (Langfuse) — quick win, improves debugging for everything else.
3. **#12** (LangGraph) — the big one; do #1 first so streaming is available.
4. **#4 + #5** (HyDE + CRAG) — add as new LangGraph nodes.
5. **#8** (eval suite) — do last in Phase 2 to validate all changes.

---

## Phase 3 — Long-term hardening (P3)

Deferred improvements. Lower urgency but high long-term value.

| # | Issue | Effort | Metric |
|---|---|---|---|
| 9 | [Embeddings + chunking upgrade](https://github.com/BongweKE/acAIcia/issues/9) | L (6–10d) | hit@1 +5pp; multilingual support |
| 10 | [Modularize app.py + cleanup](https://github.com/BongweKE/acAIcia/issues/10) | M (3–5d) | app.py < 200 lines |
| 11 | [Structured outputs + retries](https://github.com/BongweKE/acAIcia/issues/11) | S (2–3d) | Zero malformed-output failures |

**Phase 3 success criteria**:
- Embedding model upgraded to bge-m3 with parent-child chunking.
- `app.py` is routes-only; all logic in separate modules.
- Guardian/Architect use JSON mode with retries.

**Note**: #9 (embeddings) requires a re-embedding job (~30 min, ~$1)
and schema migration. Do this alongside #10 (modularization) for a
clean batch of infra changes.

---

## Cross-cutting concerns

These apply across all phases:

- **Testing**: add unit tests for each new module (LangGraph nodes,
  reranker, cache, etc.). Use `eval_runner.py` as the integration test.
- **CI gating**: Phase 2 introduces eval in CI. Phase 1 should add basic
  `pytest` to the deploy pipeline if not already present.
- **Documentation**: update `AGENTS.md` and `docs/` after each phase.
- **Monitoring**: after #7 (Langfuse), set up alerts for latency spikes,
  cost anomalies, and error rates.

---

## Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| LangGraph rewrite introduces regressions | High | Run eval_runner before/after; phase the migration (node-by-node). |
| LiteLLM has provider-specific bugs | Medium | Keep fallback to direct SDK calls; test all 4 providers. |
| bge-m3 re-embedding loses existing embeddings | High | Run re-embedding job in parallel; swap index atomically. |
| Langfuse self-hosted adds infra overhead | Low | Use Langfuse cloud (free tier) first; self-host only if needed. |
| CRAG adds latency for well-retrieved queries | Low | Only trigger re-retrieval when relevance < threshold. |

---

## Quick reference

```
Phase 1 (P1)     Phase 2 (P2)              Phase 3 (P3)
──────────────    ──────────────────────    ──────────────────────
#1  Streaming     #6  pgvector cache        #9  Embeddings upgrade
#2  LiteLLM       #7  Langfuse              #10 Modularize app.py
#3  Reranker      #12 LangGraph             #11 Structured outputs
                  #4  HyDE
                  #5  CRAG
                  #8  Eval suite
```
