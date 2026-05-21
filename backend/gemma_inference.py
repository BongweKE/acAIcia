import os
import modal

# Define the Modal application
app = modal.App("acaicia-gemma-inference")

# Define the container image with required ML/LLM libraries
image = modal.Image.debian_slim().pip_install(
    "transformers",
    "torch",
    "accelerate",
    "huggingface_hub"
)

# Use the same LLM secrets name as defined in acAIcia
secrets = [
    modal.Secret.from_name("acaicia-llm-secrets")
]

@app.cls(image=image, gpu="L4", secrets=secrets, timeout=900)
class GemmaModel:
    @modal.enter()
    def load_model(self):
        import torch
        from transformers import pipeline
        
        model_id = os.environ.get("MODEL_ID", "google/gemma-4-E2B-it")
        hf_token = os.environ.get("HF_TOKEN")
        
        if not hf_token:
            print("WARNING: HF_TOKEN environment variable not set. Hugging Face downloads for gated models may fail.")
            
        print(f"Loading Gemma 4 model '{model_id}' onto L4 GPU in BF16 format...")
        
        self.pipe = pipeline(
            task="text-generation",
            model=model_id,
            device_map="auto",
            torch_dtype=torch.bfloat16,
            token=hf_token
        )
        print("Gemma 4 model loaded successfully!")

    @modal.method()
    def generate(self, prompt: str, temperature: float = 1.0, top_p: float = 0.95, top_k: int = 64, max_tokens: int = 1024) -> str:
        """
        Runs text generation using Gemma 4 E2B.
        Disables 'thinking mode' by default (does not include <|think|>).
        """
        # Conversational message payload
        messages = [
            {"role": "user", "content": prompt}
        ]
        
        print(f"Running generation: temperature={temperature}, top_p={top_p}, top_k={top_k}, max_tokens={max_tokens}")
        
        outputs = self.pipe(
            messages,
            max_new_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            do_sample=True if temperature > 0.0 else False
        )
        
        generated = outputs[0]["generated_text"]
        if isinstance(generated, list):
            # Parse response from chat template sequence list
            return generated[-1]["content"]
        else:
            return generated
