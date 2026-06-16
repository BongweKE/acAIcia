# 28-MAY-2026: Issues with previous gemma3 on modal implementation:

![Image of our plan of improving speed of self hosted llm](image.png)

# Solution of these issues:

## Summary

Replaced the HuggingFace `transformers.pipeline()` inference backend with **vLLM** — a high-performance inference engine with PagedAttention, continuous batching, and optimized CUDA kernels. Also added multi-turn conversation tracking and a fallback model.

## Files Changed

### [gemma_inference.py](file:///home/pro-g/ProG/acAIcia/backend/gemma_inference.py) — Complete Rewrite

**Before:** HuggingFace `pipeline("text-generation")` with naive autoregressive decoding.

**After:** vLLM `AsyncLLMEngine` with:

| Feature | Detail |
|---------|--------|
| **Engine** | vLLM AsyncLLMEngine (PagedAttention + continuous batching) |
| **Container keep-alive** | `scaledown_window=300` — 5 min warm GPU |
| **Concurrent batching** | `@modal.concurrent(max_inputs=50)` — parallel request processing |
| **Prefix caching** | `enable_prefix_caching=True` — caches repeated system prompts |
| **CUDA graphs** | `enforce_eager=False` — allows kernel fusion optimization |
| **Attention backend** | FlashInfer via `VLLM_ATTENTION_BACKEND` env var |
| **Fallback model** | Auto-falls back from `gemma-4-E2B-it` → `gemma-3-4b-it` |
| **Multi-turn** | Accepts `conversation_history` for follow-up questions |

> [!NOTE]
> The fallback model (`google/gemma-3-4b-it`) activates automatically if the primary model (`google/gemma-4-E2B-it`) fails to load due to gating, OOM, or other issues. To force a specific model, set `MODEL_ID` in the `acaicia-llm-secrets` Modal secret.

---

### [app.py](file:///home/pro-g/ProG/acAIcia/backend/app.py) — Backend Optimization

#### Changes:
1. **Cached Modal class reference** (line ~50): `GEMMA_CLS = modal.Cls.from_name(...)` resolved once at module load instead of per-request
2. **Agent-specific parameters** (line ~57):
   ```python
   AGENT_MAX_TOKENS = {"guardian": 16, "architect": 256, "synthesis": 2048}
   AGENT_TEMPERATURE = {"guardian": 0.0, "architect": 0.3, "synthesis": 0.7}
   ```
3. **Conversation history tracking**: `QueryRequest` now accepts `session_id` and `conversation_history`
4. **Session persistence**: After each successful query, the conversation is saved to `/data/sessions/{session_id}.json` on the Modal Volume (last 5 exchanges)
5. **History loading**: If the frontend sends a `session_id` without history, the backend loads it from the volume

#### Conversation Context Flow:
```
Frontend (Chainlit)           Backend (FastAPI)           Gemma Inference (vLLM)
       │                            │                            │
       ├── POST /query ────────────►│                            │
       │   {query, session_id}      │                            │
       │                            ├── Load /data/sessions/*.json
       │                            │                            │
       │                            ├── Guardian (no history) ──►│
       │                            ├── Architect (no history) ─►│
       │                            ├── Synthesis (WITH history)►│──► chat template
       │                            │                            │    with multi-turn
       │                            ├── Save history to volume   │
       │◄── response ──────────────┤                            │
       ├── Update local history     │                            │
```

> [!IMPORTANT]
> Conversation history is only passed to the **Synthesis agent** — not Guardian or Architect. Guardian just needs to check if the current query is safe. Architect just needs to rewrite the current query. Only Synthesis benefits from knowing what was discussed before.

---

### [frontend/app.py](file:///home/pro-g/ProG/acAIcia/frontend/app.py) — Session Tracking

1. `on_chat_start`: Generates a `uuid4` session_id and initializes empty conversation history
2. `on_message`: Sends `session_id` with each `/query` request
3. After response: Appends the user query + assistant answer to local history (capped at 10 messages)

---

## Expected Performance Impact

| Metric | Before (HF Pipeline) | After (vLLM) | Improvement |
|--------|----------------------|--------------|-------------|
| Time to first token | ~3-5s | ~0.3-0.8s | **5-10x** |
| Tokens/sec | ~15-30 | ~80-200 | **5-7x** |
| Guardian call | ~5-10s | ~0.3-0.5s | **15-20x** (only 16 tokens now) |
| Architect call | ~5-10s | ~1-2s | **5x** |
| Full pipeline (3 calls) | ~30-60s | ~5-10s | **5-6x** |
| Cold start | ~45-60s | ~30-40s | Similar |
| Follow-up queries | No context | Full context | **New capability** |


# Extra Changes:

modify the base image in backend/gemma_inference.py to use nvidia/cuda:12.4.0-devel-ubuntu22.04 instead of a plain debian-slim image. This will provide the CUDA toolkit and nvcc compiler needed for FlashInfer/vLLM JIT compilation, allowing google/gemma-4-E2B-it to load without errors.


change the image back to debian_slim (which is much lighter and loads faster) and add the VLLM_USE_FLASHINFER_SAMPLER=0 and VLLM_DISABLE_FLASHINFER=1 environment variables to completely avoid JIT compilation of FlashInfer kernels.

modify backend/gemma_inference.py to:

Explicitly list transformers in the image installation.

Initialize and cache the HuggingFace AutoTokenizer locally inside the @modal.enter method.

Use the cached self._tokenizer inside generate rather than attempting to access the version-dependent internal engine attribute self._engine.engine.tokenizer.tokenizer. This completely resolves the AttributeError: 'AsyncLLM' object has no attribute 'engine' issue.


# acAIcia Backend Optimization — Walkthrough

## Summary

Applied 7 performance and maintainability improvements across 2 files. All changes are backward-compatible — no API contract changes, no database schema changes, no new dependencies.

---

## Changes Made

### 1. Parallel Agent Execution (Guardian + Architect)

**File:** [backend/app.py](file:///home/pro-g/ProG/acAIcia/backend/app.py#L299-L357)

Guardian and Architect now run concurrently via `ThreadPoolExecutor(max_workers=2)`. Previously they ran sequentially. Both are I/O-bound (RPC calls to LLM providers), so threading gives near-perfect parallelism.

**Safety:** If Guardian returns FAIL, the Architect result is simply discarded. No wasted tokens on the Architect side beyond what was already in-flight.

**Impact:** ~2x speedup on the first two pipeline stages (saves 1-6s per query depending on provider cold state).

---

### 2. Settings Cache with TTL

**File:** [backend/app.py](file:///home/pro-g/ProG/acAIcia/backend/app.py#L70-L128)

Module-level `get_active_provider()` with a 60-second in-memory cache. Previously, every `call_llm()` call triggered `vol.reload()` + `settings.json` read — that's 3x per query (Guardian, Architect, Synthesis).

The cache is invalidated immediately when `POST /settings` is called, so provider switches take effect on the next query.

**Impact:** Eliminates 5-6 `vol.reload()` network round-trips per query.

---

### 3. Embedding Model Singleton

**File:** [backend/app.py](file:///home/pro-g/ProG/acAIcia/backend/app.py#L130-L162)

`SentenceTransformer('BAAI/bge-base-en-v1.5')` is now loaded once per container lifetime via `_get_cached_embed_model()` and reused across all `process_query_async` invocations in that container. Previously it was re-loaded on every function call.

Thread-safe via `threading.Lock()`.

**Impact:** Saves ~2-5s model initialization on warm container reuse.

---

### 4. Consistent Agent Parameters Across Providers

**File:** [backend/app.py](file:///home/pro-g/ProG/acAIcia/backend/app.py#L205-L236)

NVIDIA and DeepSeek providers now use `AGENT_MAX_TOKENS` and `AGENT_TEMPERATURE` dicts (already used by Modal provider). Before:

```diff
- "max_tokens": 1024 if agent_type != "synthesis" else 2048,
- "temperature": 0.20,
+ "max_tokens": AGENT_MAX_TOKENS.get(agent_type, 1024),
+ "temperature": AGENT_TEMPERATURE.get(agent_type, 0.7),
```

Guardian now requests only 16 output tokens (was 1024). Architect requests 256 (was 1024).

**Impact:** ~60x fewer allocated output tokens for Guardian on external APIs. Faster completion, lower cost.

---

### 5. Reduced Volume I/O

**File:** [backend/app.py](file:///home/pro-g/ProG/acAIcia/backend/app.py#L277-L285)

Removed `vol.reload()` from `update_status()`. The writing container doesn't need to re-sync before writing to its own file. `vol.commit()` is preserved for cross-container visibility.

**Impact:** Eliminates 2-4 unnecessary `vol.reload()` calls per query.

---

### 6. Dead Code Removal

**File:** [backend/app.py](file:///home/pro-g/ProG/acAIcia/backend/app.py#L586)

Removed 148 lines of dead code from `fastapi_app_entrypoint()`:
- `get_active_provider()` — never called by any endpoint (settings endpoint has inline logic)
- `call_llm()` — never called (all processing uses `process_query_async.spawn()`)

**Impact:** Eliminates maintenance risk of divergent copies.

---

### 7. Batched Ingestion Inserts

**File:** [ingestion/app.py](file:///home/pro-g/ProG/acAIcia/ingestion/app.py#L131-L143)

Changed sequential per-chunk `supabase.table().insert()` to batch inserts in groups of 50. The Supabase Python client natively supports list inserts.

```diff
- for i, chunk in enumerate(chunks):
-     supabase.table("document_embeddings").insert(chunk_data).execute()
+ for batch_start in range(0, len(chunk_records), BATCH_SIZE):
+     batch = chunk_records[batch_start:batch_start + BATCH_SIZE]
+     supabase.table("document_embeddings").insert(batch).execute()
```

**Impact:** Reduces HTTP round-trips from N to ceil(N/50) per document during ingestion.

---

## Verification

| Check | Result |
|-------|--------|
| `backend/app.py` syntax | ✅ Passed |
| `ingestion/app.py` syntax | ✅ Passed |
| Module-level functions exist | ✅ `get_active_provider`, `invalidate_settings_cache`, `_get_cached_embed_model` |
| Dead code removed | ✅ No `get_active_provider` or `call_llm` in `fastapi_app_entrypoint` |
| ThreadPoolExecutor present | ✅ |
| AGENT_MAX_TOKENS applied | ✅ |
| Cache invalidation wired | ✅ |
| Embedding model cache used | ✅ |

