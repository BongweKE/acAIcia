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

## Feature Guides & Interactive Commands

### 1. User Settings & Custom Research Preferences
- Type `/settings` to open the profile settings panel.
- Type `/set_instructions [your custom instructions]` to save personalized prompt preferences across chats (e.g., *"Focus on East Africa agroforestry metrics"*).

### 2. In-Chat Response Feedback
- Click `👍 Useful` or `👎 Needs Work` under any response card to log ratings and text corrections into the `query_feedback` analytics table.

### 3. Admin Observability Dashboard
- Type `/admin` in the chat to display live system telemetry:
  - Total queries & Cache Hit Rate %.
  - p95 End-to-End Latency.
  - User Satisfaction rating (+1 / -1 ratio).
  - Per-stage latency breakdown (Guardian, Architect, Hybrid Retrieval, Synthesis).
  - Historical RAG evaluation benchmark run results.

### 4. Automated RAG Evaluation Suite
- Run automated evaluations against test datasets (`test_questions*.csv`):
  ```bash
  .venv/bin/modal run eval_runner.py
  ```

---

## Quick Start (Interactive Administration)

1. **Setup Database Migration**:
   Run [database/migrations/001_add_auth_and_telemetry.sql](database/migrations/001_add_auth_and_telemetry.sql) in your Supabase SQL Editor.

2. **Configure Secrets & Deploy via CLI**:
   ```bash
   python cli_admin.py
   ```
   - Option **1**: Configure LLM credentials and sync settings.
   - Option **2**: Deploy Gemma 4 Inference app to Modal.
   - Option **3**: Deploy main FastAPI Backend router app to Modal.

3. **Launch Application**:
   ```bash
   .venv/bin/chainlit run frontend/app.py --port 8000
   ```
