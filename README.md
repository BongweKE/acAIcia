# acAIcia

**CIFOR-ICRAF Knowledge Base AI Assistant**

acAIcia is a robust, highly modular AI application designed to securely aggregate, chunk, encode, and intelligently query vast internal research documents natively focusing on agricultural, forestry, and climate-change contexts. 

Built using a highly decoupled architecture spanning Supabase, Modal serverless GPU containers, and Chainlit, it is capable of zero-overhead querying, native semantic embeddings securely calculated locally in VRAM, and dynamic citation generation via chaining heavily curated LLM API endpoints.

---

## Documentation Index

We maintain comprehensive documentation for all major components and logic chains in the `docs/` directory:

1. **[System Architecture](docs/architecture.md)** — Learn how the Chainlit, Modal, and Supabase components interact.
2. **[Multi-Agent Backend Engine](docs/backend_agents.md)** — Understand the 4-stage pipeline (Guardian, Architect, Retrieval, and Synthesis).
3. **[GPU Data Ingestion Pipeline](docs/data_ingestion.md)** — Details on parsing PDFs/DOCXs natively via cloud T4 GPUs into `pgvector` tensors.
4. **[Database Schema (Supabase)](docs/database_schema.md)** — The Postgres definitions mapping relational document catalogs to math vectors cleanly alongside Telemetry logging.
5. **[Frontend](docs/frontend.md)** — The minimalist UI logic controlling citation parsing.
6. **[Deployment & Setup Guide](docs/deployment_guide.md)** — Step-by-step instructions for syncing database secrets and cloud deployments natively.

---

## Quick Start (Interactive Administration)

For the easiest setup, we provide an interactive command-line administration tool to configure secrets, manage the LLM provider state, and handle deployments.

1. **Setup Database Secret**:
   Configure your Supabase connection on Modal:
   ```bash
   modal secret create acaicia-db-secrets SUPABASE_URL="https://your-project.supabase.co" SUPABASE_KEY="your-service-role-key"
   ```

2. **Configure Settings & Deploy via CLI**:
   Run the interactive administration tool from the root directory:
   ```bash
   python cli_admin.py
   ```
   - Select option **1** to configure your LLM credentials (including the optional Hugging Face `HF_TOKEN` for self-hosted Gemma 4, and optional `DEEPSEEK_API_KEY` for DeepSeek API) and sync settings.
   - Select option **2** to deploy the Gemma 4 Inference app (`gemma_inference.py`) to Modal.
   - Select option **3** to deploy the main FastAPI Backend router app (`app.py`) to Modal.

3. **Ingest Documents**:
   Place PDF/DOCX files inside `ingestion/data/` and push them to the persistent Modal volume:
   ```bash
   cd ingestion
   pip install -r requirements.txt
   python upload.py
   ```

4. **Launch Application**:
   Boot up the Chainlit interface (Remember to verify that the `BACKEND_URL` inside [frontend/app.py](frontend/app.py) points to your deployed Modal FastAPI backend first):
   ```bash
   .venv/bin/chainlit run frontend/app.py --port 8000
   ```

For manual deployment workflows, container secrets caching warnings, and structural deep dives, refer to the [Documentation Index](#documentation-index).
