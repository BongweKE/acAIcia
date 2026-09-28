# ADR 0010: Database Security Posture — RLS Deny-by-Default with a Service-Role Backend

- **Status**: Approved & Implemented
- **Date**: 2026-09-28
- **Deciders**: Landscape Alliance Engineering Team

---

## 1. Context & Problem Statement

The Supabase project (`ihglhsqegpfkeajrbmgn`) accumulated repeated security-advisor
warnings because the schema had an **inconsistent Row Level Security (RLS)
posture**:

* 14 tables had RLS **enabled with no policies** (deny-by-default), but
* 4 *core* tables had RLS **disabled**: `documents_catalog`,
  `document_embeddings` (21k rows), `ingestion_logs`, `query_interaction_logs`.

Supabase grants `SELECT/INSERT/UPDATE/DELETE` on the `public` schema to the
`anon` and `authenticated` roles by default, and the `anon` key is public (it
ships in client apps). With RLS off, **anyone holding the anon key could read or
modify those four tables** and call RPCs that expose chunk text.

Additionally the advisor flagged:
* `public.popular_documents` was a **SECURITY DEFINER view** (bypasses the
  querying role's RLS).
* Six RPC/helper functions had a **mutable `search_path`**.
* Seven **unindexed foreign keys** and one **duplicate HNSW index** (performance).

## 2. Decision Drivers

1. **Prevent data exfiltration** via the public anon key.
2. **Architectural fit**: acAIcia is backend-only — the frontend never talks to
   Supabase directly; the backend authenticates with the `service_role` key,
   which **bypasses RLS**.
3. **Zero behavioural change** to the running application.
4. **Reproducibility**: every change captured as a numbered SQL migration.
5. **Reversibility**.

## 3. Decision Outcome

Adopt **deny-by-default RLS** across the `public` schema, with access solely via
the service-role backend. Migrations `007` and `008`:

* **008 — RLS lock-down**: `ENABLE ROW LEVEL SECURITY` on the four core tables.
  **No policies are added on purpose** — `anon`/`authenticated` get zero rows and
  no writes. `service_role` bypasses RLS, so the backend is unaffected.
* **007 — hardening**: `popular_documents` → `security_invoker = true`;
  `search_path = public` pinned on the six functions; covering indexes added for
  the seven foreign keys; duplicate HNSW index dropped.
* **006 — retrieval fix**: HNSW vector + GIN full-text indexes on
  `document_embeddings` (fixes the `match_documents_hybrid` statement timeout).

### Accepted risk
* `pgvector` remains installed in the `public` schema (`extension_in_public`,
  WARN). Moving it to `extensions` would require re-pointing every function's
  `search_path` and vector cast, for marginal benefit; accepted.
* `rls_enabled_no_policy` remains an INFO-level advisor note for all 18 tables.
  This is the intended posture, not a defect.

### Access model (normative)
| Principal | Access |
| :--- | :--- |
| `service_role` (backend) | Full read/write (bypasses RLS) |
| `anon` / `authenticated` | None (RLS enabled, no policies) |
| Frontend | Talks only to the FastAPI backend over HTTPS |

## 4. Consequences

* **Positive**
  * Leaking the anon key no longer exposes documents, embeddings, telemetry, or
    the RPC surface.
  * Security advisor is free of ERROR findings.
  * Retrieval and analytics are faster (indexes) and hybrid RRF works again.
* **Negative**
  * If a future feature needs direct Supabase access from the browser, explicit
    RLS policies must be written for the relevant tables.
  * Any new table must be created with `ENABLE ROW LEVEL SECURITY` (or added to a
    future migration) to stay consistent.

## 5. Rollback Plan

Per-table (e.g. if an anon-key client is introduced):
```sql
ALTER TABLE public.documents_catalog      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_embeddings    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_logs         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_interaction_logs DISABLE ROW LEVEL SECURITY;
```

Revert individual hardening steps if needed:
```sql
ALTER VIEW public.popular_documents SET (security_invoker = false);
-- drop the covering indexes (they are safe to recreate):
DROP INDEX IF EXISTS public.idx_document_embeddings_document_id; -- …etc per 007
```

Recreate a dropped vector index:
```sql
CREATE INDEX IF NOT EXISTS document_embeddings_hnsw
  ON public.document_embeddings USING hnsw (embedding vector_cosine_ops);
```

Migration files: `database/migrations/006`, `007`, `008`.
