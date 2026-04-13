# Setup & Deployment Guide

[← Back to README](../README.md)

acAIcia relies on external tools to orchestrate its serverless nature. This guide breaks down deploying the database, the GPU backend algorithms on Modal, and securing the Streamlit frontend.

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
Provide the Google AI Studio API for the pipeline agents:
```bash
modal secret create acaicia-llm-secrets \
    GOOGLE_API_KEY="your-google-ai-studio-key"
```

---

## 3. Operations & Production Servers

### A. Testing the Backend
Navigate to the `backend` folder. Serve an ephemeral API on a development URL (hot-reloads on save):

```bash
cd backend
modal serve app.py
```

### B. Permanent Deployment
Push the backend natively to an assigned persistent HTTP URL on Modal's network:

```bash
modal deploy app.py
```
*Note this URL explicitly, as the Frontend will require it over REST.*

---

## 4. Frontend Launch (Streamlit)

Before launching, navigate to `frontend/app.py` and modify `BACKEND_URL` to match the persistent endpoint assigned to your API in step 3B. 

To run it locally:
```bash
cd frontend
pip install -r requirements.txt
streamlit run app.py
```

For production rollout, standard deployment through **Streamlit Community Cloud** is highly recommended, as the app is natively stateless. Provide your repository URL to Streamlit Community Cloud and execute from the Root `frontend/app.py` path.
