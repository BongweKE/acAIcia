# AGENTS.md — acAIcia System & Agent Architecture Guide

This document provides a comprehensive technical overview of **acAIcia**, the AI Research Assistant for **Landscape Alliance (formerly CIFOR-ICRAF)**. It details the multi-agent RAG system architecture, frontend React SPA, API contracts, database integrations, security guidelines, and cloud deployment topology.

---

## 🌿 Executive Summary

acAIcia is an end-to-end evidence synthesis system designed to empower forestry, climate, soil, and agroforestry researchers. It combines a **Vite + React 18 SPA frontend** with a **Railway-hosted Python (FastAPI) multi-agent backend** to ingest scientific publications, perform hybrid dense-vector and full-text keyword retrieval, and generate academic answers with strict `[Author(s), Year]` inline citations and DOI hyperlinks. (A legacy Modal deployment is retained in `backend/app.py` for rollback only — see `docs/railway_migration.md`.)

---

## 🏛️ System Architecture

```
                                    +-----------------------------------+
                                    |     Vite + React 18 Router SPA    |
                                    |  (Railway: https://acaicia.org)   |
                                    +-----------------+-----------------+
                                                      |
                                                      | REST API (HTTP/2 + CORS)
                                                      v
                                    +-----------------------------------+
                                    |   FastAPI Entrypoint (Railway)     |
                                    +-----------------+-----------------+
                                                      |
                                     +----------------+----------------+
                                     |                                 |
                                     v                                 v
                     +-------------------------------+ +-------------------------------+
                     |      Guardian Agent (LLM)     | |    Query Architect Agent (LLM) |
                     +---------------+---------------+ +---------------+---------------+
                                     |                                 |
                                     +----------------+----------------+
                                                      |
                                                      v
                                     +---------------------------------+
                                     |    Hybrid Retrieval (Supabase)  |
                                     | (bge-base-en-v1.5 + Keyword RRF)|
                                     +----------------+----------------+
                                                      |
                                                      v
                                     +---------------------------------+
                                     |      Synthesis Agent (LLM)      |
                                     | (Inline [Author, Year] + DOIs)  |
                                     +---------------------------------+
```

---

## 🤖 Multi-Agent RAG Pipeline

The backend query engine (`backend/pipeline.py`, served by `backend/server.py`) executes a 4-stage pipeline managed by specialized agents:

### 1. Guardian Agent 🛡️
- **Role**: Input validation and domain relevance classification.
- **Policy**: Permissive stance on natural sciences, forestry, agroforestry, climate change, peatland hydrology, soil science, fire management, and research methodology.
- **Decision Rule**: Returns `PASS` for scientific queries; returns `FAIL` only for malicious inputs, prompt injections, or completely off-topic requests.
- **Provider mapping**: When `mistral` provider is active, Guardian uses **Shieldstral 1.0** (3B policy-adaptive safety classifier) instead of the general-purpose model.

### 2. Query Architect Agent 🧭
- **Role**: Query expansion and hybrid search optimization.
- **Rule**: Rewrites the raw user query into an entity-dense search query. Retains geographic places, species, DOIs, acronyms, and years, expanding technical terms without answering the question.

### 3. Hybrid Retrieval System 🔍
- **Dense Vector Embeddings**: Local cached `BAAI/bge-base-en-v1.5` SentenceTransformer model (768 dimensions).
- **Supabase RPC (`match_documents_hybrid`)**: Combines dense vector similarity scores with full-text keyword search via Reciprocal Rank Fusion (RRF).
- **Fallback**: Automatically falls back to vector matching (`match_documents`) if hybrid retrieval yields zero results.

### 4. Synthesis Agent ✍️
- **Role**: Generates professional academic answers using retrieved internal document excerpts.
- **Citation Protocol**: Strictly enforces inline citations formatted as `[Author(s), Year]` (e.g., `[Hoang et al., 2010]`). Never uses document numbers (e.g., `[Document 1]`).
- **User Customization**: Appends active user custom instructions from profile settings to tailor synthesis formatting.

### 5. Semantic Cache Subsystem ⚡
- **Behavior**: Stores raw user query embeddings and answers in `semantic_cache` table with domain topic tagging (`topic_category`).
- **Matching Criteria**: Requires similarity threshold >= 0.98 and matching domain `topic_category` to prevent cross-domain cache contamination. Always stores and compares the raw user query embedding (`user_query`), never the Architect's expanded search query embedding.
- **Context Guard**: Checked **only for standalone single-turn queries** (`if not conversation_history`). Multi-turn conversation sessions bypass semantic cache to maintain conversation session context.

### 6. Continuous Evaluation & Observability Subsystem 📈
- **Core Engine (`backend/evaluation_engine.py`)**: Multi-dimensional evaluation combining DeepEval metrics (Faithfulness, Answer Relevancy, Context Precision, Recall) with custom CIFOR-ICRAF Citation Quality verification and Canary Hallucination detection.
- **On-Demand Admin Benchmarks**: Triggered via Admin Dashboard (`/admin`), executing asynchronously via `run_evaluation_worker` with selectable datasets (`test_questions.csv`, `test_questions_difficult.csv`, etc.) and execution modes (`full`, `fast_smoke`, `retrieval_only`).
- **Weekly Comparative Evaluation**: Scheduled cron `modal.Cron("0 2 * * 0")` on the **legacy Modal deployment only** (compares Modal self-hosted Gemma against Mistral API `ministral-8b-latest`). The Railway backend has no Gemma and runs Mistral-only, admin-triggered evaluations.
- **Persistence Layer (`005_evaluation_system.sql`)**: Persists run metadata (`evaluation_runs`), per-question metrics (`evaluation_details`), active canary registry (`canary_questions`), and timeseries score view (`evaluation_score_trends`).

---

## ⚛️ React Frontend Architecture (`frontend/`)

- **Tech Stack**: Vite 5, React 18, TypeScript 5, React Router 6, Tailwind CSS, Lucide Icons.
- **Design System**: Landscape Alliance palette (`#f0f7f2` botanical canvas, `#0f1026` deep plum primary, `#0fa8a6` teal accent, `#b8d975` chart foliage), typography (`DM Sans`, `Source Serif 4`, `IBM Plex Mono`).
- **Logo Asset**: `logo-new.svg` Acacia tree mark with teal foliage accent.
- **Routing Structure**:
  - `/`: Scrollable landing page matching design mockup (Hero + Assistant Card, Answer Preview, How it Works, About).
  - `/assistant`: Dedicated Ask acAIcia research chat page.
  - `/how-it-works`: Pipeline architecture breakdown & scientific citation protocol.
  - `/about`: Mission & Landscape Alliance background.
  - `/feedback`: Citation feedback & correction submission.
  - `/admin`: Admin observability dashboard & system model governance.
- **Context Providers (`frontend/src/context/`)**:
  - `AuthContext`: Machine UUID generation (`acaicia_machine_id`) passed as `guest_session_id` in API requests.
  - `ChatContext`: Persistent multi-session chat history (`localStorage` backed). Supports creating, switching, and deleting sessions.
  - `SettingsContext`: Admin-governed LLM active model display (read-only on user pages, configurable via `/admin`).
  - `ToastContext`: Global notification toasts.
- **API Client (`frontend/src/api/client.ts`)**: Connects to the FastAPI backend API with automatic fallback to `https://acaicia-backend-production.up.railway.app`.

---

## 📡 API Contract Reference

| Endpoint | Method | Request Payload | Response / Output |
| :--- | :--- | :--- | :--- |
| `/prompt_pills` | `GET` | None | `{ pills: string[] }` |
| `/query` | `POST` | `{ query, session_id, user_id, guest_session_id, conversation_history }` | `{ query_id, status: "processing" }` |
| `/query/status/{query_id}` | `GET` | None | `{ status, response, sources, stage, cache_hit }` |
| `/settings` | `GET` | None | `SettingsResponse` (active provider, key status) |
| `/settings` | `POST` | `{ llm_provider: string }` | Updated `SettingsResponse` |
| `/user/settings` | `GET` | `?user_id=...` | User profile object |
| `/user/settings` | `POST` | `UserProfileRequest` | `{ status: "success", profile }` |
| `/feedback` | `POST` | `{ log_id, user_id, rating, correction_text }` | `{ status: "success" }` |
| `/admin/metrics` | `GET` | `?start_date=...&end_date=...&topic=...&provider=...&query_type=...&hour_start=...&hour_end=...` | Extended `AdminMetricsResponse` |
| `/admin/users` | `GET` | `?start_date=...&end_date=...&page=1&limit=25` | `{ users: UserCostEntry[], total, page, limit }` |
| `/admin/topics` | `GET` | None | `{ topics: TopicEntry[] }` (taxonomy & counts) |
| `/admin/documents/popular` | `GET` | `?limit=20` | `{ documents: PopularDocument[] }` |
| `/admin/cache/stats` | `GET` | None | `{ total_entries, oldest_entry_at, newest_entry_at, cost_per_1m_tokens }` |
| `/admin/cache/clear` | `POST` | None | `{ status: "cleared", message }` |
| `/admin/alerts` | `GET` | `?resolved=false` | `{ alerts: SystemAlert[] }` |
| `/admin/alerts/{id}/resolve` | `POST` | None | `{ status: "resolved" }` |
| `/admin/evaluations` | `GET` | `?page=1&limit=20` | `{ evaluation_runs, production_ragas }` |
| `/admin/evaluations/trigger` | `POST` | `?dataset=...&limit=...&eval_mode=...` | `{ run_id, status: "running", message }` |
| `/admin/evaluations/{run_id}/details` | `GET` | None | `{ run, details: EvaluationDetail[] }` |
| `/admin/evaluations/trends` | `GET` | `?limit=30` | `{ trends: EvaluationTrend[] }` |
| `/admin/export/csv` | `GET` | `?start_date=...&end_date=...` | Streaming CSV download |

---

## 🚢 Deployment Topology

1. **Railway (`acAIcia` frontend)**:
   - **Live URL**: [https://acaicia.org](https://acaicia.org)
   - **Build**: Multi-stage `Dockerfile` (Node 20 builder -> `serve` static server on `$PORT`).

2. **Railway (`acAIcia Backend`)** — ACTIVE backend:
   - **Backend API URL**: [https://acaicia-backend-production.up.railway.app](https://acaicia-backend-production.up.railway.app)
   - **Build**: `backend/Dockerfile` (build context = repo root). Entrypoint `uvicorn backend.server:app`.
   - **Inference**: Mistral API only (`LLM_PROVIDER=mistral`). `BAAI/bge-base-en-v1.5` is baked into the image.
   - **State**: Supabase (data/telemetry) + a local file store for query status/settings. No Modal GPU, no cron.
   - **Admin**: `/admin/*` and `POST /settings` require `Authorization: Bearer <ADMIN_API_KEY>`.

3. **Modal Cloud (`acaicia-backend`) — LEGACY / ROLLBACK ONLY**:
   - **Backend API URL**: [https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run](https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run)
   - **Frontend Backup URL**: [https://ciforicraf-ai--acaicia-frontend-fastapi-app-entrypoint.modal.run](https://ciforicraf-ai--acaicia-frontend-fastapi-app-entrypoint.modal.run)
   - **Status**: the `ciforicraf-ai` workspace exceeded its $30/month Starter spend limit and Modal disabled serving for every app in it. Do not rely on Modal while that is unresolved.
   - **Cron**: `cron_eval_and_warmup` weekly via `modal.Cron("0 2 * * 0")` (legacy only).

---

## 🔒 Security & Environment Rules

1. **Zero Hardcoded Secrets**: All secret keys (`SUPABASE_KEY`, `GOOGLE_API_KEY`, `NVIDIA_API_KEY`, `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`, `ADMIN_API_KEY`) are managed via Modal Secrets or Railway environment settings.
2. **CORS Policy**: Backend FastAPI configured with `CORSMiddleware` to allow requests from Railway and Modal frontend origins.
3. **Git Hygiene**: `.gitignore` excludes `node_modules/`, `dist/`, `.agents/`, `.env`, `.venv`, and temporary logs.
4. **Database RLS Posture**: every `public` table has RLS **enabled with no policies** (deny-by-default for `anon`/`authenticated`). The backend uses the `service_role` key, which bypasses RLS, and the frontend never talks to Supabase directly. **Any new table MUST have RLS enabled.** See [ADR 0010](docs/adrs/0010-database-security-posture-rls-deny-by-default.md).
5. **Admin Surface**: `/admin/*` and `POST /settings` require `Authorization: Bearer <ADMIN_API_KEY>`, and the frontend `/admin` route gates all content behind key entry. See [ADR 0002](docs/adrs/0002-machine-uuid-guest-tracking-and-admin-model-governance.md).

---

## 🧠 Developer & Agent Guidelines (Holistic Architecture & Operational Tips)

1. **Python Environment & Backend Deployment**:
   - Virtual environment is located at `.venv/`. **ALWAYS** call Python and CLI commands using `.venv` executables.
   - **Railway backend (active)**: deploy from the repo root with `railway up --service "acAIcia Backend" --environment production` (uses `backend/Dockerfile`). Set variables with `railway variable set`.
   - **Modal (legacy, rollback only)**: `.venv/bin/modal deploy backend/app.py` — only works once the Modal workspace spend limit is resolved.

2. **Frontend React SPA Execution**:
   - React frontend resides in `frontend/`. Always execute `npm` commands inside `frontend/` (e.g. `cd frontend && npm run build`).
   - Static typecheck is enforced via `tsc && vite build`. Always verify clean production compilation (`0 errors`) before pushing or deploying.

3. **Holistic Architectural Scoping**:
   - Code updates must consider the end-to-end system architecture (Vite + React 18 SPA frontend, Railway multi-agent backend, FastAPI endpoints, Supabase database, and Railway deployment).

4. **Multi-Turn Session & Semantic Cache Rules**:
   - Single-turn standalone queries check `semantic_cache` (similarity threshold >= 0.95).
   - Multi-turn conversation sessions (`conversation_history` present) **MUST bypass semantic cache** (`if not conversation_history:`).

5. **Continuous Documentation Integrity**:
   - Whenever updating features, backend endpoints, or frontend components, immediately update `AGENTS.md` and `docs/frontend.md`.

6. **Query Polling Resilience & Database Fallback Protocol**:
   - `ChatContext.tsx` uses consecutive error counting (aborts only after 10 consecutive network failures) with a 180-second timeout to support long RAG queries (20–45s).
   - `/query/status/{query_id}` falls back to `query_interaction_logs` and `semantic_cache` in Supabase if the local status file is missing (e.g. after a redeploy), returning a processing state rather than HTTP 404.
   - Pending assistant queries are auto-resumed on session mount or switch.

7. **Product Backlog & Implementation Priorities (`BACKLOG.md`)**:
   - The authoritative engineering backlog is tracked in [`BACKLOG.md`](BACKLOG.md) and [`future-changes/`](future-changes/).
   - Priority sequence: **P0 Hotfixes & Security** (Sprint 0: Migration 005 RLS, CSV 401 fix, exact token telemetry, eval worker error handling, rollback auth) → **P1 Wins** (Phase 1: Streaming SSE, cost model updates, reranker, LiteLLM gateway) → **P2 Scale** (Phase 2: multi-replica shared store, pgvector cache, CI eval gate, Langfuse) → **P3 Hardening** (Phase 3: bge-m3, structured outputs, Modal deprecation).

