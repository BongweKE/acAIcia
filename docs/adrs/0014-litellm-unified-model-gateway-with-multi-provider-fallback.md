# ADR 0014: LiteLLM Unified Model Gateway with Multi-Provider Fallback

## Status
Accepted

## Context
Prior to this architecture, LLM calls across the multi-agent pipeline (`guardian`, `architect`, `synthesis`) relied on a sprawling set of provider-specific `if/elif` blocks and disparate SDKs (Mistral Python client, Google GenAI SDK, Modal remote calls, NVIDIA NIM endpoint). This caused fragmentation in token usage telemetry, disparate error handling semantics, absence of automated fallback when primary models were rate-limited or cold-starting, and complex maintenance across batch and streaming pipelines.

## Decision
We adopt LiteLLM (`litellm`) as a unified model gateway layer across all agents:
1. **Unified completion interface**: Agents invoke `call_llm` or `build_llm_stream_caller` routing through LiteLLM when `LLM_PROVIDER=litellm`.
2. **Provider mapping & fallback hierarchy**: Models are assigned per agent type (e.g. `mistral/ministral-3b-latest` for Guardian safety checks, `mistral/ministral-8b-latest` for Query Architect, and `mistral/mistral-small-latest` for Synthesis). If the primary provider experiences a rate limit (HTTP 429), timeout, or service error, LiteLLM automatically retries or fails over to backup providers (e.g. self-hosted Gemma or backup Mistral models).
3. **Normalized token telemetry**: LiteLLM standardizes usage reporting across all vendors into `prompt_tokens`, `completion_tokens`, and `total_tokens`, feeding consistent metrics into query interaction logs and Langfuse observability.
4. **Unified SSE streaming**: Streaming completions are normalized via LiteLLM generator streams with automatic token accounting.

## Consequences
- **Positive:** Single, clean code path for model execution across multiple LLM providers. Eliminates custom SDK glue code. Provides seamless provider failover and accurate token telemetry.
- **Negative:** Introduces `litellm` dependency. Requires careful environment variable propagation (`MISTRAL_API_KEY`, `GEMINI_API_KEY`, etc.) across deployment targets.
