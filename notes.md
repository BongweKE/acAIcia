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


