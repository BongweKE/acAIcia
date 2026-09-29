# ADR 0011: Multi-Replica Shared Query Status Store

## Status
Accepted

## Context
Currently, the backend tracks in-flight query states via ephemeral JSON files in `/tmp/acaicia_status/{query_id}.json`. When traffic scales to Phase 2 (100+ users) and Railway scales to 2+ backend containers, requests are load-balanced across replicas. A client polling `GET /query/status/{query_id}` may hit Replica B while Replica A is processing the query, resulting in false 404s. We need a shared state store to support horizontal scaling.

## Decision
We will provision a `query_jobs` table in Supabase to track query states (processing, completed, failed, stage updates). We will replace the local file I/O in `FileSettingsStore` with Supabase row updates.

## Consequences
- **Positive:** Unblocks multi-replica deployment on Railway. Eliminates 404 polling errors.
- **Negative:** Adds slight network latency to status updates compared to local file I/O. Requires migrating `STORE` logic in `backend/server.py`.
