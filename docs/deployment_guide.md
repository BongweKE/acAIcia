# acAIcia Deployment & Setup Guide

[← Back to README](../README.md)

This guide provides step-by-step instructions for deploying **acAIcia** to cloud infrastructure spanning **Railway** (React SPA Frontend) and **Modal Cloud** (FastAPI Backend, GPU inference, and Cron evaluators).

---

## 1. Prerequisites & Environment Setup

### Required Credentials & Secrets
Ensure the following keys are configured in Modal Secrets or Railway environment settings:
- **Supabase DB**: `SUPABASE_URL`, `SUPABASE_KEY`
- **LLM APIs**: `GOOGLE_API_KEY`, `NVIDIA_API_KEY`, `DEEPSEEK_API_KEY`
- **Modal Volumes**: `acaicia-data-volume`, `acaicia-hf-cache`, `acaicia-ram-cache`

---

## 2. Deploying Backend to Modal Cloud

1. **Deploy Core FastAPI Backend Engine**:
   ```bash
   .venv/bin/modal deploy backend/app.py
   ```
   *Output Endpoint:* `https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run`

2. **Deploy Gemma Inference Class (Optional / Guest Provider)**:
   ```bash
   .venv/bin/modal deploy backend/gemma_inference.py
   ```

---

## 3. Deploying Frontend to Railway

1. **Build Configuration (`Dockerfile`)**:
   Railway uses a multi-stage build:
   - **Stage 1 (Builder)**: Node 20 environment compiles React SPA (`npm run build`) into `dist/`.
   - **Stage 2 (Server)**: Lightweight Node server running `serve -s dist -l $PORT`.

2. **Trigger Deployment**:
   ```bash
   git add .
   git commit -m "deploy: update production application"
   git push origin main
   ```
   Railway automatically detects the push and deploys to [https://acaicia.org](https://acaicia.org).

3. **Deploy Backup Frontend to Modal**:
   ```bash
   .venv/bin/modal deploy frontend/modal_app.py
   ```
   *Output Endpoint:* `https://ciforicraf-ai--acaicia-frontend-fastapi-app-entrypoint.modal.run`

---

## 4. Verification & Health Monitoring

- **Check Railway Service Status**:
   ```bash
   railway status
   railway logs -n 50
   ```
- **Check Modal Containers & Logs**:
   ```bash
   .venv/bin/modal app list
   .venv/bin/modal app logs acaicia-backend
   ```
