# ADR 0006: Python-Side Cosine Similarity Fallback for PostgREST pgvector Serialization

- **Status**: Approved & Implemented
- **Date**: 2026-08-25
- **Deciders**: Landscape Alliance Engineering Team

---

## 1. Context & Problem Statement

When querying the Supabase pgvector RPC function `match_semantic_cache` via the PostgREST client, PostgREST stringified float arrays in a format that produced corrupted vector distances, resulting in false-positive similarity matches equal to `1.0` regardless of query content.

---

## 2. Decision Drivers

1. **Reliable Similarity Calculation**: Eliminate PostgREST vector string corruption during HTTP transport.
2. **Backward Compatibility**: Preserve existing Supabase database schema without breaking existing database tables.
3. **Sub-millisecond Performance**: Ensure Python-side vector calculations execute in sub-millisecond time.

---

## 3. Decision Outcome

Implemented a **Python-Side Cosine Similarity Cache Subsystem**:
* **Database Schema Extension**: Migration `002_fix_semantic_cache.sql` added a `stored_embedding_text` column storing normalized 768-dim float arrays as reliable comma-separated text strings (e.g., `"0.01234567,-0.09876543,..."`).
* **Python Computation**: On lookup, `backend/app.py` fetches recent cache rows, parses `stored_embedding_text` using `np.fromstring(emb_text, sep=",", dtype=np.float32)`, and calculates dot products directly against normalized query vectors in NumPy.
* **Database Purge**: Executed a database migration purging corrupted legacy cache entries.

---

## 4. Consequences

* **Positive**:
  * Completely eliminated PostgREST vector string corruption issues.
  * Guaranteed mathematically exact float32 cosine similarity calculation in Python.
* **Negative**:
  * Requires fetching recent cache text rows from Supabase (capped at 200 rows), which scales well for standard operational cache sizes.
