# 01 — Current Pipeline Analysis

> How the acAIcia pipeline was built, the technologies used, and where each
> component lives. This is the "as-is" reference for the roadmap.

---

## System overview

```
React SPA (Railway, acaicia.org)
        │
        │ REST API (HTTP/2 + CORS)
        ▼
FastAPI on Modal (acaicia-backend)
        │
        ├── Guardian Agent  (LLM prompt, app.py:519)
        ├── Architect Agent (LLM prompt, app.py:584)
        ├── Hybrid Retrieval (pgvector + TSVECTOR RRF, app.py:609)
        ├── Synthesis Agent (LLM prompt, app.py:664)
        └── Semantic Cache  (Modal Dict + Python cosine, app.py:404)
```

---

## The `POST /query` flow (`app.py:126`)

The entire request lifecycle is a single async function spawned via
`BackgroundTasks`. No job queue; status is written to a Modal Volume JSON file
and polled by `GET /query/status/{query_id}` (`app.py:1360`).

### 1. Request parsing (`app.py:148`)

- Accepts `query`, `session_id`, `user_id`, `guest_session_id`,
  `conversation_history`, `provider_override`.
- Guest detection: if `user_id` starts with `acaicia_machine_`, forces
  `provider_override = "modal/gemma"` — no override allowed.
- Guest rate limit: 20 queries/session, checked via volume file.

### 2. Session history (`app.py:189`)

- Loads existing history from volume file `/data/sessions/{session_id}.json`.
- If not found, initializes empty.
- History is prepended to the query for context, then truncated at 5000 chars.

### 3. Topic classification (`app.py:220`)

Two-tier system before any LLM call:

**Keyword-first pass** (`_keyword_topic_match`, `app.py:72`):
- Tokenizes query (400+ stopwords removed).
- Scores topic_keywords from `documents_catalog` using `_topic_scoring`
  (`app.py:41`) — bigram matching, abbreviation expansion, compound-aware.
- Returns a `KeywordTopicResult` with `topic`, `confidence`, `matched_keywords`,
  `has_compound_terms`.

**LLM fallback** — only invoked if no keyword match with confidence ≥ 0.25
(`_classify_topic_llm`, `app.py:98`):
- Calls `generate_metadata()` with a forced-choice prompt for 7 topics:
  forests, climate, peatland_hydrology, soils, agroforestry, fire, research_methods.
- Returns `TopicCategory` (a StrEnum).

**Cost implication**: once a topic is locked in, `allowed_providers` is
hard-filtered — e.g., `peatland_hydrology` only allows DeepSeek Reasoner.

### 4. Chat history formatting (`app.py:238`)

- Converts `conversation_history` to Gemma's `<turn>` / `<start_of_turn>` format.
- Prepended to the raw query for multi-turn context.

### 5. Cache check (`app.py:404`)

- For **single-turn only** (`if not conversation_history`):
  - Embeds raw query via the project's embedding model.
  - Fetches up to 200 rows from `semantic_cache` table.
  - Computes cosine similarity in Python (brute-force loop, `app.py:427`).
  - Hits at threshold ≥ 0.98, matching topic_category.
  - Store path embeds query via RPC `match_documents_rpc` → stores as
    comma-separated string (workaround for pgvector text round-trip).
- Multi-turn queries always bypass the cache.

### 6. Guardian + Architect (parallel, `app.py:568`)

- Run concurrently via `ThreadPoolExecutor(max_workers=2)`.
- Both use `client.models.generate_content()` (Gemini SDK, OpenAI-compatible
  endpoint — see Gemini 3.1 Flash Lite setup at `app.py:51`).

**Guardian** (`_guardian_call`, `app.py:519`):
- System prompt classifies input as PASS/FAIL.
- PASS if on-topic for any of the 7 topics + forestry, agroforestry, soils,
  research methods.
- FAIL if malicious, prompt injection, or completely off-topic.
- Retries on 429 up to 5 times with exponential backoff.

**Architect** (`_architect_call`, `app.py:584`):
- Rewrites user query into an entity-dense search query.
- Retains DOIs, species names, acronyms, geographic places.
- Does NOT answer the question.

### 7. Hybrid retrieval (`app.py:609`)

- Generates 768-dim embedding via `SentenceTransformer` (`bge-base-en-v1.5`)
  cached in a Modal Dict keyed by `"bge-base-en-v1.5"`.
- Calls Supabase RPC `match_documents_hybrid` with `p_query_embedding` /
  `p_query_text` / `p_match_threshold=0.25` / `p_match_count=5`.
- **RRF inside the DB**: combines pgvector cosine distance (top 5) with
  TSVECTOR full-text `plainto_tsquery` (top 5) using
  `1.0/(60 + rank_vector)` reciprocal rank fusion.
- Fallback: if hybrid yields zero results, retries with `match_documents`
  (vector-only).

### 8. Synthesis (`app.py:664`)

- Constructs a prompt with:
  - Document excerpts (from top-5 retrieval results, truncated to ~5000 chars).
  - Strict citation protocol: `[Author(s), Year]` only; never `[Document 1]`.
  - Optional user custom instructions from profile settings.
  - Gemini "thinking" not explicitly configured; just `generate_content()`.
- Title merge: de-duplicates retrieval results by title + author, passes
  first DOI found.

### 9. Answer quality score (`app.py:711`)

- A follow-up LLM call scores the answer's relevance to the query: 0.0–1.0.
- Telemetry is written to Supabase `query_interaction_logs` via RPC
  `insert_interaction_log_rpc`.

### 10. Response (`app.py:744`)

- Returns `{ response, sources, query_id, provider_used }`.
- Answer also written to the volume file (for polling path).
- Session history appended (if session_id present).

---

## Providers & routing

| Provider ID | Backend | Model | Notes |
|---|---|---|---|
| `modal/gemma` | Modal L4 GPU, vLLM | google/gemma-4-27b-it | Self-hosted, ~30s cold start |
| `gemini` | Google GenAI SDK | gemini-3.1-flash-lite-preview | Default for authenticated users |
| `nvidia/llama-3.3` | NVIDIA-hosted | meta/llama-3.3-70b-instruct | Deep provider |
| `deepseek/reasoner` | OpenAI-compatible | deepseek-reasoner | Forced for peatland_hydrology |

Provider is selected by:
1. Guest → always `modal/gemma`.
2. User override → validated against topic's `allowed_providers`.
3. User default profile → validated.
4. Hard fallback → `gemini`.

Cost is estimated via `estimate_provider_cost` (`app.py:537`).

---

## Ingestion pipeline (`ingestion/app.py`)

- Entry: `parse_and_store_document.py` or `ingest_test_document.py`.
- PDF parsing: PyMuPDF → sentence-aware chunking (`\n\n` split, then sentence
  boundary at 1000 chars).
- Chunking: LangChain `RecursiveCharacterTextSplitter` (2500 chars, 250 overlap).
- Embedding: `BAAI/bge-base-en-v1.5` (768 dims, Modal T4 GPU, batch=32).
- Storage: Supabase `documents_catalog` → `document_embeddings` (UUID FK).
- Telemetry: `ingestion_logs` table.

---

## Evaluation (`eval_runner.py`)

- 20 hand-crafted Q&A pairs organized by topic category.
- Generates embeddings (bge-base-en-v1.5), runs `match_documents_hybrid` RPC.
- Hit@1 / Hit@5 = does the exact citation appear in the top-1/top-5 results?
- Production eval (5% sampling via `_eval_in_background`, `app.py:731`):
  - Three LLM-as-judge prompts: faithfulness, relevance, completeness.
  - Returns 0–1 scores written to `eval_runs` + `eval_responses`.
- Nightly cron: `modal.Cron("0 2 * * *")` runs `run_ragas_evaluation`.

---

## Telemetry & observability

- `query_interaction_logs` table: timestamp, session_id, original_query,
  guardian_passed, topic_category, provider_used, synthesis_source,
  total_tokens_used, estimated_cost_usd, latency_ms, cache_hit, search_mode.
- Admin endpoints: `/admin/metrics`, `/admin/users`, `/admin/topics`,
  `/admin/cache/stats`, `/admin/alerts`, `/admin/evaluations`, `/admin/export/csv`.
- No external tracing (no LangSmith/Langfuse/Phoenix).
- Rate-limit alerts: modal.Dict lock → SQLite `alerts.json` → volume file.

---

## Deployment

- **Frontend**: Railway, `acaicia.org` — Vite + React SPA, static file serving.
- **Backend**: Modal, `acaicia-backend` — serverless FastAPI, scales 0→N.
- **DB**: Supabase (PostgreSQL 15, pgvector, RLS enabled).
- **Ingestion**: Modal T4 GPU, `acaicia-ingestion`.
- **Eval cron**: `cron_eval_and_warmup`, nightly 02:00 UTC.

---

## Key numbers

| Metric | Value |
|---|---|
| Documents indexed | 693 |
| Total chunks | 176,541 |
| Embedding dimension | 768 (bge-base-en-v1.5) |
| Topic categories | 7 (forests, climate, peatland, soils, agroforestry, fire, research) |
| LLM providers | 4 (Gemma 4, Gemini, NVIDIA Llama, DeepSeek) |
| Guest query limit | 20/session |
| Semantic cache threshold | 0.98 cosine |
| Retrieval threshold | 0.25 cosine |
| Eval sample rate | 5% |
| Eval pair count | 20 |
