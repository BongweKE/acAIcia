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
6. [LangGraph orchestration](#6-langgraph-orchestration)
7. [Semantic cache → native pgvector](#7-semantic-cache--native-pgvector)
8. [LLM observability](#8-llm-observability)
9. [Eval suite (RAGAS / DeepEval)](#9-eval-suite-ragas--deepeval)
10. [Embeddings + chunking upgrade](#10-embeddings--chunking-upgrade)
11. [Modularize app.py + cleanup](#11-modularize-apppy--cleanup)
12. [Structured outputs + retries](#12-structured-outputs--retries)

---

## 1. Streaming responses

**Issue**: [#1 — Streaming responses + replace volume-file polling](https://github.com/BongweKE/acAIcia/issues/1)

**Current state**: No streaming anywhere. The `POST /query` endpoint returns
immediately with a `query_id`, then the frontend polls `GET /query/status/{id}`
by reading a JSON file from a Modal Volume. The volume read/write round-trip
adds latency and the polling model is inherently wasteful. All providers
(Gemini, NVIDIA, DeepSeek, Gemma via vLLM) support streaming natively.

**Proposed approach**:

- **FastAPI side**: Use `@modal.fastapi_endpoint()` (already in use) with a
  `StreamingResponse` / `text/event-stream` endpoint that yields SSE events.
  Each event carries `{ type: "chunk"|"stage"|"done"|"error", payload }`.
  Alternatively, use a `modal.Dict`-backed job queue to decouple the LLM
  pipeline from the HTTP connection (more resilient to cold starts).

- **Modal side**: `generate_content(stream=True)` for all providers. Yield
  chunks as they arrive. Track `stage` ("architect", "retrieving", "synthesizing")
  in the stream.

- **Frontend side**: Replace the polling loop in `ChatContext.tsx` with
  `EventSource` / `fetch` + `ReadableStream`. Render answer progressively.
  Show stage indicators ("Searching...", "Generating...").

**Alternatives considered**:
- **WebSocket** — bidirectional, but SSE is simpler (unidirectional server→client)
  and the frontend doesn't need to send data mid-stream.
- **Modal async job + poll `modal.Dict`** — decouples LLM from HTTP timeout,
  but adds one more polling hop. Better than Volume files but still not streaming.
  Good as a fallback for cold-start resilience.

**Tradeoffs**:
- `modal.fastapi_endpoint()` with streaming keeps it in one system but requires
  the endpoint to stay alive for the duration (~30–90s). Modal Functions have
  a 5-minute timeout (configurable).
- SSE is simpler to debug than WebSocket; browser `EventSource` handles
  reconnection automatically.
- Cold-start latency for Gemma (30s) is still real — SSE lets the UI show
  "warming up" feedback instead of a blank screen.

**Effort**: MEDIUM (5–8 days). Backend streaming + frontend re-render + testing
all providers' `stream=True` behavior.

**Success metric**: Time-to-first-token on frontend drops from "wait for full
answer" (~15–45s) to <2s perceived latency. Polling requests eliminated.

---

## 2. LLM gateway (LiteLLM)

**Issue**: [#2 — Unified LLM gateway via LiteLLM with provider fallback](https://github.com/BongweKE/acAIcia/issues/2)

**Current state**: `call_llm()` in `app.py:463` is a 130-line `if/elif` chain
over 4 providers, each with different SDKs (`google-genai`, OpenAI-compatible
HTTP, `SentenceTransformer`). No automatic fallback. No unified cost tracking.
Gemma cold-start (~30s) silently fails with no retry/fallback to Gemini.

**Proposed approach**:

Replace the provider chain with [LiteLLM](https://www.litellm.ai/), which
provides an OpenAI-compatible interface to 100+ providers:

```python
import litellm
response = litellm.completion(
    model="vertex_ai/gemini-3.1-flash-lite",
    messages=[...],
    stream=True,
)
```

- **Provider mapping**: config dict maps `"modal/gemma"` →
  `openai/base_url=http://...` (Modal vLLM), `"gemini"` →
  `vertex_ai/gemini-3.1-flash-lite`, `"nvidia/llama-3.3"` →
  `nvidia_ai_platform/meta/llama-3.3-70b-instruct`, `"deepseek/reasoner"` →
  `deepseek/deepseek-reasoner`.
- **Automatic fallback**: on timeout/OOM/cold-start failure, fallback to
  Gemini (always warm) — configurable per topic.
- **Unified usage tracking**: `litellm.completion()` returns `usage.total_tokens`
  consistently across providers.
- **Cost estimation**: keep `estimate_provider_cost()` but unify it through
  LiteLLM's model metadata.

**Alternatives considered**:
- **OpenRouter** — commercial, similar abstraction but adds another vendor and
  cost layer.
- **Custom adapter class** — no dependency, but reinvents the wheel for each
  provider SDK change.
- **Semantic Router** — overkill for 4 providers; this isn't a routing
  problem.

**Tradeoffs**:
- LiteLLM is a Python library (not a hosted service for self-hosted); it
  runs in the same container. No extra infra.
- Adds a dependency, but it's well-maintained (10k+ GitHub stars, actively
  developed).
- `stream=True` support varies per provider — LiteLLM normalizes this, but
  some edge cases (DeepSeek reasoner streaming) may need testing.
- The vLLM endpoint for Gemma is already OpenAI-compatible, so LiteLLM
  plugs in cleanly.

**Effort**: LOW (3–5 days). Drop-in replacement for `call_llm()`, test all 4
providers, add fallback config.

**Success metric**: Cold-start failures to Gemma auto-fallback to Gemini.
Single code path for all providers. Unified `total_tokens` in telemetry.

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

## 6. LangGraph orchestration

**Issue**: [#6 — Re-architect pipeline with LangGraph](https://github.com/BongweKE/acAIcia/issues/6)

**Current state**: The pipeline is a 265-line async function with nested
`if/elif` branching, manual `ThreadPoolExecutor` for Guardian+Architect,
inline retry logic, and interleaved telemetry. No graph structure, no
state machine, no checkpoints, no streaming of intermediate steps.

**Proposed approach**:

Replace `process_query_async` with a [LangGraph](https://langchain-ai.github.io/langgraph/)
state machine:

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
graph.add_edge("guardian", "architect")  # or parallel via branch
graph.add_edge("architect", "retrieve")
graph.add_edge("retrieve", "rerank")
graph.add_conditional_edges("rerank", relevance_decision)
graph.add_edge("synthesize", "evaluate")
graph.add_edge("evaluate", END)
```

- **State**: `TypedDict` with `query`, `topic`, `chunks`, `answer`, etc.
- **Conditional edges**: cache hit → skip retrieval; guardian FAIL → return
  error immediately; relevance gate → re-query or synthesize.
- **Streaming**: LangGraph natively supports streaming node-by-node to the
  frontend (`astream_events`).
- **Checkpoints**: persist state to Supabase for multi-turn recovery.
- **Retries**: built-in per-node retry policies (429, timeout).
- **Parallelism**: `parallel` edges for Guardian+Architect (replaces
  ThreadPoolExecutor).

**Alternatives considered**:
- **LlamaIndex QueryPipeline** — RAG-focused, simpler, but less flexible
  for custom branching and state management.
- **Haystack Pipeline** — similar graph-based, but less community momentum
  than LangGraph.
- **CrewAI / AutoGen** — multi-agent with role-playing; too opinionated
  and heavy for this sequential pipeline.
- **Keep hand-rolled** — works today; LangGraph is only worth it if the
  pipeline grows (which the roadmap suggests it will).

**Tradeoffs**:
- LangGraph adds a dependency (`langgraph`) and a learning curve.
- The current pipeline works and is debuggable. LangGraph pays off when
  nodes are reused, retried, or re-ordered frequently.
- State machine structure makes the flow explicit and testable — each node
  can be unit-tested in isolation.
- LangGraph's streaming support directly enables #1 (SSE streaming).

**Effort**: HIGH (8–12 days). Rewrite `process_query_async` as a graph,
migrate all node logic, test all edge cases, wire to frontend.

**Success metric**: All existing behavior preserved (same eval scores).
New capabilities unlocked: per-stage streaming, conditional re-retrieval,
node-level retries, checkpoint resume.

---

## 7. Semantic cache → native pgvector

**Issue**: [#7 — Semantic cache → native pgvector HNSW query](https://github.com/BongweKE/acAIcia/issues/7)

**Current state**: Cache lookup pulls 200 rows from `semantic_cache` into
Python, parses comma-separated embedding strings via `np.fromstring()`,
computes cosine similarity in a loop (`app.py:414-439`). Embeddings are
stored as text strings due to "pgvector text corruption" when storing raw
`list[float]`. The `match_semantic_cache` RPC is documented but unused.

**Proposed approach**:

1. Fix the pgvector storage: use `Vector` type directly via Supabase's
   `pg_vector` insert, not raw SQL string interpolation.
2. Store embeddings as proper `vector(768)` column in `semantic_cache`.
3. Use an HNSW index on the embedding column.
4. Query via RPC: `SELECT * FROM match_semantic_cache($1, $2, $3)` where
   `$1` = query_embedding, `$2` = threshold, `$3` = topic_category.
5. Remove the Python brute-force loop entirely.

**Alternatives considered**:
- **Redis vector store** — faster in-memory, but adds another dependency
  and the cache doesn't need sub-millisecond lookup.
- **In-memory dict** (the unused `ram_cache`) — can't persist across cold starts.
- **Keep Python-side** — works at 200 rows but degrades as cache grows.

**Tradeoffs**:
- Native pgvector query is O(log n) via HNSW vs O(n) Python scan.
- At 200 rows the difference is negligible; this matters at 10k+ cache entries.
- Fixes the comma-string hack which is a maintenance burden and a correctness
  risk (embedding dimension mismatches silently).
- One fewer Python dependency (numpy used only for this).

**Effort**: LOW (2–3 days). Fix storage, create index, wire RPC, remove
Python loop.

**Success metric**: Cache lookup latency remains <5ms at 10k entries. The
comma-string workaround and `np.fromstring` code is removed.

---

## 8. LLM observability

**Issue**: [#8 — LLM observability (Langfuse / Phoenix)](https://github.com/BongweKE/acAIcia/issues/8)

**Current state**: All telemetry goes to Supabase `query_interaction_logs`
and `eval_runs` tables. This covers query-level metrics (tokens, latency,
cost) but not per-LLM-call traces (prompt sent, response received,
retry count, provider latency breakdown). No way to inspect a single
query's full trace (Guardian prompt → Architect prompt → Synthesis prompt)
without manual DB queries.

**Proposed approach**:

Adopt **[Langfuse](https://langfuse.com/)** (self-hosted or cloud) or
**[Phoenix](https://phoenix.arize.com/)** (Arize, OSS):

- **Langfuse**: decorator-based tracing. Wrap each LLM call with
  `@observe()` decorator. Each trace contains the prompt, response, latency,
  token count, and cost. Supports LangChain natively and plain SDK calls.
  Self-hosted via Docker or use their cloud tier.
- **Phoenix**: OSS, OpenTelemetry-based, works with LlamaIndex and custom
  instrumentation. Lighter than Langfuse but less feature-rich for prompt
  management.

Integration sketch (Langfuse):

```python
from langfuse.decorators import observe

@observe(as_type="generation")
def call_llm(prompt, provider):
    response = litellm.completion(model=provider, messages=prompt)
    return response
```

- Each `process_query_async` call creates a trace.
- Guardian, Architect, and Synthesis are child spans.
- Retrieval is a span with the query and returned chunk IDs.
- Cache hit/miss is an attribute on the trace.

**Alternatives considered**:
- **LangSmith** — closed-source, tied to LangChain ecosystem. Good but
  vendor lock-in.
- **OpenTelemetry manual** — flexible but requires more plumbing.
- **Custom Supabase tables** — already done; doesn't give per-call granularity.

**Tradeoffs**:
- Langfuse cloud is free for <50k observations/month (sufficient for this
  project).
- Self-hosted Langfuse requires a Postgres + Redis (extra infra).
- Phoenix is OSS-only, lighter, but less polished UI.
- Both add <1ms overhead per call (decorator-based).

**Effort**: MEDIUM (3–5 days). Add decorators, configure Langfuse project,
wire frontend links to traces.

**Success metric**: Every LLM call is visible in Langfuse with prompt,
response, latency, and cost. Can debug a single query's full pipeline in <2 min.

---

## 9. Eval suite (RAGAS / DeepEval)

**Issue**: [#9 — Proper RAGAS / DeepEval eval suite + CI gate](https://github.com/BongweKE/acAIcia/issues/9)

**Current state**: `eval_runner.py` has 20 hand-crafted Q&A pairs with
hit@1/hit@5. Production eval uses 3 custom LLM-as-judge prompts (faithfulness,
relevance, completeness) sampled at 5%. No CI gating — eval runs nightly but
doesn't block deploys.

**Proposed approach**:

Adopt **[RAGAS](https://docs.ragas.io/)** (the library, not just the concept)
or **[DeepEval](https://docs.confident-ai.com/)** for a rigorous eval suite:

- **RAGAS library**: provides `Faithfulness`, `AnswerRelevancy`,
  `ContextPrecision`, `ContextRecall` as first-class metrics. Uses your
  existing eval pairs as the `eval_dataset`.
- **DeepEval**: similar metrics but with a more Pythonic API and built-in
  CI integration. Also supports custom metrics.
- Both use LLM-as-judge under the hood, matching your current approach but
  with validated prompts and benchmarks.

Integration:

```python
from ragas.metrics import faithfulness, answer_relevancy
from ragas import evaluate

result = evaluate(
    dataset=eval_dataset,
    metrics=[faithfulness, answer_relevancy],
)
```

- Wire into `eval_runner.py` replacing the 3 custom judge prompts.
- Add a **CI gate**: `pytest` runs the eval on a small subset; fail if any
  metric drops by > 0.05 from baseline.
- Store baselines in a JSON file; CI compares against them.

**Alternatives considered**:
- **Keep custom judges** — works but not validated against benchmarks;
  no community/debuggability.
- **Promptfoo** — prompt-level eval, not RAG-specific.
- **Manual eval** — doesn't scale.

**Tradeoffs**:
- RAGAS/DeepEval add dependencies but are well-maintained.
- LLM-as-judge cost: ~$0.001/query × 20 eval pairs = ~$0.02 per eval run.
- CI gating prevents regressions but requires baseline management.
- The 20 eval pairs are a small set; consider expanding to 50+ for
  statistical significance.

**Effort**: MEDIUM (4–6 days). Migrate eval_runner.py, set up CI gate,
expand eval set.

**Success metric**: All metrics (faithfulness, relevance, completeness)
are ≥ 0.85 baseline. CI blocks any PR that degrades a metric by > 0.05.

---

## 10. Embeddings + chunking upgrade

**Issue**: [#10 — Embeddings + chunking upgrade (bge-m3 / parent-child)](https://github.com/BongweKE/acAIcia/issues/10)

**Current state**:
- Embedding: `BAAI/bge-base-en-v1.5` (768 dims, English-only, 512 max tokens).
- Chunking: LangChain `RecursiveCharacterTextSplitter` (2500 chars, 250 overlap).
- No parent-child / hierarchical chunking.
- No re-embedding pipeline (changes require manual re-ingestion).

**Proposed approaches**:

### 10a. Embedding model upgrade

| Model | Dims | Max Tokens | Multilingual | Params |
|---|---|---|---|---|
| bge-base-en-v1.5 (current) | 768 | 512 | No | 109M |
| bge-m3 | 1024 | 8192 | Yes (100+) | 568M |
| text-embedding-3-small (OpenAI) | 1536 | 8191 | Yes | ~100M (est) |
| jina-embeddings-v3 | 1024 | 8192 | Yes | 570M |

**Recommendation**: `bge-m3` — supports dense + sparse + ColBERT in one model,
multilingual (relevant for CIFOR-ICRAF's international corpus), 8192 token
context window (captures full chunks without truncation).

### 10b. Chunking upgrade

- **Parent-child chunking**: small child chunks (500 chars) for precise
  retrieval, but return the parent chunk (2500 chars) as context for
  synthesis. Gives the best of both: precise matching + rich context.
- **Semantic chunking**: split at semantic boundaries (topic shifts) instead
  of fixed char count. Use an LLM or embedding-based boundary detection.

**Recommendation**: parent-child chunking — simpler to implement, directly
improves the retrieval→synthesis pipeline.

**Tradeoffs**:
- Re-embedding 176k chunks requires a Modal T4 job (~30 min, ~$1).
- Parent-child requires storing both child and parent embeddings, plus the
  parent→child relationship. Schema change.
- bge-m3 is 5× larger than bge-base; inference is slower (~100ms vs ~20ms
  per query). Acceptable for a single query.
- OpenAI embeddings add per-query cost ($0.00013/1k tokens ≈ $0.02/query
  for 2500-char chunks).

**Effort**: HIGH (6–10 days). New model integration, re-embedding job,
schema migration, parent-child plumbing, eval comparison.

**Success metric**: `hit@1` improves by ≥ 5pp. Retrieval recall for
multilingual queries (if tested) improves by ≥ 10pp.

---

## 11. Modularize app.py + cleanup

**Issue**: [#11 — Modularize `app.py` + remove dead infra](https://github.com/BongweKE/acAIcia/issues/11)

**Current state**: `app.py` is 1399 lines containing: topic classification,
cost estimation, cache logic, provider routing, retrieval, synthesis,
telemetry, admin endpoints, eval endpoints, health checks, and the
`process_query_async` monolith. Also: `ram_cache` (Modal Dict) is declared
but never used; `conversations`/`conversation_messages` tables are documented
but unused.

**Proposed structure**:

```
backend/
├── app.py                 # FastAPI routes only
├── agents/
│   ├── guardian.py        # Guardian agent logic
│   ├── architect.py       # Architect agent logic
│   ├── synthesizer.py     # Synthesis agent + citations
│   └── topic_classifier.py # Keyword + LLM topic classification
├── retrieval/
│   ├── hybrid.py          # Hybrid retrieval (pgvector + TSVECTOR)
│   ├── reranker.py        # Cross-encoder reranker (if #3)
│   └── cache.py           # Semantic cache (native pgvector, if #7)
├── llm/
│   ├── router.py          # LiteLLM gateway (if #2)
│   └── cost.py            # Cost estimation
├── telemetry/
│   ├── logging.py         # Telemetry to Supabase
│   └── eval.py            # RAGAS/DeepEval eval (if #9)
├── admin/
│   ├── metrics.py         # Admin endpoints
│   └── users.py
└── config.py              # Settings, secrets, provider config
```

Cleanup tasks:
- Remove `ram_cache = modal.Dict.from_name(...)` — unused.
- Remove references to `conversations`/`conversation_messages` tables from
  docs and schema (or implement session persistence if desired).
- Extract the `ThreadPoolExecutor` logic into a proper async parallel call
  (`asyncio.gather` for async functions).

**Effort**: MEDIUM (3–5 days). Mechanical refactor, no behavior change.

**Success metric**: `app.py` is <200 lines (routes only). All logic is
importable and unit-testable.

---

## 12. Structured outputs + retries

**Issue**: [#12 — Structured outputs + retries for Guardian/Architect](https://github.com/BongweKE/acAIcia/issues/12)

**Current state**: Guardian and Architect return free-text. The "PASS/FAIL"
detection uses string parsing (`"FAIL" in response`). Architect output is
parsed via regex. No retries on malformed output. No temperature control.

**Proposed approach**:

- **Guardian**: use `response_mime_type="application/json"` with a schema:
  `{"decision": "PASS"|"FAIL", "reasoning": "..."}`. This eliminates
  string parsing and makes the output deterministic.
- **Architect**: use `response_mime_type="application/json"` with:
  `{"rewritten_query": "...", "key_entities": ["..."]}`. Clean extraction.
- **Retries**: if the LLM returns malformed JSON, retry up to 2× with a
  correction prompt ("Your output was not valid JSON. Return only valid JSON
  matching this schema: ...").
- **Temperature**: set `temperature=0` for Guardian and Architect (deterministic),
  `temperature=0.3` for Synthesis (some variation).

**Alternatives considered**:
- **Tool/function calling** — Gemini supports this natively; could define
  tools for Guardian (pass/fail) and Architect (rewrite). But overkill for
  single-output calls.
- **Keep string parsing** — works but fragile; new model versions may
  change output format.

**Tradeoffs**:
- `response_mime_type` is supported by Gemini and OpenAI-compatible APIs
  (including vLLM). DeepSeek and NVIDIA may not support it — need fallback
  to string parsing for those providers.
- JSON mode adds ~50ms overhead per call (schema validation).
- Retries add worst-case latency (2 × full LLM call) but prevent pipeline
  failures from malformed output.

**Effort**: LOW (2–3 days). Add JSON mode to Guardian/Architect calls,
add retry logic, update prompts.

**Success metric**: Zero pipeline failures from malformed Guardian/Architect
output over 1000 production queries.
