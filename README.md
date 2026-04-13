# acAIcia

**CIFOR-ICRAF Knowledge Base AI Assistant**

acAIcia is a robust, highly modular AI application designed to securely aggregate, chunk, encode, and intelligently query vast internal research documents natively focusing on agricultural, forestry, and climate-change contexts. 

Built using a highly decoupled architecture spanning Supabase, Modal serverless GPU containers, and Streamlit, it is capable of zero-overhead querying, native semantic embeddings securely calculated locally in VRAM, and dynamic citation generation via chaining heavily curated LLM API endpoints.

---

## Documentation Index

We maintain comprehensive documentation for all major components and logic chains in the `docs/` directory:

1. **[System Architecture](docs/architecture.md)** — Learn how the Streamlit, Modal, and Supabase components interact.
2. **[Multi-Agent Backend Engine](docs/backend_agents.md)** — Understand the 4-stage pipeline (Guardian, Architect, Retrieval, and Synthesis).
3. **[GPU Data Ingestion Pipeline](docs/data_ingestion.md)** — Details on parsing PDFs/DOCXs natively via cloud T4 GPUs into `pgvector` tensors.
4. **[Database Schema (Supabase)](docs/database_schema.md)** — The Postgres definitions mapping relational document catalogs to math vectors cleanly alongside Telemetry logging.
5. **[Frontend](docs/frontend.md)** — The minimalist UI logic controlling citation parsing.
6. **[Deployment & Setup Guide](docs/deployment_guide.md)** — Step-by-step instructions for syncing database secrets and cloud deployments natively.

---

## Quick Start (Local Run)

1. **Setup Secrets on Modal**:
   ```bash
   modal secret create acaicia-db-secrets SUPABASE_URL="..." SUPABASE_KEY="..."
   modal secret create acaicia-llm-secrets GOOGLE_API_KEY="..."
   ```

2. **Ingest Documents**:
   Place files inside `ingestion/data/` and push them to the persistent Modal volume:
   ```bash
   cd ingestion
   pip install -r requirements.txt
   python upload.py
   ```

3. **Serve Backend**:
   Spin up the hot-reload FastAPI instance in the cloud:
   ```bash
   cd backend
   modal serve app.py
   ```

4. **Launch Application**:
   Boot up the Streamlit interface (Remember to update the `BACKEND_URL` in `app.py` first):
   ```bash
   cd frontend
   streamlit run app.py
   ```

For detailed deployment parameters and structural deep dives, refer to the [Documentation Index](#documentation-index).
