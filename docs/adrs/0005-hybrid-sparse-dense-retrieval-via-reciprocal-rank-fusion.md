# ADR 0005: Hybrid Sparse-Dense Retrieval via Supabase Reciprocal Rank Fusion (RRF)

- **Status**: Approved & Implemented
- **Date**: 2026-08-20
- **Deciders**: Landscape Alliance Engineering Team

---

## 1. Context & Problem Statement

Academic research queries in forestry, agroforestry, and soil science frequently contain exact scientific terms, Latin species names (e.g. *Shorea robusta*, *Gliricidia sepium*), DOIs, acronyms (e.g. *ASEAN*, *REDD+*), and specific study region locations (e.g. *Pulang Pisau*, *Labuhanbatu*). Dense vector embeddings alone often smooth over these precise keywords, leading to irrelevant chunk retrieval.

---

## 2. Decision Drivers

1. **Exact Keyword Precision**: Guarantee exact string matching for species names, geographic places, and paper DOIs.
2. **Semantic Concept Search**: Capture high-level research concepts even when exact terminology differs.
3. **Unified Ranking**: Combine sparse full-text search scores and dense vector similarity scores into a single ranked result set.

---

## 3. Decision Outcome

Implemented a **Hybrid Search Pipeline** combining local `BAAI/bge-base-en-v1.5` embeddings (768 dimensions) with Supabase PostgreSQL full-text search (`to_tsvector('english')`) using **Reciprocal Rank Fusion (RRF)**:
* **Supabase RPC (`match_documents_hybrid`)**: Computes dense vector similarity and full-text keyword ranks concurrently in Postgres SQL, combining them via RRF scoring formula: $RRF\_Score = \frac{1}{60 + Rank_{vector}} + \frac{1}{60 + Rank_{text}}$.
* **Fallback Strategy**: If hybrid search yields zero chunks due to strict keyword constraints, automatically fall back to pure vector similarity matching (`match_documents`).
* **Telemetry**: Every retrieved chunk's RRF score and final rank index are logged to `query_chunk_logs` for observability.

---

## 4. Consequences

* **Positive**:
  * Significant improvement in retrieval accuracy for queries with specific geographic places, DOIs, or species names.
  * Robust fallback handling when full-text keyword search finds no direct term matches.
* **Negative**:
  * Slightly higher database execution time compared to single-index queries (optimized via GIN index on `fts` and HNSW index on embeddings).
