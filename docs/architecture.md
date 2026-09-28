# acAIcia System Architecture

[← Back to README](../README.md)

This document outlines the high-level infrastructure, multi-agent logic flow, and data pipelines powering **acAIcia**, the Landscape Alliance AI Research Assistant.

## 1. High-Level Operations Overview

acAIcia relies on a highly decoupled ecosystem split between a **Vite + React 18 SPA Frontend** (Railway), a **Railway FastAPI Backend** (Mistral inference, `backend/server.py`), and **Supabase** (Postgres, pgvector, & Full-Text Search). The legacy Modal deployment (`backend/app.py`) is retained for rollback only — see `docs/railway_migration.md` and ADR 0009.

```mermaid
flowchart TD
    User([fa:fa-user User]) <-->|HTTPS / React SPA UI| UI[Vite + React 18 Frontend — Railway]
    UI <-->|REST API JSON + CORS /query, /settings, /user/settings, /feedback, /admin/metrics| API[Railway FastAPI Backend]

    %% Semantic Cache check
    API <-->|Single-Turn Only: Topic Guard + Vector Cosine Sim >= 0.98| Cache[(Semantic Response Cache — Supabase)]

    %% Hybrid Retrieval
    API <-->|Hybrid Search RRF: pgvector + TSVECTOR| DB[(Supabase Postgres DB)]

    %% Telemetry & Feedback
    API -->|Async Logging| Tel[(query_interaction_logs / query_chunk_logs / query_feedback / evaluation_runs)]

    %% Config & local file store
    API <-->|Read/Write settings.json + query status| FS[(Local file store — /data)]

    %% Provider Routing
    subgraph LLM Providers
        API -->|Default: Mistral API| Mistral[api.mistral.ai]
        API -->|Optional: Gemini API| Gemini[Google AI Studio]
        API -->|Optional: NVIDIA NIM API| NIM[NVIDIA NIM Endpoints]
        API -->|Optional: DeepSeek API| DeepSeek[DeepSeek API]
    end

    %% Evaluation Suite
    subgraph Automated RAG Evaluation Suite
        Eval[Admin-triggered worker — background thread] -->|POST /query| API
        Eval -->|Record Benchmark Stats| DB
    end
```

## 2. Core Architectural Pillars

1. **Multi-Session & Profile Management:**
   - **Guest Session Mode:** Immediate access without login with local 20-query count limit.
   - **Persistent Multi-Session History:** `localStorage` backed session management (`+ New Research Chat`, switching between sessions, session deletion) both for guests and researchers.
   - **Authenticated Researcher Mode:** Role-based access control unlocking custom LLM provider selection (Gemini, NVIDIA, DeepSeek) and custom synthesis instructions.
2. **Domain-Bounded Semantic Response Caching:**
   - Vector similarity search (`semantic_cache`) returning instant answers (<50ms) for repeat or near-identical queries (similarity >= 0.98).
   - **Domain Topic Guard:** Queries must belong to the exact same research domain (`topic_category`) to prevent cross-domain cache contamination (ADR 0007).
   - **Vector Space Alignment:** Stores and matches raw user query embeddings (`user_query`), bypassing Query Architect query expansion vectors.
   - **Session Context Guard:** Evaluated **only for standalone single-turn queries** (`if not conversation_history`). Multi-turn chat sessions bypass semantic cache to maintain conversational context.
3. **Hybrid Search (Dense pgvector + Sparse Full-Text RRF):**
   - Reciprocal Rank Fusion (`match_documents_hybrid` RPC) combining dense vector embeddings (`BAAI/bge-base-en-v1.5`) with PostgreSQL `to_tsvector` text search.
4. **Granular Telemetry & Chunk Ranking:**
   - Per-stage execution timers (`guardian_ms`, `architect_ms`, `retrieval_ms`, `synthesis_ms`) logged to `query_interaction_logs`.
   - Detailed chunk ranking metadata (`vector_score`, `text_score`, `rrf_score`, `final_rank`) logged to `query_chunk_logs`.
5. **In-Chat Feedback & Quality Loop:**
   - Interactive feedback buttons (`👍 Useful`, `👎 Needs Work`) and correction modal, logged to `query_feedback`.
6. **Admin Observability & RAG Evaluation Dashboard:**
   - Live dashboard view (`/admin`) displaying p50/p95 latency metrics, cache hit rate %, token costs, user satisfaction sentiment, and automated RAG evaluation benchmark history (`evaluation_runs`).

---

## Detailed Modules
For more specific inner workings, consult the specialized documentation:
- [AGENTS.md System & Agent Architecture Guide](../AGENTS.md)
- [Backend Agents Engine](backend_agents.md)
- [Data Ingestion Pipeline](data_ingestion.md)
- [Frontend Architecture](frontend.md)
- [Database Schema](database_schema.md)
- [Deployment & Setup Guide](deployment_guide.md)
- [Expected Costs & Scaling Plan](cost_model.md)
