# 02 — Improvement Opportunities

> Researched alternatives for each improvement theme, with technology choices,
> alternatives considered, tradeoffs, and effort estimates. Cross-references
> GitHub issues.

---

## Table of contents

1. [Streaming responses](#1-streaming-responses)
2. [LLM gateway (LiteLLM)](#2-llm-gateway-litellm)
3. [Cross-encoder reranker](#3-cross-encoder-reranker)
4. [HyDE / multi-query expansion](#4-hyde--multi-query-expansion)
5. [Corrective RAG (CRAG)](#5-corrective-rag-crag)
6. [Semantic cache → native pgvector](#6-semantic-cache--native-pgvector)
7. [LLM observability](#7-llm-observability)
8. [Eval suite (RAGAS / DeepEval)](#8-eval-suite-ragas--deepeval)
9. [Embeddings + chunking upgrade](#9-embeddings--chunking-upgrade)
10. [Deprecate & archive legacy Modal codebase](#10-deprecate--archive-legacy-modal-codebase)
11. [Structured outputs + retries](#11-structured-outputs--retries)
12. [LangGraph orchestration](#12-langgraph-orchestration)
13. [Fix Migration 005 (RLS & Security Invoker)](#13-fix-migration-005-rls--security-invoker)
14. [Admin CSV export 401 fix](#14-admin-csv-export-401-fix)
15. [Exact token telemetry](#15-exact-token-telemetry)
16. [Evaluation worker uncaught exception handling](#16-evaluation-worker-uncaught-exception-handling)
17. [Legacy Modal rollback security](#17-legacy-modal-rollback-security)
18. [Stale Modal endpoints in tooling](#18-stale-modal-endpoints-in-tooling)
19. [Shared query status store for multi-replica](#19-shared-query-status-store-for-multi-replica)
20. [Cost model refinements & clarifications](#20-cost-model-refinements--clarifications)

---

## 1. Streaming responses

**Issue**: [#1 — Streaming responses + replace file polling (SSE)](https://github.com/BongweKE/acAIcia/issues/1)

**Current state**: No streaming anywhere. The `POST /query` endpoint returns
immediately with a `query_id`, then the frontend polls `GET /query/status/{id}`
by reading an ephemeral JSON file from disk (`/tmp/acaicia_status/{query_id}.json` on
Railway). The file polling loop adds unnecessary latency jitter, consumes HTTP request
bandwidth, and forces the user to wait 15–45s before seeing a single character of output.
LLM providers (Mistral, Gemini, DeepSeek) support streaming natively.

**Proposed approach**:

- **FastAPI side**: Introduce a `POST /query/stream` endpoint on the Railway backend
  (`backend/server.py`) using `StreamingResponse(media_type="text/event-stream")` that yields SSE events.
  Each event carries `{ type: "stage"|"sources"|"chunk"|"done"|"error", payload }`.
  Retain the non-streaming polling endpoint as an automatic fallback for mobile or unstable connections.

- **Pipeline side**: Support `stream=True` in `call_llm` (`backend/core.py`) and
  `generate_answer` (`backend/pipeline.py`). Yield progress stages ("guardian",
  "architect", "retrieving", "synthesizing") and token chunks as they arrive.

- **Frontend side**: Update `ChatContext.tsx` and `api/client.ts` to consume the
  event stream via `fetch` + `ReadableStreamDefaultReader` or `@microsoft/fetch-event-source`.
  Render answer text progressively and display active stage pills in real time.

**Alternatives considered**:
- **WebSocket** — bidirectional, but SSE is simpler (unidirectional server→client),
  standard HTTP/2 friendly, and supported natively through Railway reverse proxies without
  requiring WebSocket connection upgrades.
- **Polling reduction (exponential backoff)** — reduces HTTP chatter, but leaves perceived
  latency unchanged at 15–45s.

**Tradeoffs**:
- SSE requires an open HTTP connection for the duration of the RAG pipeline (~20–45s).
  Railway and Uvicorn easily handle this with standard async ASGI workers.
- SSE handles network reconnects cleanly.
- Intermediate stage markers keep the user visually informed while vector retrieval runs.

**Effort**: MEDIUM (5–8 days). Backend streaming + frontend progressive rendering + fallback handling.

**Success metric**: Time-to-first-token on frontend drops from "wait for full
answer" (~15–45s) to <2s perceived latency. Polling requests eliminated for streaming clients.

---

## 2. LLM gateway (LiteLLM)

**Issue**: [#2 — Unified LLM gateway via LiteLLM with provider fallback](https://github.com/BongweKE/acAIcia/issues/2)

**Current state**: `call_llm()` in `backend/core.py:270` contains custom SDK code
for Mistral, Gemini, NVIDIA, and DeepSeek. There is no automatic fallback: if the primary
provider (currently Mistral on Railway) encounters a rate limit (429) or transient outage (503),
the entire request fails. Furthermore, usage tracking across different SDKs is normalized manually.

**Proposed approach**:

Replace bespoke provider calls with [LiteLLM](https://www.litellm.ai/), which
provides an OpenAI-compatible interface across 100+ LLM APIs:

```python
import litellm
response = litellm.completion(
    model="mistral/mistral-small-latest",
    fallbacks=["gemini/gemini-2.5-flash", "deepseek/deepseek-chat"],
    messages=[...],
    stream=True,
)
```

- **Automatic fallback cascade**: configure primary `mistral/mistral-small-latest` with
  automatic fallback to `gemini/gemini-2.5-flash` or `deepseek/deepseek-chat` on 429/503 errors.
- **Unified usage tracking**: `litellm.completion()` returns standardized `usage.prompt_tokens`
  and `usage.completion_tokens` across all providers, directly supporting Issue #15.
- **Cost estimation**: leverage LiteLLM's model cost map to track exact expenditures per query.

**Alternatives considered**:
- **OpenRouter** — commercial gateway, similar abstraction but adds an external vendor and billing markup.
- **Custom adapter class** — zero external dependencies, but requires maintaining custom retry and schema adapters for each provider.
- **Semantic Router** — overkill for our fixed pipeline; this is a resilience/fallback requirement, not dynamic query classification.

**Tradeoffs**:
- LiteLLM is a Python in-process library, requiring no external proxy container.
- Adds a dependency, but is widely adopted and maintained.
- Normalizes `stream=True` across providers, simplifying SSE implementation (#1).

**Effort**: MEDIUM (3–5 days). Drop-in replacement for `backend/core.py:call_llm`, configure fallback cascades, and test all provider API keys.

**Success metric**: Zero query failures when primary provider experiences simulated 429/500 errors (automatic fallback executes in <1s). Unified token and cost metrics in telemetry.

---

## 3. Cross-encoder reranker

**Issue**: [#3 — Cross-encoder reranker for hybrid retrieval](https://github.com/BongweKE/acAIcia/issues/3)

**Current state**: Hybrid retrieval returns top-5 chunks. No reranking step.
The final ranking is the RRF fusion score, which is a coarse signal. Synthesis
receives whatever the DB returns.

**Proposed approach**:

Add a cross-encoder reranker between retrieval and synthesis:

```
hybrid retrieval (top 10) → cross-encoder rerank (top 5) → synthesis
```

- **Model**: `BAAI/bge-reranker-v2-m3` (multilingual, 568M params, runs on
  CPU or T4). Or Cohere Rerank API (hosted, no GPU needed, 0.002$/query).
- **Integration**: a `rerank_chunks(query, chunks, top_k)` function called
  after retrieval, before synthesis. Paired scoring: query × each chunk_text.
- **Latency**: local model ~200ms for 10 chunks; Cohere ~100ms (network).
- **Accuracy gain**: cross-encoders significantly outperform bi-encoders
  (bge-base) for final relevance ranking; typical MRR@5 improvement of 10–20%.

**Alternatives considered**:
- **bge-reranker-v2-gemma** — larger (7B params), higher accuracy but 4–8x
  slower, needs GPU.
- **Cohere Rerank v3** — hosted, best accuracy, but adds vendor dependency
  and per-query cost.
- **ColBERT (late interaction)** — hybrid bi-encoder+late-interaction; good
  accuracy but heavier infra change.
- **No reranking** — cheapest; current approach works well enough for the
  use case (focused academic queries over domain-specific corpus).

**Tradeoffs**:
- Local reranker adds ~200ms latency but no network cost.
- Cohere adds ~$0.002/query but zero infra (runs in FastAPI container, no GPU).
- The `eval_runner.py` hit@1/hit@5 harness directly measures the improvement.
- Batching is important: if 10 chunks, batch all pairs into one forward pass.

**Effort**: LOW (2–3 days). ~100 lines of Python, one new dependency.

**Success metric**: `hit@1` from `eval_runner.py` improves by ≥ 5 percentage
points. `hit@5` remains ≥ 95%.

---

## 4. HyDE / multi-query expansion

**Issue**: [#4 — Query-expansion improvements (HyDE / multi-query)](https://github.com/BongweKE/acAIcia/issues/4)

**Current state**: Architect rewrites the query into a single entity-dense
search query. No HyDE, no multi-query. The rewritten query is embedded
directly via bge-base.

**Proposed approaches**:

### 4a. HyDE (Hypothetical Document Embeddings)

Generate a hypothetical answer to the query, embed the *answer*, and use
that for retrieval instead of the query itself. The intuition: answers are
closer to documents in embedding space than questions are.

```
Query → LLM generates hypothetical answer → embed answer → vector search
```

- **Latency**: adds one LLM call (~500ms for Flash Lite) before retrieval.
- **Accuracy**: typically 5–15% nDCG improvement on open-domain QA.
- **Works well for**: abstract/conceptual queries ("what are the tradeoffs of
  peatland drainage?").

### 4b. Multi-query expansion

Generate N variant queries from the original, retrieve for each, merge+dedup.

```
Query → LLM generates 3 variants → embed each → retrieve top-5 each → merge → rerank
```

- **Latency**: 3× embedding + retrieval, or parallelize with `asyncio.gather`.
- **Accuracy**: catches recall gaps from a single query rewrite.
- **Works well for**: complex/multi-faceted queries.

### Recommendation

Start with **HyDE only** — simpler, single LLM call, measurable via
`eval_runner.py`. Multi-query is additive and can layer on top.

**Tradeoffs**:
- HyDE requires the LLM to generate a plausible answer — if the query is
  highly specialized, the hypothetical answer may be hallucinated and hurt
  retrieval. A relevance gate (CRAG, #5) mitigates this.
- Both add latency; streaming (#1) partially masks it.

**Effort**: LOW–MEDIUM (2–4 days).

**Success metric**: `hit@1` improves by ≥ 3pp with HyDE alone (measured via
`eval_runner.py` with and without HyDE on the 20 eval pairs).

---

## 5. Corrective RAG (CRAG)

**Issue**: [#5 — Corrective RAG (CRAG) relevance gate before synthesis](https://github.com/BongweKE/acAIcia/issues/5)

**Current state**: Synthesis always runs with whatever chunks retrieval
returns. No relevance gate. No fallback to web search or different retrieval
strategy if chunks are irrelevant.

**Proposed approach**:

Add a lightweight relevance evaluator between retrieval and synthesis:

```
retrieved chunks → relevance_score = LLM judges chunk relevance to query
    IF score < threshold:
        → extract key terms → re-retrieve with different query
        → OR degrade gracefully (answer with caveat)
    IF score ≥ threshold:
        → proceed to synthesis
```

This is based on the "Corrective RAG" (CRAG) pattern from the paper:
"Corrective Retrieval Augmented Generation" (Yan et al., 2024).

- **Relevance evaluator**: a fast LLM call (Flash Lite, ~300ms) that scores
  each chunk as "Relevant", "Ambiguous", or "Irrelevant".
- **Action**:
  - All relevant → proceed normally.
  - Mix of relevant + irrelevant → filter out irrelevant, proceed with
    remaining.
  - Mostly irrelevant → trigger a query rewrite + re-retrieve, or degrade
    with a "limited evidence" caveat in the answer.
- **Web search fallback** (optional): if chunks are poor, fall back to a
  web search via Tavily/SerpAPI for grounding (adds latency + cost).

**Alternatives considered**:
- **Self-RAG** (Asai et al., 2023) — more complex: interleaves retrieval
  and generation with reflection tokens. Overkill for this pipeline.
- **IRCoT** (Trivedi et al., 2023) — interleaves chain-of-thought with
  retrieval. Good for multi-hop questions but adds significant latency.

**Tradeoffs**:
- Adds one LLM call (~300ms) for relevance scoring.
- Re-query path adds 1–3s latency but prevents hallucinated answers.
- Web search fallback adds external dependency + cost.
- Effectiveness depends on the corpus: for 693 documents, retrieval is
  already decent; CRAG adds the most value for out-of-scope queries.

**Effort**: MEDIUM (4–6 days). Relevance evaluator + re-query logic + test.

**Success metric**: Production eval faithfulness scores improve by ≥ 0.05
(averaged across sampled queries). Guardian FAIL rate remains stable.

---

## 6. Semantic cache → native pgvector

**Issue**: [#6 — Semantic cache → native pgvector HNSW query](https://github.com/BongweKE/acAIcia/issues/6)

**Current state**: Cache lookup pulls up to 200 rows from `semantic_cache` into
Python memory, parses comma-separated embedding strings via `np.fromstring()`,
and computes cosine similarity in a loop (`backend/core.py:180-230`). Embeddings are
stored as text strings due to an earlier "pgvector text corruption" workaround when storing raw
`list[float]`. The `match_semantic_cache` RPC is documented in schema docs but unused.

**Proposed approach**:

1. Fix the pgvector storage: use `Vector` type directly via Supabase's
   `pg_vector` insert, not raw SQL string interpolation.
2. Store embeddings as a proper `vector(768)` column in `semantic_cache`.
3. Use an HNSW index on the embedding column (`vector_cosine_ops`).
4. Query via RPC: `SELECT * FROM match_semantic_cache($1, $2, $3)` where
   `$1` = query_embedding, `$2` = threshold, `$3` = topic_category.
5. Remove the Python brute-force loop and numpy dependency entirely.

**Alternatives considered**:
- **Redis vector store** — faster in-memory, but adds another external dependency
  and the cache does not need sub-millisecond lookup.
- **In-memory dict** (the unused `ram_cache`) — cannot persist across container restarts or replicas.
- **Keep Python-side** — works at 200 rows but degrades linearly as cache grows past 1,000 entries.

**Tradeoffs**:
- Native pgvector query is O(log n) via HNSW vs O(n) Python memory scan.
- At 200 rows the difference is negligible; this becomes critical at 10k+ cache entries.
- Eliminates the comma-string hack, which is a maintenance burden and correctness risk.
- One fewer Python dependency (numpy was used primarily for this loop).

**Effort**: LOW (2–3 days). Fix storage type, create HNSW index, wire RPC, remove Python loop.

**Success metric**: Cache lookup latency remains <15ms at 10k+ entries. The comma-string workaround and `np.fromstring` code is eliminated.

---

## 7. LLM observability

**Issue**: [#7 — LLM observability (Langfuse / OpenTelemetry)](https://github.com/BongweKE/acAIcia/issues/7)

**Current state**: Telemetry is logged to Supabase `query_interaction_logs`
and `evaluation_runs` tables. This covers query-level metrics (tokens, latency,
cost) but not granular per-LLM-call traces (individual prompt sent, response received,
retry count, provider latency breakdown). Debugging an individual query requires manual SQL queries
over Supabase or parsing Railway container stdout logs.

**Proposed approach**:

Adopt **[Langfuse](https://langfuse.com/)** (self-hosted or cloud) or
**[Phoenix](https://phoenix.arize.com/)** (Arize, OSS):

- **Langfuse**: decorator-based tracing. Wrap each LLM call with
  `@observe()` decorator. Each trace captures the prompt, response, latency,
  token count, and cost. Supports LiteLLM natively and plain SDK calls.
  Self-hosted via Docker or use their cloud tier.
- **Phoenix**: OSS, OpenTelemetry-based, works with LlamaIndex and custom
  instrumentation. Lighter than Langfuse but less feature-rich for prompt management.

Integration sketch (Langfuse):

```python
from langfuse.decorators import observe

@observe(as_type="generation")
def call_llm(prompt, provider):
    response = litellm.completion(model=provider, messages=prompt)
    return response
```

- Each `process_query_async` call creates a parent trace.
- Guardian, Architect, and Synthesis are child spans.
- Retrieval is a span capturing the rewritten query and returned chunk IDs.
- Cache hit/miss is an attribute on the trace.

**Alternatives considered**:
- **LangSmith** — closed-source, tightly coupled to LangChain ecosystem; vendor lock-in.
- **OpenTelemetry manual** — flexible but requires significantly more plumbing.
- **Custom Supabase tables** — already done; does not provide visual per-call waterfall traces.

**Tradeoffs**:
- Langfuse cloud is free for <50k observations/month (sufficient for this project).
- Self-hosted Langfuse requires a Postgres + Redis instance (extra infra).
- Phoenix is OSS-only, lighter, but less polished UI.
- Both add <1ms overhead per call (decorator-based).

**Effort**: MEDIUM (3–5 days). Add decorators, configure Langfuse project keys, wire frontend links to traces.

**Success metric**: Every LLM call is visible in Langfuse with prompt, response, latency, and cost. Developers can diagnose pipeline bottlenecks in <2 minutes.

---

## 8. Eval suite (RAGAS / DeepEval)

**Issue**: [#8 — Automated CI evaluation suite (DeepEval / RAGAS) + regression gate](https://github.com/BongweKE/acAIcia/issues/8)

**Current state**: Evaluations are executed on-demand via the Admin UI (`/admin`) or
the `tests/deepeval_suite.py` script. Production eval uses 3 custom LLM-as-judge prompts
(faithfulness, relevance, completeness). No CI gating exists — code can be merged to `main`
and deployed to Railway without verifying that prompt or retrieval changes didn't degrade answer quality.

**Proposed approach**:

Wire **[DeepEval](https://docs.confident-ai.com/)** or **[RAGAS](https://docs.ragas.io/)** into GitHub Actions CI:

- **DeepEval**: first-class Python test integration via `pytest`. Provides `FaithfulnessMetric`,
  `AnswerRelevancyMetric`, `ContextualPrecisionMetric`, and `ContextualRecallMetric`.
- **CI Gate**: GitHub Actions runs `pytest tests/deepeval_suite.py` against a smoke subset (10 benchmark questions)
  on every pull request.
- **Baseline Enforcement**: Compare results against `tests/eval_baseline.json`. Automatically fail the PR
  if Faithfulness drops > 0.05 or Canary questions trigger violations.

Integration:

```python
from deepeval.metrics import FaithfulnessMetric, AnswerRelevancyMetric
from deepeval.test_case import LLMTestCase

def test_pipeline_faithfulness():
    test_case = LLMTestCase(input=q, actual_output=a, retrieval_context=c)
    metric = FaithfulnessMetric(threshold=0.85)
    assert_test(test_case, [metric])
```

**Alternatives considered**:
- **Promptfoo** — prompt-level evaluation, less tailored for RAG context verification.
- **Manual eval only** — does not scale and allows stealth regressions into production.

**Tradeoffs**:
- Adds a small LLM cost during CI runs (~$0.02 per PR test run).
- Requires managing an API key in GitHub Actions repository secrets.
- Prevents stealth regressions from reaching production.

**Effort**: MEDIUM (4–6 days). Migrate test runner, set up CI workflow, establish baseline thresholds.

**Success metric**: CI blocks any pull request that degrades baseline Faithfulness or Recall by > 0.05. Zero canary hallucinations reach production.

---

## 9. Embeddings + chunking upgrade

**Issue**: [#9 — Embeddings + chunking upgrade (`BAAI/bge-m3` + parent-child)](https://github.com/BongweKE/acAIcia/issues/9)

**Current state**:
- Embedding: `BAAI/bge-base-en-v1.5` (768 dims, English-only, 512 max tokens).
- Chunking: LangChain `RecursiveCharacterTextSplitter` (2500 chars, 250 overlap).
- No parent-child / hierarchical chunking.
- Research corpus contains multilingual manuscripts (Spanish, French, Indonesian) that are currently poorly matched by English-only embeddings.

**Proposed approaches**:

### 9a. Embedding model upgrade

| Model | Dims | Max Tokens | Multilingual | Params |
|---|---|---|---|---|
| bge-base-en-v1.5 (current) | 768 | 512 | No | 109M |
| bge-m3 | 1024 | 8192 | Yes (100+) | 568M |
| text-embedding-3-small (OpenAI) | 1536 | 8191 | Yes | ~100M (est) |
| jina-embeddings-v3 | 1024 | 8192 | Yes | 570M |

**Recommendation**: `bge-m3` — supports dense + sparse + ColBERT in one model,
multilingual (crucial for CIFOR-ICRAF's global research remit), 8192 token
context window (captures full publication sections without truncation).

### 9b. Chunking upgrade

- **Parent-child chunking**: small child chunks (500 chars) for precise
  vector retrieval, returning the larger parent chunk (2500 chars) as context for
  synthesis. Delivers both precision and rich context.
- **Semantic chunking**: split at semantic topic boundaries rather than fixed character counts.

**Tradeoffs**:
- Re-embedding 176k chunks requires a dedicated batch job (~1–2 hours).
- Parent-child requires storing both child and parent embeddings, plus the
  parent-child foreign key relationship.
- `bge-m3` is 5× larger than `bge-base`; inference is slower (~100ms vs ~20ms per query on CPU).

**Effort**: HIGH (6–10 days). New model integration, re-embedding pipeline, schema migration, parent-child plumbing.

**Success metric**: `hit@1` improves by ≥ 5pp. Retrieval recall for multilingual queries (Spanish/French) improves by ≥ 10pp.

---

## 10. Deprecate & archive legacy Modal codebase

**Issue**: [#10 — Deprecate & archive legacy Modal codebase (`app.py`, `gemma_inference.py`)](https://github.com/BongweKE/acAIcia/issues/10)

**Current state**: The active production backend was migrated to Railway in commit `7fa6ff7`
(`backend/server.py`, `backend/pipeline.py`, `backend/core.py`, `backend/config.py`).
However, `backend/app.py` (2,000+ lines) and `backend/gemma_inference.py` are retained at the root
of `backend/` strictly for emergency Modal rollback per ADR 0009. Maintaining dual backends
creates code drift, developer confusion, and dead infrastructure references.

**Proposed approach**:

Once the Railway backend demonstrates 99.9% uptime over 90 days of production traffic:
1. Move `backend/app.py` and `backend/gemma_inference.py` into an `archive/legacy_modal/` directory.
2. Remove Modal-specific secrets, GitHub actions, and deployment scripts from active paths.
3. Keep root `backend/` clean and focused exclusively on the Railway FastAPI architecture.

**Alternatives considered**:
- **Delete immediately** — risks losing rollback capability if Railway experiences extended outages before stability is proven.
- **Keep indefinitely** — creates continuous maintenance debt and risk of unauthenticated endpoint drift (as seen in Issue #17).

**Tradeoffs**:
- Low effort, high hygiene benefit once Railway stability is established.

**Effort**: LOW (2–3 days). Move files to archive, remove unused scripts, update documentation.

**Success metric**: Root `backend/` contains only active Railway modules (`server.py`, `pipeline.py`, `core.py`, `config.py`, `evaluation_engine.py`). Zero legacy Modal maintenance overhead.

---

## 11. Structured outputs + retries

**Issue**: [#11 — Structured outputs + retries for Guardian/Architect](https://github.com/BongweKE/acAIcia/issues/11)

**Current state**: Guardian and Architect return free-text responses parsed via
substring matching (`"PASS"` or `"FAIL"`) or regex patterns. While functional,
string parsing is brittle when models change output phrasing or add conversational filler.
No structured JSON validation or automatic retry loop exists.

**Proposed approach**:

- **Guardian**: enforce JSON schema via Mistral / LiteLLM structured outputs:
  `{"decision": "PASS"|"FAIL", "reasoning": "..."}`. Eliminates string parsing.
- **Architect**: enforce JSON schema:
  `{"rewritten_query": "...", "key_entities": ["..."]}`. Deterministic extraction.
- **Retries**: if the LLM returns invalid JSON or fails schema validation, retry up to 2×
  with a schema correction prompt.
- **Temperature**: enforce `temperature=0` for Guardian and Architect (deterministic),
  and `temperature=0.3` for Synthesis.

**Alternatives considered**:
- **Tool/function calling** — supported by some providers, but adds unnecessary protocol overhead for single-output classification/rewrite tasks.
- **Keep regex parsing** — fragile across model updates.

**Tradeoffs**:
- Schema validation adds ~50ms per call.
- Retries add latency only in error paths, but prevent pipeline aborts.

**Effort**: LOW (2–3 days). Define Pydantic response models, configure schema enforcement, add retry loops.

**Success metric**: Zero pipeline failures from malformed Guardian or Architect outputs over 1,000 production queries.

---

## 12. LangGraph orchestration

**Issue**: [#12 — Re-architect pipeline with LangGraph](https://github.com/BongweKE/acAIcia/issues/12)

**Current state**: The pipeline in `backend/pipeline.py` is procedural Python with manual
thread pools (`ThreadPoolExecutor` for Guardian + Architect), inline error handling, and
ad-hoc stage transitions. While functional, procedural code becomes unwieldy when adding
conditional branches (HyDE, CRAG, reranking) and per-node retries.

**Proposed approach**:

Refactor `backend/pipeline.py` into a directed state graph using
**[LangGraph](https://langchain-ai.github.io/langgraph/)**:

```python
from langgraph.graph import StateGraph, END

graph = StateGraph(RAGState)
graph.add_node("classify_topic", classify_topic_node)
graph.add_node("check_cache", check_cache_node)
graph.add_node("guardian", guardian_node)
graph.add_node("architect", architect_node)
graph.add_node("retrieve", retrieve_node)
graph.add_node("rerank", rerank_node)       # if #3 is done
graph.add_node("relevance_gate", crag_node) # if #5 is done
graph.add_node("synthesize", synthesize_node)
graph.add_node("evaluate", eval_node)

graph.set_entry_point("classify_topic")
graph.add_edge("classify_topic", "check_cache")
graph.add_conditional_edges("check_cache", cache_decision)
graph.add_edge("guardian", "architect")
graph.add_edge("architect", "retrieve")
graph.add_edge("retrieve", "rerank")
graph.add_conditional_edges("rerank", relevance_decision)
graph.add_edge("synthesize", "evaluate")
graph.add_edge("evaluate", END)
```

- **State**: `TypedDict` carrying `query`, `topic`, `chunks`, `answer`, `telemetry`.
- **Conditional edges**: cache hit → skip retrieval; guardian FAIL → return error immediately; relevance gate → re-query or synthesize.
- **Streaming**: LangGraph natively supports event streaming (`astream_events`).
- **Checkpoints**: persist state for multi-turn conversational recovery.
- **Node-level retries**: built-in retry policies for transient network/LLM errors.

**Alternatives considered**:
- **LlamaIndex QueryPipeline** — RAG-focused but less flexible for custom multi-agent branching.
- **Keep procedural Python** — works today, but scales poorly as more conditional nodes (HyDE, CRAG) are added.

**Tradeoffs**:
- Adds `langgraph` dependency and architectural learning curve.
- Makes pipeline branching explicit, visualizable, and independently testable per node.

**Effort**: HIGH (8–12 days). Rewrite pipeline as a graph, migrate all node logic, test edge cases.

**Success metric**: All existing eval scores preserved. Unlocks per-stage event streaming, conditional re-retrieval, node-level retries, and checkpoint resumption.

---

## 13. Fix Migration 005 (RLS & Security Invoker)

**Issue**: [#13 — Fix Migration 005 (RLS & Security Invoker) + Apply to Supabase](https://github.com/BongweKE/acAIcia/issues/13)

**Current state**: `database/migrations/005_evaluation_system.sql` introduces `evaluation_details`, `canary_questions`, and the view `evaluation_score_trends`. However, the migration was never executed in production Supabase. Furthermore, if executed as-is:
1. `evaluation_details` and `canary_questions` omit `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`, directly violating [ADR 0010](../docs/adrs/0010-database-security-posture-rls-deny-by-default.md) which requires deny-by-default on all public tables.
2. The view `evaluation_score_trends` is defined without `WITH (security_invoker = true)`, which can bypass caller permission boundaries and triggers Supabase security audit warnings.
3. Because the migration was never run, background evaluation runs cannot persist detail rows or retrieve active canaries from the database.

**Proposed approach**:
- Update `database/migrations/005_evaluation_system.sql`:
  - Append `ALTER TABLE evaluation_details ENABLE ROW LEVEL SECURITY;`
  - Append `ALTER TABLE canary_questions ENABLE ROW LEVEL SECURITY;`
  - Define `CREATE OR REPLACE VIEW evaluation_score_trends WITH (security_invoker = true) AS ...`
- Apply the updated migration via Supabase SQL Editor.
- Verify that table RLS is active with zero public access policies, allowing only the backend `service_role` key to read/write.

**Alternatives considered**:
- *Creating a separate `005b` migration*: Since 005 was never run in production, modifying 005 directly ensures clean, immutable migration tracking without intermediate broken states.

**Tradeoffs**:
- Requires Supabase project owner execution via dashboard or service role script.

**Effort**: LOW (0.5 days).

**Success metric**: 100% ADR 0010 compliance verified via Supabase security linter; evaluation details successfully persist during admin runs.

---

## 14. Admin CSV export 401 fix

**Issue**: [#14 — Fix Admin CSV Export 401 Unauthorized via Query Param Auth](https://github.com/BongweKE/acAIcia/issues/14)

**Current state**: In `frontend/src/api/client.ts:216`, `getExportCsvUrl` sets `?authorization=Bearer ${key}` in query parameters for direct browser file downloads via `window.open` or anchor links. In `backend/server.py:1054`, `export_query_logs_csv` only reads `authorization: Optional[str] = Header(default=None)`. The header is `None`, so `_require_admin` throws HTTP 401 Unauthorized.

**Proposed approach**:
- Modify `export_query_logs_csv` in `backend/server.py` (and `backend/app.py` legacy) to accept:
  ```python
  authorization: Optional[str] = Header(default=None),
  auth_token: Optional[str] = Query(default=None, alias="authorization"),
  ```
- Check `token = authorization or auth_token` before invoking `_require_admin(token)`.
- Strip optional `"Bearer "` prefix if present in the query string.

**Alternatives considered**:
- *Client-side blob fetch*: Use `fetch()` with the Authorization header, convert to blob, and trigger a client-side object URL download (`URL.createObjectURL(blob)`). While feasible, supporting query param auth in backend is the standard REST pattern for browser streaming downloads and requires minimal code changes.

**Tradeoffs**:
- Tokens in query parameters can appear in server access logs; mitigated because Railway access logs are private and credentials rotate.

**Effort**: LOW (0.5 days).

**Success metric**: Zero 401 Unauthorized errors when downloading CSV export from `/admin` dashboard.

---

## 15. Exact token telemetry

**Issue**: [#15 — Exact Token Telemetry & Eliminate Heuristic 50/50 Token Split](https://github.com/BongweKE/acAIcia/issues/15)

**Current state**: In `backend/core.py`, `call_llm` discards `prompt_tokens` and `completion_tokens` returned by LLM SDKs, storing only `total_tokens`. In `backend/pipeline.py:498`, synthesis tokens are split 50/50 (`estimated_input = max(0, total_tokens - synth_res.get("tokens", 0) // 2)`, `estimated_output = synth_res.get("tokens", 0) // 2`).
In Mistral Small, output tokens cost $0.60/M while input tokens cost $0.15/M (4x difference). A typical RAG query contains ~2,500 input prompt tokens and ~500 output tokens. The 50/50 heuristic estimates ~1,500 output tokens (+300% inflation), skewing cost telemetry in `query_interaction_logs` and invalidating live cost probes in `docs/cost_model.md`.

**Proposed approach**:
- Update `call_llm` in `backend/core.py` to parse and return:
  `{"text": text, "tokens": total_tokens, "prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens}`
- In `backend/pipeline.py`, sum exact `prompt_tokens` and `completion_tokens` across Guardian, Architect, and Synthesis agents.
- Calculate query cost using exact input and output counts:
  `cost = (total_prompt_tokens * INPUT_RATE + total_completion_tokens * OUTPUT_RATE) / 1_000_000`.

**Alternatives considered**:
- *Client-side token estimation via tiktoken*: Inaccurate for Mistral and adds CPU overhead. Extracting native usage from the API response is exact and free.

**Tradeoffs**:
- None. API responses already carry token usage metadata.

**Effort**: LOW (1 day).

**Success metric**: `query_interaction_logs` records exact input and output token counts; calculated query costs match billing invoices to within $0.0001.

---

## 16. Evaluation worker uncaught exception handling

**Issue**: [#16 — Fix Evaluation Background Worker Uncaught Exception Handling](https://github.com/BongweKE/acAIcia/issues/16)

**Current state**: In `backend/server.py:858`, `_run_evaluation_job` runs in a background thread spawned by `trigger_evaluation`. If an unhandled exception occurs (e.g., Supabase network failure, Mistral rate limit 429, missing migration table), the thread catches `err`, logs it, and terminates. The record in `evaluation_runs` remains with `status = 'running'`.
In `frontend/src/components/admin/EvaluationsTab.tsx`, the polling loop checks for `status === 'completed' || status === 'failed'`. Since the status never changes, the UI hangs indefinitely with a loading spinner.

**Proposed approach**:
- In `_run_evaluation_job`, update the `except Exception as err:` block to persist the failure:
  ```python
  except Exception as err:
      logger.error("Evaluation background thread failed for run %s: %s", run_id, err, exc_info=True)
      try:
          supabase.table("evaluation_runs").update({
              "status": "failed",
              "details": {"error": str(err), "failed_at": datetime.now(tz.utc).isoformat()}
          }).eq("run_id", run_id).execute()
      except Exception as db_err:
          logger.error("Failed to update evaluation_runs status to failed: %s", db_err)
  ```
- Ensure frontend displays error details if run status is `'failed'`.

**Alternatives considered**:
- *Polling timeout in frontend*: Useful as a defense-in-depth safeguard, but backend must explicitly report failure states.

**Tradeoffs**:
- None.

**Effort**: LOW (0.5 days).

**Success metric**: Zero infinite loading hangs in Admin UI during evaluation errors; clear error messages displayed.

---

## 17. Legacy Modal rollback security

**Issue**: [#17 — Secure Legacy Modal Rollback POST /settings with Admin Auth](https://github.com/BongweKE/acAIcia/issues/17)

**Current state**: `backend/app.py:1342` defines `update_settings(request: SettingsRequest)` with no authentication check. In contrast, Railway backend (`backend/server.py:673`) enforces `_require_admin(authorization)`. If the team executes the rollback runbook in `docs/railway_migration.md` to re-enable Modal, the settings endpoint would be exposed to the public internet without authentication, allowing unauthorized model switching.

**Proposed approach**:
- Add `authorization: Optional[str] = Header(default=None)` to `update_settings` in `backend/app.py`.
- Call `_require_admin(authorization)` before writing to `/data/settings.json`.

**Alternatives considered**:
- *Delete `backend/app.py` immediately*: Modal deployment is the only tested rollback target if Railway experiences extended outages. Securing it preserves safe rollback capability.

**Tradeoffs**:
- None.

**Effort**: LOW (0.2 days).

**Success metric**: Unauthenticated requests to `POST /settings` on legacy Modal backend return HTTP 401.

---

## 18. Stale Modal endpoints in tooling

**Issue**: [#18 — Update Stale Modal Backend URLs in Dev & Test Tooling](https://github.com/BongweKE/acAIcia/issues/18)

**Current state**: `tests/deepeval_suite.py:52` and `cli_admin.py:193` default to `https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run`. Because Modal disabled the workspace after exceeding spend caps, running tests or CLI scripts fails with network errors unless developers manually configure environment variables.

**Proposed approach**:
- Update default fallback URLs in `tests/deepeval_suite.py` and `cli_admin.py` to point to the active Railway backend (`https://acaicia-backend-production.up.railway.app`).
- Keep environment variable overrides (`BACKEND_URL` / `ACAICIA_BACKEND_URL`) intact.

**Alternatives considered**:
- *Require environment variable with no default*: Causes friction for new developers running test suites.

**Tradeoffs**:
- None.

**Effort**: LOW (0.2 days).

**Success metric**: Running `python cli_admin.py metrics` and `pytest tests/deepeval_suite.py` works out of the box without manual URL overrides.

---

## 19. Shared query status store for multi-replica

**Issue**: [#19 — Shared Query Status Store (Supabase/Redis) for Multi-Replica Scaling](https://github.com/BongweKE/acAIcia/issues/19)

**Current state**: In `backend/server.py`, query status is tracked via ephemeral JSON files in `/tmp/acaicia_status/{query_id}.json`. When scaling beyond 100 users (Phase 2), Railway will run 2+ backend replicas behind a load balancer. A client polling `GET /query/status/{query_id}` may hit Replica B while Replica A is executing the query, resulting in false 404s or stale stage indicators.

**Proposed approach**:
- **Option A (Supabase table)**: Add a `query_jobs` table in Supabase with columns `query_id`, `status`, `stage`, `response`, `sources`, `cache_hit`, `updated_at`. Both replicas read and write to this table.
- **Option B (Railway Redis)**: Attach a managed Redis service in Railway. Store query status with a 1-hour TTL (`SET acaicia:query:{query_id} ... EX 3600`).
- Recommendation: Redis for high-frequency low-latency updates (Phase 2); Supabase table as intermediate step if Redis adds infrastructure cost.

**Alternatives considered**:
- *Sticky sessions on Railway*: Load balancer sticky sessions route polling requests to the same replica, but fail if containers restart or rebalance during a 45s query. Shared store is fundamentally more resilient.

**Tradeoffs**:
- Redis adds ~$5–10/mo in Railway infrastructure; Supabase table adds database write I/O.

**Effort**: MEDIUM (3–4 days).

**Success metric**: Query status is 100% accessible across multiple backend containers with zero 404 polling errors under simulated multi-replica load.

---

## 20. Cost model refinements & clarifications

**Issue**: [#20 — Cost Model Refinements: Cache Progression, Multi-Replica Overages, Mistral Seat](https://github.com/BongweKE/acAIcia/issues/20)

**Current state**: `docs/cost_model.md` models Railway cost as flat $20 across all phases (10 → 500 users). In reality, scaling to 2+ backend replicas consumes additional RAM ($10/GB-mo) and vCPU ($20/vCPU-mo), exceeding Railway Pro's included $20 credit.
Additionally, the model treats cache hit rate as static, omitting the natural progression from 10% (launch) to 30% (corpus maturity). Lastly, the $24.99/mo Mistral Team seat fee needs re-evaluation against the pay-as-you-go developer API tier.

**Proposed approach**:
- Revise `docs/cost_model.md`:
  - **Railway Compute**: Add replica scaling breakdown ($20 base + $15/replica/mo for 2+ replicas in Phases 2–4).
  - **Cache Hit Progression**: Document savings progression (10% at launch → 20% at 100 users → 30% at 500 users), showing reduced effective per-query cost.
  - **Mistral Seat Analysis**: Detail tradeoffs between Mistral Team Seat ($24.99/mo with workspace role management) vs Pay-As-You-Go API tier (saves ~$300/yr for single-key deployments).
- Update Mermaid charts in `docs/cost_model.md` to reflect revised multi-replica cost curves.

**Alternatives considered**:
- *Keep simple flat estimates*: Undershoots budget expectations when scaling to high-availability multi-replica environments.

**Tradeoffs**:
- Slightly more complex pricing table, but significantly more realistic financial guidance for leadership.

**Effort**: LOW (1 day).

**Success metric**: Cost model accurately reflects multi-replica infrastructure pricing, cache compounding gains, and subscription options.

