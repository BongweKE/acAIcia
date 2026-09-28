# acAIcia — Modal → Railway Backend Migration Runbook

Date: 2026-09-28
Author: migration performed by opencode (deepseek-flash)

## Why this migration happened

The acAIcia backend was returning `Error: failed to fetch` on the frontend.
Root cause: **the Modal workspace `ciforicraf-ai` (`ac-YoJ8uBRBXSUGhSYKvm4AdC`)
exceeded Modal's $30/month Starter spend limit**, so Modal disabled serving for
*every* app in that workspace. The acAIcia backend itself cost only ~$0.10/month;
the budget was consumed by unrelated apps in the same workspace:

| Modal app | Sep 2026 spend |
|---|---|
| `ci-fr-ai` | $19.44 (single-day GPU spike) |
| `acaicia-gemma-inference` | $4.40 |
| `ci-fr-ai-streamlit` | $3.90 (`min_containers=1`, always warm) |
| `rich-document-ingestion` | $2.09 |
| **`acaicia-backend` (ours)** | **$0.10** |

Every request to the Modal endpoint returned:
`modal-http: workspace ac-YoJ8uBRBXSUGhSYKvm4AdC is disabled` (HTTP 404).
The `POST /query` CORS preflight (OPTIONS) had no `Access-Control-Allow-Origin`
header, so the browser aborted with `TypeError: Failed to fetch`.

## Rollback safety net (created before any change)

| Artifact | Location |
|---|---|
| Git tag of the pre-migration commit | `pre-railway-migration-20260927-234348` |
| Full working-tree backup (incl. uncommitted changes) | `/home/pro-g/ProG/acAIcia-backups/acaicia-working-tree-20260927-234348.tar.gz` |
| Modal settings volume snapshot | `acaicia-data-volume:/settings.json` = `{"llm_provider":"mistral"}` |

The legacy Modal backend code is untouched in `backend/app.py` (Modal app
`acaicia-backend`). Rolling back = redeploy it *after* the Modal workspace is
unblocked (raise the usage limit / add a payment method at
https://modal.com/settings/usage).

## New architecture

```
Browser (acaicia.org, Railway service "acAIcia", Dockerfile)
        │  VITE_API_BASE_URL + CORS
        ▼
FastAPI on Railway (service "acAIcia Backend", backend/Dockerfile)
  backend/server.py   ← uvicorn entrypoint (backend.server:app)
  backend/core.py     ← provider resolution, Mistral caller, embeddings, storage
  backend/pipeline.py ← Guardian → Architect → Hybrid Retrieval → Synthesis
  backend/config.py   ← shared constants
        │  SUPABASE_URL / SUPABASE_KEY           │  MISTRAL_API_KEY
        ▼                                         ▼
   Supabase (documents, embeddings, cache)   api.mistral.ai
```

* `backend/app.py` is the **legacy Modal** deployment (kept for rollback only).
* `evaluation_engine.py` is unchanged and reused by the Railway server.
* The embedding model `BAAI/bge-base-en-v1.5` is baked into the image at build
  time, so cold starts never download it.

## Railway inventory

| Thing | Value |
|---|---|
| Project | `acaicia` (`b382fd9e-e95c-4325-998e-94f812795bd3`) |
| Environment | `production` (`ff475f77-db1d-4d19-97b2-78b64ec9e859`) |
| Frontend service | `acAIcia` (`e24109f5-…`) → https://acaicia.org |
| Backend service | `acAIcia Backend` (`2dc47a1d-9c83-49c5-a32c-c1ad64358823`) → https://acaicia-backend-production.up.railway.app |
| Backend Dockerfile | `backend/Dockerfile` (build context = repo root) |

### Backend service variables
`SUPABASE_URL`, `SUPABASE_KEY`, `MISTRAL_API_KEY`, `ADMIN_API_KEY`,
`GOOGLE_API_KEY`, `HF_TOKEN`, `LLM_PROVIDER=mistral`, `ACAICIA_BACKEND_URL`.

### Frontend service variables (changed by this migration)
* `VITE_API_BASE_URL=https://acaicia-backend-production.up.railway.app`
* `BACKEND_URL=https://acaicia-backend-production.up.railway.app/query`

## How to roll back

### Option A — revert the frontend to the old Modal backend (instant)
```bash
cd /home/pro-g/ProG/acAIcia
railway variable set VITE_API_BASE_URL=https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run --service acAIcia --skip-deploys
railway variable set BACKEND_URL=https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run/query --service acAIcia --skip-deploys
railway up --service acAIcia
```
(Only works once the Modal workspace spend limit is resolved.)

### Option B — restore the pre-migration source tree
```bash
git checkout pre-railway-migration-20260927-234348
# or extract the tarball:
tar xzf /home/pro-g/ProG/acAIcia-backups/acaicia-working-tree-20260927-234348.tar.gz -C /some/dir
```

### Option C — roll back the Railway services
```bash
railway redeploy --service "acAIcia Backend" --yes   # redeploy previous backend build
railway deployment list --service "acAIcia Backend" --environment production --json
```

## Post-migration fixes / follow-ups

1. **Run `database/migrations/006_fix_hybrid_retrieval_perf.sql` in Supabase.**
   `match_documents_hybrid` currently exceeds Supabase's statement timeout
   (HTTP 500, code `57014`) because `document_embeddings` lacks an HNSW vector
   index and a GIN full-text index. Until it is applied, retrieval falls back to
   vector-only (`match_documents`) and still returns answers, but hybrid RRF
   quality is unavailable.
2. Admin access is now gated: `/admin/*` (and `POST /settings`) require
   `Authorization: Bearer <ADMIN_API_KEY>`, and the frontend `/admin` page
   requires the key before rendering any content.
