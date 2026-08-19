# acAIcia

**Landscape Alliance Knowledge Base AI Assistant**

acAIcia is a robust, highly modular AI application designed to securely aggregate, chunk, encode, and intelligently query vast internal research documents natively focusing on agricultural, forestry, and climate-change contexts. 

Built using a highly decoupled architecture spanning Supabase, Modal serverless GPU containers, and Chainlit, it features dual session management (guest & authenticated), hybrid search RRF, semantic response caching (<50ms lookup), in-chat response feedback, custom research preferences, granular latency telemetry, and an automated RAG evaluation suite.

---

## Documentation Index

We maintain comprehensive documentation for all major components and feature guides in the `docs/` directory:

1. **[System Architecture](docs/architecture.md)** — High-level infrastructure, semantic caching, hybrid RRF, and dual session flow.
2. **[Multi-Agent Backend Engine](docs/backend_agents.md)** — Pipeline sequence, Guardian/Architect/Synthesis agent prompts, and fallback logic.
3. **[GPU Data Ingestion Pipeline](docs/data_ingestion.md)** — Parsing PDFs/DOCXs natively via cloud T4 GPUs into `pgvector` tensors.
4. **[Database Schema (Supabase)](docs/database_schema.md)** — Relational document catalog, user profiles, feedback, cache, chunk logs, and `match_documents_hybrid` RPC.
5. **[Frontend & Feature Guides](docs/frontend.md)** — Guides for User Settings (`/settings`), In-Chat Feedback (`👍`/`👎`), and Admin Observability (`/admin`).
6. **[Deployment & Setup Guide](docs/deployment_guide.md)** — Step-by-step instructions for syncing database secrets and cloud deployments.

---

## Interactive Features & Command Guide

### 1. User Authentication & Guest Sessions
- **Guest Access:** Immediate access without logging in. Chat history is preserved locally in browser session storage.
- **Authenticated Accounts:** Click **Sign In / Sign Up** on the welcome card or login header. Authenticated users unlock persistent multi-device conversation history stored in Supabase.

### 2. User Profile & Custom Research Instructions
- **View Settings:** Type `/settings` in the chat composer to open the forest-themed User Settings & Profile panel.
- **Set Custom Research Preferences:** Type `/set_instructions [your custom instruction here]` in the chat composer.
  - *Example:* `/set_instructions Focus on East Africa agroforestry policy briefs and quantitative metrics.`
  - **Behavior:** Active custom instructions are saved to your `user_profiles` record in Supabase and automatically injected into Synthesis Agent prompts across chats.

### 3. In-Chat Response Feedback
- Click **`👍 Useful`** or **`👎 Needs Work`** under any synthesized response card to log ratings and text corrections directly into the `query_feedback` telemetry table for continuous quality evaluation.

### 4. Admin RAG Observability Dashboard
- Type `/admin` in the chat composer to open the real-time RAG Observability Dashboard:
  - **Total Queries & Cache Hit Rate %:** Measures semantic cache effectiveness.
  - **p95 Latency & User Satisfaction %:** End-to-end performance and feedback ratio.
  - **Stage Latency Breakdown:** Real-time timing bars for Guardian Agent, Architect Agent, Hybrid Retrieval, and Synthesis Agent.
  - **Evaluation History:** Recent RAG evaluation benchmark run results (`evaluation_runs`).

---

## Quick Start & Deployment

1. **Setup Database Migration**:
   Run [database/migrations/001_add_auth_and_telemetry.sql](database/migrations/001_add_auth_and_telemetry.sql) in your Supabase SQL Editor.

2. **Deploy Backend to Modal**:
   ```bash
   .venv/bin/modal deploy backend/app.py
   ```

3. **Deploy Frontend to Modal or Railway**:
   ```bash
   .venv/bin/modal deploy frontend/modal_app.py
   ```
