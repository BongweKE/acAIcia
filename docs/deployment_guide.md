# Setup & Deployment Guide

[← Back to README](../README.md)

acAIcia relies on external tools to orchestrate its serverless nature. This guide breaks down deploying the database, the GPU backend algorithms on Modal, and securing the Chainlit frontend.

---

## 1. Database Setup (Supabase)

1. Create a [Supabase](https://supabase.com/) project.
2. Go to the SQL Editor and execute the script found in `database/schema.sql`.
   *This initializes the `vector` extensions implicitly, so ensure your Postgres version supports `pgvector` out-of-the-box.*

---

## 2. Modal Cloud Environment

Modal acts as the cloud GPU orchestrator, spinning up instances instantaneously from zero. 

### A. Authentication
Install the SDK and log into your terminal:

```bash
pip install modal
modal setup
```
*(If a browser doesn't open, generate a token manually via the dashboard and run `modal token set --token-id <id> --token-secret <secret>`)*

### B. Remote Secrets Manager
acAIcia must safely relay authentication between Supabase and Google AI Studio from its isolated cloud instances without hardcoded tokens.

**1. Database Secret:**
Fetch the `service_role` key from your Supabase settings and the Project URL.
```bash
modal secret create acaicia-db-secrets \
    SUPABASE_URL="https://your-project-ref.supabase.co" \
    SUPABASE_KEY="your-service-role-key"
```

**2. LLM Secret:**
Provide the API keys and configuration credentials for the pipeline agents. You must include a Hugging Face API token (`HF_TOKEN`) with access to `google/gemma-4-E2B-it` if you intend to run the self-hosted Gemma 4 Model.

To configure this easily, use the provided interactive script in the root directory:
```bash
./update_secrets.sh
```
*(Alternatively, configure manually: `modal secret create acaicia-llm-secrets LLM_PROVIDER="modal" GOOGLE_API_KEY="..." NVIDIA_API_KEY="..." HF_TOKEN="..." USE_NVIDIA="false"`)*

> [!WARNING]
> **Container Lifecycle and Secrets Cache:** Modal keeps container instances warm to minimize cold starts. When you update Modal secrets (e.g. updating API keys), currently warm containers will **NOT** automatically pick up the new secret values. You must stop the warm instances (e.g., `modal app stop acaicia-backend`) or redeploy them to force Modal to spin up fresh container instances loading the new secret payloads.

---

## 3. Administration & Server Deployments

We provide a comprehensive command-line administration tool `cli_admin.py` in the root directory to handle LLM settings configuration and deployments interactively.

### A. Using the CLI Admin Tool
Run the administration console from your project root:
```bash
python cli_admin.py
```
This tool offers an interactive menu:
1. **Configure Local & Modal Cloud LLM Settings:** Prompts you to choose your LLM provider (`gemini`, `nvidia`, or `modal`), input API keys (`GOOGLE_API_KEY`, `NVIDIA_API_KEY`, `HF_TOKEN`), writes them to a local `backend/.env` file, updates the `acaicia-llm-secrets` secret on Modal, and attempts to sync the active LLM provider choice directly with the persistent volume `/data/settings.json` on your deployed backend.
2. **Deploy Gemma 4 Inference App to Modal:** Packages and deploys the independent model server `gemma_inference.py`.
3. **Deploy Main FastAPI Backend App to Modal:** Packages and deploys the router API `app.py`.
4. **Check Remote Backend & Credentials Status:** Contacts the backend API endpoints to confirm credential validity and view the active cloud LLM provider configuration.
5. **Deploy Chainlit Frontend App to Modal:** Packages and deploys the modern frontend app (`frontend/modal_app.py`) to Modal serverless web hosts.

---

## 4. Manual Deployment Flow

If you prefer to deploy files manually without the CLI tool:

### A. Deploying the Gemma 4 Inference App
Before deploying the main backend, you must deploy the Gemma 4 model server so the backend can locate and query it:
```bash
modal deploy backend/gemma_inference.py
```
*This handles downloading the model weights and hosting the model as a remote service named `acaicia-gemma-inference` on serverless L4 GPUs.*

### B. Testing the Backend Locally/Ephemerally
Navigate to the `backend` folder and serve an ephemeral router API on a development URL (auto-reloads on save):
```bash
cd backend
modal serve app.py
```

### C. Deploying the Main Backend App
Push the main router API to a persistent HTTP endpoint on Modal's serverless network:
```bash
cd backend
modal deploy app.py
```
*Note this URL explicitly (e.g. `https://<username>--acaicia-backend-fastapi-app-entrypoint.modal.run`), as the Frontend Chainlit configuration will require it.*

---

## 5. Frontend Launch (Chainlit)

Before launching or deploying, verify that the `BACKEND_URL` constant in `frontend/app.py` correctly matches the persistent endpoint assigned to your FastAPI backend (from step 4C). The deployment scripts automatically extract this constant at build time to configure the container's runtime environment.

### A. Run Locally
To run the frontend locally in development mode:
```bash
# From project root:
.venv/bin/chainlit run frontend/app.py --port 8000
```
Then navigate to `http://localhost:8000` in your web browser.

### B. Deploy to Modal Cloud
To deploy the frontend to a serverless container environment on Modal:
```bash
# Using CLI Admin tool: Choose Option 5
python cli_admin.py

# Or run manually:
.venv/bin/modal deploy frontend/modal_app.py
```
Upon successful deployment, Modal will output the public URL (e.g. `https://<username>--acaicia-frontend-run.modal.run`). The app will scale dynamically from zero and support native WebSockets for responsive chat streaming.
