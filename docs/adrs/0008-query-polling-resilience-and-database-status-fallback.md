# 8. Query Polling Resilience and Database Status Fallbacks

* **Status:** Accepted
* **Date:** 2026-08-31
* **Context:** Complex multi-agent RAG queries (incorporating Guardian validation, Query Architect expansion, hybrid vector retrieval, and LLM synthesis) can take 20–30+ seconds to execute. Previously, the frontend status polling loop in `ChatContext.tsx` evaluated `if (pollCount >= 15)` inside its error handler, causing transient status poll errors or Modal volume sync delays occurring at or after second 15 to immediately abort polling and render a premature `❌ Communication Error`. Additionally, `/query/status/{query_id}` relied solely on Modal volume file presence, raising 404 errors when file propagation lagged across containers.

## Decision

1. **Consecutive Error Threshold in Frontend Polling**: Refactored `pollQueryStatus` in `frontend/src/context/ChatContext.tsx` to replace single-poll `pollCount >= 15` error aborts with a `consecutiveErrors` counter. Polling aborts only after 10 consecutive network/server failures (sustained outage), while total polling duration is extended to 180 seconds (3 minutes). Every successful HTTP 200 response resets `consecutiveErrors = 0`.
2. **Backend Status Endpoint DB Fallback**: Updated `/query/status/{query_id}` in `backend/app.py` to add a database fallback. If Modal Volume reload (`vol.reload()`) is lagging or file read fails, the endpoint checks `query_interaction_logs` and `semantic_cache` in Supabase. If the query completed and was recorded in DB, it returns the completed status and response payload. If not found in DB, it returns `{"status": "processing", "stage": "Processing RAG Pipeline"}` instead of raising HTTP 404.
3. **Pending Query Auto-Recovery**: Added session mount and switch hooks in `ChatContext.tsx` that scan active session messages for assistant messages with `status === 'processing'` or missing content with a `queryId`, automatically re-initiating polling to recover completed query responses smoothly.

## Consequences

* **Positive**: Eliminates premature polling timeouts on long queries (20–45s). Prevents false 404 errors during Modal volume synchronization. Restores lost or pending queries automatically when users refresh or switch sessions.
* **Trade-offs**: Slightly increased polling window (up to 3 minutes for slow LLM providers), bounded by clean timeout handling.
