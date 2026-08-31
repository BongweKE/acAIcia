# acAIcia Deployment & Setup Guide

[← Back to README](../README.md)

This guide provides step-by-step instructions for deploying **acAIcia** to cloud infrastructure spanning **Railway** (React SPA Frontend) and **Modal Cloud** (FastAPI Backend, GPU inference, and Cron evaluators).

---

## 1. Prerequisites & Environment Setup

### Required Credentials & Secrets
Ensure the following keys are configured in **Modal Secrets** (`acaicia-llm-secrets`) and **Railway environment settings**:

| Secret Key | Where Used | Description |
|---|---|---|
| `SUPABASE_URL` | Modal, Railway | Supabase project URL |
| `SUPABASE_KEY` | Modal, Railway | Supabase service-role key |
| `GOOGLE_API_KEY` | Modal | Google Gemini API key |
| `NVIDIA_API_KEY` | Modal | NVIDIA NIM API key |
| `DEEPSEEK_API_KEY` | Modal | DeepSeek API key |
| `HF_TOKEN` | Modal | HuggingFace token for bge-base model |
| **`ADMIN_API_KEY`** | **Modal** | **Admin dashboard bearer token (new)** |

### 🔑 Admin API Key Setup

The `/admin/*` endpoints require a bearer token for security. To configure:

1. **Generate a secure key**:
   ```bash
   openssl rand -base64 32
   ```
2. **Add it to Modal secrets** (in the `acaicia-llm-secrets` secret group):
   ```
   ADMIN_API_KEY = <your-generated-key>
   ```
3. **Add it to the frontend**: In the acAIcia admin dashboard, click the key icon (🔑) and enter the same key. It is stored in `localStorage` as `acaicia_admin_key` and sent as `Authorization: Bearer <key>` on all `/admin/*` requests.

> **Note**: If `ADMIN_API_KEY` is not set in Modal, all admin endpoints are open (backward-compatible fallback). **Always set this key in production.**

---

## 2. Database Migrations

Run all SQL migrations in order in the **Supabase SQL Editor**:

```
database/migrations/001_add_auth_and_telemetry.sql   ← Auth, telemetry, chunk logs
database/migrations/002_fix_semantic_cache.sql        ← Cache fix
database/migrations/003_advanced_analytics.sql        ← Analytics platform (new)
```

Migration 003 adds:
- `topic_taxonomy` — topic classification reference table
- `analytics_daily_summary` — nightly pre-aggregated summaries
- `hourly_activity` — heatmap data
- `user_analytics_summary` — per-user cost summaries
- `production_eval_scores` — per-query RAGAS scores
- `system_alerts` — retrieval gap and health alerts
- `popular_documents` — view of most-retrieved docs
- Several SQL RPCs for parametric analytics queries

---

## 3. Deploying Backend to Modal Cloud

1. **Deploy Core FastAPI Backend Engine**:
   ```bash
   .venv/bin/modal deploy backend/app.py
   ```
   *Output Endpoint:* `https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run`

2. **Deploy Gemma Inference Class (Optional / Guest Provider)**:
   ```bash
   .venv/bin/modal deploy backend/gemma_inference.py
   ```

3. **Verify deployment logs**:
   ```bash
   .venv/bin/modal app logs acaicia-backend --last 100
   ```

---

## 4. Deploying Frontend to Railway

1. **Build Configuration (`Dockerfile`)**:
   Railway uses a multi-stage build:
   - **Stage 1 (Builder)**: Node 20 environment compiles React SPA (`npm run build`) into `dist/`.
   - **Stage 2 (Server)**: Lightweight Node server running `serve -s dist -l $PORT`.

2. **Trigger Deployment**:
   ```bash
   git add .
   git commit -m "deploy: advanced analytics dashboard"
   git push origin main
   ```
   Railway automatically detects the push and deploys to [https://acaicia.org](https://acaicia.org).

3. **Check Railway Logs**:
   ```bash
   railway status
   railway logs -n 100
   ```

4. **Deploy Backup Frontend to Modal**:
   ```bash
   .venv/bin/modal deploy frontend/modal_app.py
   ```
   *Output Endpoint:* `https://ciforicraf-ai--acaicia-frontend-fastapi-app-entrypoint.modal.run`

---

## 5. Verification & Health Monitoring

- **Check Modal Containers & Logs**:
  ```bash
  .venv/bin/modal app list
  .venv/bin/modal app logs acaicia-backend
  ```

- **Test the new admin endpoints** (replace `<KEY>` with your ADMIN_API_KEY):
  ```bash
  # Metrics with 7-day filter
  curl -H "Authorization: Bearer <KEY>" \
    "https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run/admin/metrics?start_date=$(date -d '-7 days' +%Y-%m-%d)"

  # User cost breakdown
  curl -H "Authorization: Bearer <KEY>" \
    "https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run/admin/users"

  # System alerts
  curl -H "Authorization: Bearer <KEY>" \
    "https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run/admin/alerts"

  # CSV export
  curl -H "Authorization: Bearer <KEY>" \
    "https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run/admin/export/csv" -o logs.csv
  ```

- **LLM Provider Cost Reference** (hardcoded in `backend/app.py`):

  | Provider | Input (per 1M tokens) | Output (per 1M tokens) |
  |---|---|---|
  | Gemini 2.5 Flash | $1.50 | $7.50 |
  | NVIDIA Llama 3.3 70B | $0.35 | $0.40 |
  | DeepSeek Reasoner | $0.44 | $0.88 |
  | Modal Gemma (self-hosted) | $0.00 | $0.00 |

  > Update these rates in `COST_PER_1M_TOKENS` dict in `backend/app.py` as provider prices change.
