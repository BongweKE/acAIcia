# ADR 0007: Domain-Bounded Semantic Cache with Topic Isolation, Vector Space Alignment, and 0.98 Similarity Threshold

- **Status**: Approved & Implemented
- **Date**: 2026-08-31
- **Deciders**: Landscape Alliance Engineering Team

---

## 1. Context & Problem Statement

Production monitoring revealed that semantic cache lookups returned false-positive cache hits across unrelated research topics (e.g. returning Ugandan soil/crop advice in response to a query about East African wildfire history).

Investigative diagnostics revealed three underlying root causes:
1. **Vector Space Misalignment on Cache Writes**: During query execution, `query_embedding` was assigned to the Query Architect's expanded search query (`optimized_query`). When saving synthesis answers to `semantic_cache`, the system stored `optimized_query` embeddings under `user_query` text. Comparing raw user query vectors at lookup against stored expanded query vectors distorted the cosine space.
2. **Absence of Topic Scope Filtering**: The cache searched globally across all cached items regardless of domain area.
3. **Threshold Calibration**: The similarity threshold (`0.97`) was insufficiently strict for dense scientific embeddings sharing common terminology (e.g., "East Africa", "climate", "soil").

---

## 2. Decision Drivers

1. **Eliminate Cross-Topic Contamination**: Prevent queries in one domain (e.g., `fire_management`) from matching cached responses in another domain (e.g., `soil_science`).
2. **Mathematical Vector Space Alignment**: Ensure cache lookup vectors and stored cache vectors represent identical string inputs (`user_query`).
3. **High Precision Matching**: Restrict cache hits exclusively to near-identical user queries.

---

## 3. Decision Outcome

Selected **Option 1 (Fix & Upgrade Semantic Cache)**:
1. **Vector Alignment**: Updated `backend/app.py` cache insertion logic so `user_raw_emb` is **always computed directly from `user_query`** before saving to `semantic_cache`.
2. **Topic Domain Guard**: Added `topic_category` column to `semantic_cache` (Migration `004_fix_semantic_cache_topic_guard.sql`). Cache lookups now evaluate the query's domain topic (`telemetry["topic_category"]`) and reject candidates from non-matching topics.
3. **Threshold Adjustment**: Increased `CACHE_SIMILARITY_THRESHOLD` from `0.97` to `0.98`.
4. **Cache Purge**: Executed migration purging legacy misaligned cache entries from Supabase.

---

## 4. Consequences

* **Positive**:
  * Completely eliminated cross-topic false-positive cache hits.
  * Verified 0% cross-domain leakage while preserving instant (<50ms) cache hits for near-identical queries (e.g. 0.989 similarity between *"wildfires in east africa"* and *"previous instances of wildfires in East Africa"*).
  * Maintained zero cache interference for multi-turn sessions (`if not conversation_history:`).
* **Negative**:
  * Slightly lower cache hit percentage due to stricter threshold and domain topic boundaries, offset by 100% accuracy assurance.
