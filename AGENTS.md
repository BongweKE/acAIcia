# AGENTS.md — acAIcia System & Agent Architecture Guide

This document provides a comprehensive technical overview of **acAIcia**, the AI Research Assistant for **Landscape Alliance (formerly CIFOR-ICRAF)**. It details the multi-agent RAG system architecture, frontend React SPA, API contracts, database integrations, security guidelines, and cloud deployment topology.

---

## 🌿 Executive Summary

acAIcia is an end-to-end evidence synthesis system designed to empower forestry, climate, soil, and agroforestry researchers. It combines a **Vite + React 18 SPA frontend** with a **Modal-hosted Python multi-agent backend** to ingest scientific publications, perform hybrid dense-vector and full-text keyword retrieval, and generate academic answers with strict `[Author(s), Year]` inline citations and DOI hyperlinks.

---

## 🏛️ System Architecture

```
                                    +-----------------------------------+
                                    |        Vite + React 18 SPA        |
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
- **Behavior**: Stores query embeddings and answers in `semantic_cache` table (similarity match threshold >= 0.95).
- **Context Guard**: Checked **only for standalone single-turn queries** (`if not conversation_history`). Multi-turn conversation sessions bypass semantic cache to maintain conversation session context.

---

## ⚛️ React Frontend Architecture (`frontend/`)

- **Tech Stack**: Vite, React 18, TypeScript, Tailwind CSS, Lucide Icons.
- **Design System**: Forestry dark green palette (`#0F291E`), emerald glassmorphism, dark/light contrast modes, responsive sidebar navigation.
- **Context Providers (`frontend/src/context/`)**:
  - `AuthContext`: Role-based access control (`guest`, `researcher`, `admin`). Tracks guest 20-query limit.
  - `ChatContext`: Persistent multi-session chat history (`localStorage` backed). Supports `+ New Research Chat`, switching between sessions, and session deletion.
  - `SettingsContext`: Multi-LLM provider selection (Modal Gemma 4 for guests; Gemini 2.5 Flash, NVIDIA Llama 3.3 70B, DeepSeek Reasoner for researchers) and custom instructions.
  - `ToastContext`: Toast alert notifications for status feedback.
- **API Client (`frontend/src/api/client.ts`)**: Connects to the FastAPI backend API with automatic fallback to `https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run`.

---

## 📡 API Contract Reference

| Endpoint | Method | Request Payload | Response / Output |
| :--- | :--- | :--- | :--- |
| `/prompt_pills` | `GET` | None | `{ pills: string[] }` |
| `/query` | `POST` | `{ query, session_id, user_id, conversation_history }` | `{ query_id, status: "processing" }` |
| `/query/status/{query_id}` | `GET` | None | `{ status, response, sources, stage, cache_hit }` |
| `/settings` | `GET` | None | `SettingsResponse` (active provider, key status) |
| `/settings` | `POST` | `{ llm_provider: string }` | Updated `SettingsResponse` |
| `/user/settings` | `GET` | `?user_id=...` | User profile object |
| `/user/settings` | `POST` | `UserProfileRequest` | `{ status: "success", profile }` |
| `/feedback` | `POST` | `{ log_id, user_id, rating, correction_text }` | `{ status: "success" }` |
| `/admin/metrics` | `GET` | None | `AdminMetricsResponse` (latencies, cache hits, evals) |

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

1. **Zero Hardcoded Secrets**: All secret keys (`SUPABASE_KEY`, `GOOGLE_API_KEY`, `NVIDIA_API_KEY`, `DEEPSEEK_API_KEY`) are managed via Modal Secrets or Railway environment settings.
2. **CORS Policy**: Backend FastAPI configured with `CORSMiddleware` to allow requests from Railway and Modal frontend origins.
3. **Git Hygiene**: `.gitignore` excludes `node_modules/`, `dist/`, `.agents/`, `.env`, `.venv`, and temporary logs.
