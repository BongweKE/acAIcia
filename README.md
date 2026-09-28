# acAIcia

**Landscape Alliance Knowledge Base AI Assistant**

acAIcia is a robust, highly modular AI application designed to securely aggregate, chunk, encode, and intelligently query vast internal research documents natively focusing on agricultural, forestry, soil, and climate-change contexts. 

Built using a highly decoupled architecture spanning a **Vite + React 18 SPA Frontend** (hosted on Railway), a **Railway FastAPI Multi-Agent Backend** (Mistral inference), and **Supabase (pgvector & RRF)**, it features persistent multi-session chat history, guest query limits (20 max), hybrid search RRF, context-guarded semantic caching, in-chat response feedback, custom research instructions, granular latency telemetry, and an automated RAG evaluation suite.

---

## 📚 Documentation Index

We maintain comprehensive technical documentation for all major components in `AGENTS.md` and the `docs/` directory:

0. **[AGENTS.md System & Agent Architecture Guide](AGENTS.md)** — Master guide for system architecture, agents, API contracts, and developer guidelines.
1. **[System Architecture](docs/architecture.md)** — High-level infrastructure, semantic caching, hybrid RRF, and session flow.
2. **[Multi-Agent Backend Engine](docs/backend_agents.md)** — Pipeline sequence, Guardian/Architect/Synthesis agent prompts, and fallback logic.
3. **[GPU Data Ingestion Pipeline](docs/data_ingestion.md)** — Parsing PDFs/DOCXs natively via cloud T4 GPUs into `pgvector` tensors.
4. **[Database Schema (Supabase)](docs/database_schema.md)** — Relational document catalog, user profiles, feedback, cache, chunk logs, and `match_documents_hybrid` RPC.
5. **[Frontend & Feature Guides](docs/frontend.md)** — Guides for React SPA components, Multi-Session History, Settings (`/settings`), In-Chat Feedback (`👍`/`👎`), and Admin Observability (`/admin`).
6. **[Architectural Decision Records (ADRs)](docs/adrs/0001-landscape-alliance-design-system-and-top-nav-redesign.md)** — Record of architectural decisions (Design system redesign, machine UUID tracking, admin model governance).
7. **[Deployment & Setup Guide](docs/deployment_guide.md)** — Step-by-step instructions for deploying the backend and frontend to Railway (legacy Modal notes included).
8. **[Expected Costs & Scaling Plan](docs/cost_model.md)** — Data-backed cost model and optimum architecture changes for 10 → 500 users.
9. **[Migration Runbook](docs/railway_migration.md)** — Modal → Railway migration details and rollback steps.
10. **[Product Backlog & Engineering Roadmap](BACKLOG.md)** — Prioritized implementation backlog (P0 hotfixes to P3 hardening) and architecture evolution.

---

## ⚡ Quick Start & Deployment

1. **Install Frontend Dependencies**:
   ```bash
   cd frontend && npm install
   ```

2. **Run React Frontend Locally**:
   ```bash
   npm run dev
   ```

3. **Deploy Backend to Railway**:
   ```bash
   railway up --service "acAIcia Backend" --environment production
   ```

4. **Deploy Frontend to Railway**:
   ```bash
   railway up --service "acAIcia" --environment production
   # Or push to main branch for automated Railway build & deployment
   git push origin main
   ```
