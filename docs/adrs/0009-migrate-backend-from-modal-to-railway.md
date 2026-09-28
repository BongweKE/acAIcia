# ADR 0009: Migrate the Backend from Modal Cloud to Railway (Mistral-only)

- **Status**: Approved & Implemented
- **Date**: 2026-09-28
- **Deciders**: Landscape Alliance Engineering Team
- **Supersedes**: ADR 0004 (Serverless Multi-Agent RAG Architecture on Modal Cloud)

---

## 1. Context & Problem Statement

ADR 0004 hosted the multi-agent backend on Modal Cloud (`modal.App("acaicia-backend")`).
On 2026-09-24 the frontend began returning `Error: failed to fetch`.

Root cause: the shared Modal workspace `ciforicraf-ai` (`ac-YoJ8uBRBXSUGhSYKvm4AdC`)
**exceeded Modal's $30/month Starter spend limit**. Modal disables serving for
*every* app in an over-budget workspace, so all acAIcia backend routes returned:

```
HTTP/2 404
modal-http: workspace ac-YoJ8uBRBXSUGhSYKvm4AdC is disabled
```

The `POST /query` CORS preflight returned no `Access-Control-Allow-Origin`, so
the browser aborted with `TypeError: Failed to fetch`.

The acAIcia backend itself cost only ~$0.10/month; the budget was consumed by
unrelated apps in the same workspace (`ci-fr-ai` alone spent $19.44 in a day).
The failure was therefore **not** a code bug and **not** fixable in code — it was
a shared-account blast radius.

## 2. Decision Drivers

1. **Failure isolation**: acAIcia must not be taken down by unrelated workloads
   sharing a billing/quotas boundary.
2. **Predictable cost**: keep inference on the Mistral API (`mistral-small-latest`
   / `ministral-*`), which is external and cheap, instead of self-hosted GPUs.
3. **Mistral-only simplicity**: the product no longer needs Modal GPU Gemma.
4. **Reuse**: the frontend already runs on Railway, so co-locating the backend
   simplifies operations and avoids a second vendor dependency.
5. **Reversibility**: the migration must be fully rollback-able.

## 3. Decision Outcome

Move the backend to **Railway** as a plain containerised FastAPI service, with
Mistral as the only inference provider.

* **New modules** (Modal-free):
  * `backend/server.py` — FastAPI app + `uvicorn` entrypoint (`backend.server:app`).
  * `backend/core.py` — provider resolution, provider-agnostic LLM caller
    (Mistral primary), embeddings, admin auth, file-based settings/status store.
  * `backend/pipeline.py` — the Guardian → Architect → Hybrid Retrieval →
    Synthesis pipeline, dependency-injected (was `process_query_async`).
  * `backend/config.py` — shared constants.
* **Container**: `backend/Dockerfile` (build context = repo root) installs
  CPU-only PyTorch, bakes `BAAI/bge-base-en-v1.5` into the image, and runs
  `uvicorn backend.server:app`.
* **Async model**: `/query` submits to an in-process `ThreadPoolExecutor`;
  status is persisted to a file store (`ACAICIA_DATA_DIR`) with a Supabase
  fallback in `/query/status/{id}`.
* **State**: Supabase (documents/telemetry) + local file store; no Modal
  Volumes, no `modal.Dict`, no GPU, no cron.
* **Provider**: `LLM_PROVIDER=mistral`; the `modal` (Gemma) option is removed
  from the admin UI.
* **`backend/app.py` is retained unchanged as the legacy Modal deployment**
  (rollback path only).

### Evaluation impact
The weekly Gemma-vs-Mistral `modal.Cron` comparison is Modal-only and does not
run on Railway. Admin-triggered evaluations still run in a background thread via
the unchanged `backend/evaluation_engine.py`, judged by `ministral-8b-latest`.

## 4. Consequences

* **Positive**
  * acAIcia is isolated from unrelated workspaces/projects on Railway.
  * Mistral API inference is inexpensive and scales independently of GPUs.
  * No cold-start model download (embedding model baked into the image).
  * Same codebase supports both deployments (legacy Modal + Railway).
* **Negative**
  * Two deployment targets to maintain while the legacy path exists.
  * The pipeline is now duplicated in spirit by `backend/app.py` (frozen).
  * No Gemma; comparative evaluation requires the legacy Modal deployment.
* **Neutral**
  * Railway is the same vendor as the frontend (single console for the app).

## 5. Rollback Plan

**Option A — point the frontend back at Modal (instant, no code change):**
```bash
railway variable set VITE_API_BASE_URL=https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run --service acAIcia --skip-deploys
railway variable set BACKEND_URL=https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run/query --service acAIcia --skip-deploys
railway up --service acAIcia
```
Only works once the Modal workspace spend limit is resolved
(<https://modal.com/settings/usage>).

**Option B — restore the pre-migration source tree:**
```bash
git checkout pre-railway-migration-20260927-234348
# or
tar xzf /home/pro-g/ProG/acAIcia-backups/acaicia-working-tree-20260927-234348.tar.gz -C <dir>
```

**Option C — roll back the Railway backend service:**
```bash
railway redeploy --service "acAIcia Backend" --yes
railway deployment list --service "acAIcia Backend" --environment production --json
```

**Data**: no migration of user data was required — Supabase remained the system
of record throughout. Rolling back touches only compute routing.

See `docs/railway_migration.md` for the full operational runbook and inventory.
