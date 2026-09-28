# acAIcia Deployment & Setup Guide

[← Back to README](../README.md)

This guide covers deploying **acAIcia** to **Railway** — both the React SPA
frontend and the FastAPI (Mistral) backend. The legacy Modal Cloud deployment is
retained in `backend/app.py` for rollback only (see `docs/railway_migration.md`
and `docs/adrs/0009-…`).

---

## 1. Prerequisites & Environment Setup

### Required credentials (Railway environment variables)

| Secret Key | Where Used | Description |
|---|---|---|
| `SUPABASE_URL` | Backend | Supabase project URL |
| `SUPABASE_KEY` | Backend | Supabase **service-role** key (bypasses RLS) |
| `MISTRAL_API_KEY` | Backend | Mistral AI API key (inference) |
| `ADMIN_API_KEY` | Backend | Admin dashboard bearer token |
| `GOOGLE_API_KEY` | Backend (optional) | Only if the `gemini` provider is used |
| `HF_TOKEN` | Backend (optional) | HuggingFace token (model is baked into the image) |
| `LLM_PROVIDER` | Backend | `mistral` (default) |
| `ACAICIA_BACKEND_URL` | Backend | Its own public URL (used by the eval worker) |
| `VITE_API_BASE_URL` | Frontend | Backend URL baked into the SPA at build time |

### 🔑 Admin API Key

`/admin/*` and `POST /settings` require `Authorization: Bearer <ADMIN_API_KEY>`.
The frontend `/admin` page gates all content behind key entry (key is stored in
`localStorage` as `acaicia_admin_key`).

Generate one and set it as the `ADMIN_API_KEY` service variable:
```bash
openssl rand -hex 24
railway variable set ADMIN_API_KEY=<key> --service "acAIcia Backend" --skip-deploys
```

> If `ADMIN_API_KEY` is unset, admin access falls back to **open**. Always set it.

---

## 2. Database Migrations

Run SQL migrations in order in the **Supabase SQL Editor** (or via `psql`):

```
001_add_auth_and_telemetry.sql            ← Auth, telemetry, chunk logs, RRF RPC
002_fix_semantic_cache.sql                ← Cache embedding-text representation
003_advanced_analytics.sql                ← Analytics, taxonomy, RAGAS, alerts, views
004_fix_semantic_cache_topic_guard.sql    ← Topic isolation + 0.98 threshold
005_evaluation_system.sql                 ← Evaluation runs/details/canaries/trends
006_fix_hybrid_retrieval_perf.sql         ← HNSW + GIN indexes (fixes hybrid timeout)
007_db_security_perf_hardening.sql        ← invoker view, search_path, FK indexes
008_lock_down_public_rls.sql              ← RLS deny-by-default on core tables
```

> All `public` tables run with RLS enabled and **no policies** — the backend uses
> the service-role key; the frontend never talks to Supabase directly. See ADR 0010.

---

## 3. Deploying the Backend (Railway)

The backend is `backend/server.py` (uvicorn) built by `backend/Dockerfile`
(build context = repo root). CPU-only PyTorch + the `bge-base-en-v1.5` embedding
model are baked into the image.

```bash
railway up --service "acAIcia Backend" --environment production
```

- Public URL: `https://acaicia-backend-production.up.railway.app`
- Health check: `GET /health`
- Service config: `build.dockerfilePath = backend/Dockerfile` (set via
  `railway api`/dashboard), `healthcheckPath = /health`.

---

## 4. Deploying the Frontend (Railway)

The frontend is the multi-stage root `Dockerfile` (Node 20 → `serve`).

```bash
railway up --service "acAIcia" --environment production
```

- Live URL: https://acaicia.org
- `VITE_API_BASE_URL` is declared as a Docker build `ARG` and must point at the
  backend URL so Vite bakes it in at build time.

---

## 5. Verification & Health Monitoring

```bash
# Backend logs
railway logs --service "acAIcia Backend" --lines 100

# Health + settings
curl https://acaicia-backend-production.up.railway.app/health
curl https://acaicia-backend-production.up.railway.app/settings

# Admin endpoints (replace <KEY>)
curl -H "Authorization: Bearer <KEY>" \
  "https://acaicia-backend-production.up.railway.app/admin/metrics"
curl -H "Authorization: Bearer <KEY>" \
  "https://acaicia-backend-production.up.railway.app/admin/users"
curl -H "Authorization: Bearer <KEY>" \
  "https://acaicia-backend-production.up.railway.app/admin/export/csv" -o logs.csv
```

---

## 6. LLM Provider Cost Reference

Hardcoded in `backend/config.py` (`COST_PER_1M_TOKENS`) and used for the
`estimated_cost_usd` telemetry + admin cache stats. Verified against
<https://mistral.ai/pricing/api/> (2026-09):

| Model | Role | Input ($/1M) | Output ($/1M) |
|---|---|---|---|
| Mistral Small 4 (`mistral-small-latest`) | Synthesis, Architect | $0.15 | $0.60 |
| Ministral 3B (`ministral-3b-latest`) | Guardian | $0.10 | $0.10 |
| Ministral 8B (`ministral-8b-latest`) | Judge / fallback | $0.15 | $0.15 |

> Update `COST_PER_1M_TOKENS` in `backend/config.py` (not `backend/app.py`) as
> provider prices change, then redeploy the backend.
