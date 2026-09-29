# ADR 0013: Cross-Encoder Reranker for Hybrid Search Precision

## Status
Accepted

## Context
The hybrid retrieval system combines dense vector similarity (via `BAAI/bge-base-en-v1.5`) with sparse keyword matching using Reciprocal Rank Fusion (RRF). While bi-encoder vector similarity and BM25/keyword indexing provide fast candidate selection across 20k+ chunks, bi-encoders compute query and passage embeddings independently without cross-attention. In specialized scientific research domains (forestry, agroforestry, soil science, peatland hydrology), top-ranked documents frequently contain superficial keyword matches without directly answering the specific scientific research question, limiting Hit@1 and Hit@5 precision.

## Decision
We implement a two-stage retrieval pipeline:
1. **First-stage retrieval**: The Supabase hybrid search (`match_documents_hybrid` or dense vector fallback) retrieves an initial candidate pool of chunks (top 15).
2. **Second-stage cross-encoder reranking**: A cross-encoder model (`BAAI/bge-reranker-base` via `sentence-transformers.CrossEncoder`) performs full joint cross-attention over `(query, document_passage)` pairs, scoring true semantic relevance.
3. **Top-K selection**: Chunks are re-sorted by their cross-encoder score, and the top 5 highest-confidence chunks are provided to the Synthesis Agent.
4. **Graceful degradation**: If `sentence-transformers` is unavailable or scoring encounters any runtime exception, the pipeline gracefully logs the issue and falls back to the original hybrid retrieval ordering without disrupting synthesis.

## Consequences
- **Positive:** Substantially improves Hit@1 and Hit@5 precision on academic benchmarks. Filters out spurious keyword matches and retains the most contextually relevant evidence for scientific citation.
- **Negative:** Adds ~150-250ms of CPU inference latency per query. Mitigated by caching the model instance in memory (`_cached_reranker`) and bounding candidate rerank pool size to 15 candidates.
