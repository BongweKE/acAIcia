# AGENTS.md — acAIcia System & Agent Architecture Guide

This document provides a comprehensive technical overview of **acAIcia**, the AI Research Assistant for **Landscape Alliance (formerly CIFOR-ICRAF)**. It details the multi-agent RAG system architecture, frontend React SPA, API contracts, database integrations, security guidelines, and cloud deployment topology.

---

## 🌿 Executive Summary

acAIcia is an end-to-end evidence synthesis system designed to empower forestry, climate, soil, and agroforestry researchers. It combines a **Vite + React 18 SPA frontend** with a **Modal-hosted Python multi-agent backend** to ingest scientific publications, perform hybrid dense-vector and full-text keyword retrieval, and generate academic answers with strict `[Author(s), Year]` inline citations and DOI hyperlinks.

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
                                    |     FastAPI Entrypoint (Modal)     |
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

The backend query engine (`backend/app.py`) executes an asynchronous 4-stage pipeline managed by specialized agents:

### 1. Guardian Agent 🛡️
- **Role**: Input validation and domain relevance classification.
- **Policy**: Permissive stance on natural sciences, forestry, agroforestry, climate change, peatland hydrology, soil science, fire management, and research methodology.
- **Decision Rule**: Returns `PASS` for scientific queries; returns `FAIL` only for malicious inputs, prompt injections, or completely off-topic requests.

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
- **API Client (`frontend/src/api/client.ts`)**: Connects to the FastAPI backend API with automatic fallback to `https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run`.

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
| `/admin/export/csv` | `GET` | `?start_date=...&end_date=...` | Streaming CSV download |

---

## 🚢 Deployment Topology

1. **Railway (`acAIcia`)**:
   - **Live URL**: [https://acaicia.org](https://acaicia.org)
   - **Build**: Multi-stage `Dockerfile` (Node 20 builder -> `serve` static server on `$PORT`).

2. **Modal Cloud (`acaicia-backend`)**:
   - **Backend API URL**: [https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run](https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run)
   - **Frontend Backup URL**: [https://ciforicraf-ai--acaicia-frontend-fastapi-app-entrypoint.modal.run](https://ciforicraf-ai--acaicia-frontend-fastapi-app-entrypoint.modal.run)
   - **Cron**: `cron_eval_and_warmup` scheduled nightly via `modal.Cron("0 2 * * *")`.

---

## 🔒 Security & Environment Rules

1. **Zero Hardcoded Secrets**: All secret keys (`SUPABASE_KEY`, `GOOGLE_API_KEY`, `NVIDIA_API_KEY`, `DEEPSEEK_API_KEY`, `ADMIN_API_KEY`) are managed via Modal Secrets or Railway environment settings.
2. **CORS Policy**: Backend FastAPI configured with `CORSMiddleware` to allow requests from Railway and Modal frontend origins.
3. **Git Hygiene**: `.gitignore` excludes `node_modules/`, `dist/`, `.agents/`, `.env`, `.venv`, and temporary logs.

---

## 🧠 Developer & Agent Guidelines (Holistic Architecture & Operational Tips)

1. **Python Environment & Modal CLI Execution**:
   - Virtual environment is located at `.venv/`. **ALWAYS** call Python and Modal CLI commands using `.venv` executables (e.g., `.venv/bin/modal deploy backend/app.py`).

2. **Frontend React SPA Execution**:
   - React frontend resides in `frontend/`. Always execute `npm` commands inside `frontend/` (e.g. `cd frontend && npm run build`).
   - Static typecheck is enforced via `tsc && vite build`. Always verify clean production compilation (`0 errors`) before pushing or deploying.

3. **Holistic Architectural Scoping**:
   - Code updates must consider the end-to-end system architecture (Vite + React 18 SPA frontend, Modal serverless multi-agent backend, FastAPI endpoints, Supabase database, and Railway deployment).

4. **Multi-Turn Session & Semantic Cache Rules**:
   - Single-turn standalone queries check `semantic_cache` (similarity threshold >= 0.95).
   - Multi-turn conversation sessions (`conversation_history` present) **MUST bypass semantic cache** (`if not conversation_history:`).

5. **Continuous Documentation Integrity**:
   - Whenever updating features, backend endpoints, or frontend components, immediately update `AGENTS.md` and `docs/frontend.md`.

6. **Query Polling Resilience & Database Fallback Protocol**:
   - `ChatContext.tsx` uses consecutive error counting (aborts only after 10 consecutive network failures) with a 180-second timeout to support long RAG queries (20–45s).
   - `/query/status/{query_id}` falls back to `query_interaction_logs` and `semantic_cache` in Supabase if Modal volume sync lags, returning a processing state rather than HTTP 404.
   - Pending assistant queries are auto-resumed on session mount or switch.
