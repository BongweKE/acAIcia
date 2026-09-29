# ADR 0012: Native pgvector Semantic Cache

## Status
Proposed

## Context
The current semantic cache loads up to 200 rows into Python memory and executes a brute-force cosine similarity loop in `backend/core.py`. As the cache size grows past 1,000 entries, this introduces memory bloat and latency bottlenecks.

## Decision
We will migrate the semantic cache to use native `pgvector` indexing in Supabase. We will add an `embedding vector(768)` column to `semantic_cache` and create an HNSW index on `semantic_cache(embedding vector_cosine_ops)`. Cache queries will use a single Supabase RPC call (`match_semantic_cache`) with topic filtering.

## Consequences
- **Positive:** Scales to 100,000+ cache entries. Eliminates Python-side brute-force scan. Lookup latency will remain under 15ms.
- **Negative:** Requires running a database migration and a backfill script to compute and store existing text embeddings as native vectors.
