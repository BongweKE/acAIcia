"""
acAIcia Gemma Inference Engine (vLLM)
======================================
High-performance self-hosted inference for Gemma models on Modal using vLLM.

This module replaces the previous HuggingFace transformers pipeline with vLLM,
which provides:
  - PagedAttention for efficient KV-cache memory management
  - Continuous batching to process concurrent requests in parallel
  - Optimized CUDA kernels (FlashAttention, Marlin for quantized models)
  - Prefix caching to speed up repeated prompt prefixes (e.g. system prompts)

Performance Notes:
  - Expected 5-15x speedup over HuggingFace pipeline for text generation
  - L4 GPU (Ada Lovelace) is the sweet spot for cost vs performance on 2B models
  - scaledown_window=300 keeps GPU warm for 5 minutes between requests

Model Configuration:
  - Primary model: google/gemma-4-E2B-it (Effective 2B params, multimodal)
  - Fallback model: google/gemma-3-4b-it (4B params, text-only)
  - The fallback is used automatically if the primary model fails to load.
    To force a specific model, set the MODEL_ID environment variable in the
    'acaicia-llm-secrets' Modal secret.

Environment Variables (via Modal Secret 'acaicia-llm-secrets'):
  - HF_TOKEN: HuggingFace token for gated model access (required)
  - MODEL_ID: Override the default model (optional)
"""

import os
import modal

# ---------------------------------------------------------------------------
# Modal App & Infrastructure
# ---------------------------------------------------------------------------
app = modal.App("acaicia-gemma-inference")

# Container image: vLLM pulls in torch, CUDA kernels, and transformers
# automatically. We add hf_transfer for fast weight downloads.
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "vllm",
        "huggingface_hub",
        "hf_transfer",
        "transformers",
    )
    .env({
        "HF_HUB_ENABLE_HF_TRANSFER": "1",
        "VLLM_USE_FLASHINFER_SAMPLER": "0",
        "VLLM_DISABLE_FLASHINFER": "1",
        "VLLM_USE_V1": "0",
    })
)

# Secrets & volumes
secrets = [modal.Secret.from_name("acaicia-llm-secrets")]
hf_cache_vol = modal.Volume.from_name("acaicia-hf-cache", create_if_missing=True)

# Model defaults
PRIMARY_MODEL = "google/gemma-4-E2B-it"
FALLBACK_MODEL = "google/gemma-3-4b-it"


@app.cls(
    image=image,
    gpu="L4",
    secrets=secrets,
    volumes={"/root/.cache/huggingface": hf_cache_vol},
    timeout=900,
    scaledown_window=300,           # Keep GPU warm for 5 minutes
)
@modal.concurrent(max_inputs=50)    # Enable vLLM continuous batching
class GemmaModel:
    """High-performance Gemma inference using vLLM on Modal.

    The model is loaded once when the container starts (via @modal.enter)
    and kept in GPU memory for the lifetime of the container. Concurrent
    requests are handled by vLLM's internal continuous batching engine.
    """

    @modal.enter()
    def load_model(self):
        """Initialize the vLLM engine. Runs once per container cold start.

        Attempts to load the primary model first, falling back to the
        secondary model if the primary fails (e.g., gating issues, OOM).
        """
        from vllm import AsyncEngineArgs, AsyncLLMEngine

        hf_token = os.environ.get("HF_TOKEN")
        if not hf_token:
            print("WARNING: HF_TOKEN not set. Gated model downloads will fail.")

        model_id = os.environ.get("MODEL_ID", PRIMARY_MODEL)
        self.model_id = model_id
        self._engine = None

        # Try primary model, then fallback
        models_to_try = [model_id]
        if model_id == PRIMARY_MODEL:
            models_to_try.append(FALLBACK_MODEL)

        for attempt_model in models_to_try:
            try:
                print(f"Loading vLLM engine with model '{attempt_model}' on L4 GPU...")
                engine_args = AsyncEngineArgs(
                    model=attempt_model,
                    dtype="bfloat16",
                    max_model_len=4096,             # Reasonable context for RAG
                    gpu_memory_utilization=0.90,     # Use 90% of L4's 24GB VRAM
                    enable_prefix_caching=True,      # Cache system prompt prefixes
                    enforce_eager=False,             # Allow CUDA graph optimization
                    trust_remote_code=True,
                )
                self._engine = AsyncLLMEngine.from_engine_args(engine_args)
                self.model_id = attempt_model
                from transformers import AutoTokenizer
                self._tokenizer = AutoTokenizer.from_pretrained(attempt_model, token=hf_token)
                print(f"vLLM engine and tokenizer loaded successfully with '{attempt_model}'!")
                break
            except Exception as e:
                print(f"Failed to load '{attempt_model}': {e}")
                if attempt_model == models_to_try[-1]:
                    raise RuntimeError(
                        f"All model loading attempts failed. Last error: {e}"
                    )
                print(f"Falling back to '{FALLBACK_MODEL}'...")

        # Persist downloaded weights so next cold start is faster
        try:
            print("Committing HuggingFace cache volume...")
            hf_cache_vol.commit()
            print("Volume committed successfully.")
        except Exception as e:
            print(f"Failed to commit volume (non-fatal): {e}")

    @modal.method()
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        top_p: float = 0.95,
        top_k: int = 64,
        max_tokens: int = 1024,
        conversation_history: list[dict] | None = None,
    ) -> str:
        """Generate text using the vLLM engine.

        Args:
            prompt: The user's message text.
            temperature: Sampling temperature. Use 0.0 for deterministic output.
            top_p: Nucleus sampling probability.
            top_k: Top-k sampling. Ignored when temperature=0.
            max_tokens: Maximum tokens to generate.
            conversation_history: Optional list of previous messages in the
                format [{"role": "user"|"assistant", "content": "..."}].
                When provided, these are prepended to create a multi-turn
                conversation. This enables follow-up questions and context
                retention between queries within the same session.

        Returns:
            The generated text response.
        """
        import uuid
        from vllm import SamplingParams

        # Build sampling parameters
        sampling = SamplingParams(
            temperature=temperature,
            top_p=top_p,
            top_k=top_k if temperature > 0 else -1,
            max_tokens=max_tokens,
        )

        # Build the message list for chat template
        messages = []

        # Include conversation history for multi-turn context
        if conversation_history:
            # Limit to last 5 exchanges (10 messages) to stay within context
            recent_history = conversation_history[-10:]
            messages.extend(recent_history)

        # Add the current user message
        messages.append({"role": "user", "content": prompt})

        # Apply the model's chat template via the tokenizer loaded at startup
        formatted_prompt = self._tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

        # Generate with vLLM's async engine
        request_id = str(uuid.uuid4())
        final_output = None
        async for output in self._engine.generate(
            formatted_prompt, sampling, request_id
        ):
            final_output = output

        if final_output is None or not final_output.outputs:
            return ""

        return final_output.outputs[0].text

    @modal.method()
    async def health(self) -> dict:
        """Health check endpoint. Returns model info and status."""
        return {
            "status": "healthy",
            "model_id": self.model_id,
            "engine": "vllm",
            "primary_model": PRIMARY_MODEL,
            "fallback_model": FALLBACK_MODEL,
        }
