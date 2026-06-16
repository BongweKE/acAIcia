import os
import json
import time
import threading
from typing import Optional
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import modal

# Define the Modal application and its image/dependencies
app = modal.App("acaicia-backend")

image = modal.Image.debian_slim().pip_install(
    "google-genai", 
    "supabase", 
    "fastapi[standard]", 
    "pydantic",
    "torch",
    "sentence-transformers",
    "requests",
    "modal",
    "hf_transfer"
)

# Reference stateful settings volume
vol = modal.Volume.from_name("acaicia-data-volume", create_if_missing=True)
hf_cache_vol = modal.Volume.from_name("acaicia-hf-cache", create_if_missing=True)

# Request & Response Models for FastAPI
class QueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    conversation_history: Optional[list[dict]] = None

class QueryResponse(BaseModel):
    response: str
    sources: list[dict]

class SettingsResponse(BaseModel):
    llm_provider: str
    google_api_key_configured: bool
    nvidia_api_key_configured: bool
    deepseek_api_key_configured: bool
    hf_token_configured: bool
    active_source: str

class SettingsRequest(BaseModel):
    llm_provider: str

# Load secrets from Modal remote secrets manager
secrets = [
    modal.Secret.from_name("acaicia-db-secrets"),
    modal.Secret.from_name("acaicia-llm-secrets")
]

# ---- Cached Gemma class reference (avoids per-request RPC discovery) ----
# This is resolved once at module load time rather than on every call_llm().
try:
    GEMMA_CLS = modal.Cls.from_name("acaicia-gemma-inference", "GemmaModel")
except Exception:
    GEMMA_CLS = None  # Will fail gracefully at call time if Modal provider used

# Agent-specific generation parameters.
# Guardian only needs to say PASS/FAIL (16 tokens max).
# Architect rewrites the query (~256 tokens).
# Synthesis generates the full answer (up to 2048 tokens).
AGENT_MAX_TOKENS = {"guardian": 16, "architect": 256, "synthesis": 2048}
AGENT_TEMPERATURE = {"guardian": 0.0, "architect": 0.3, "synthesis": 0.7}

# ---------------------------------------------------------------------------
# Module-level caches (persist across warm container reuses in Modal)
# ---------------------------------------------------------------------------

# Settings cache — avoids vol.reload() + file read on every call_llm() invocation
_settings_cache = {"provider": None, "timestamp": 0.0}
_settings_lock = threading.Lock()
_SETTINGS_TTL = 60  # seconds


def get_active_provider(logger=None):
    """Determines the active LLM provider with in-memory caching.

    Checks cache first (60s TTL), then /data/settings.json on the volume,
    then LLM_PROVIDER env var, then falls back to 'modal'.
    """
    now = time.time()
    with _settings_lock:
        if _settings_cache["provider"] and (now - _settings_cache["timestamp"]) < _SETTINGS_TTL:
            return _settings_cache["provider"]

    # Cache miss or expired — read from volume
    provider = None
    try:
        vol.reload()
        if os.path.exists("/data/settings.json"):
            with open("/data/settings.json", "r") as f:
                data = json.load(f)
                p = data.get("llm_provider")
                if p in ["gemini", "nvidia", "modal", "deepseek"]:
                    provider = p
    except Exception as e:
        if logger:
            logger.error(f"Error reading settings from volume: {e}")

    if not provider:
        env_provider = os.environ.get("LLM_PROVIDER")
        if env_provider in ["gemini", "nvidia", "modal", "deepseek"]:
            provider = env_provider
        elif os.environ.get("USE_NVIDIA", "false").lower() == "true":
            provider = "nvidia"
        else:
            provider = "modal"

    with _settings_lock:
        _settings_cache["provider"] = provider
        _settings_cache["timestamp"] = now

    return provider


def invalidate_settings_cache():
    """Call after updating settings to force a fresh read on next query."""
    with _settings_lock:
        _settings_cache["provider"] = None
        _settings_cache["timestamp"] = 0.0


# Embedding model cache — loaded once per container, reused across function calls
_cached_embed_model = None
_embed_model_lock = threading.Lock()


def _get_cached_embed_model(logger=None):
    """Load and cache the SentenceTransformer embedding model."""
    global _cached_embed_model
    with _embed_model_lock:
        if _cached_embed_model is not None:
            if logger:
                logger.info("Using cached embedding model (BAAI/bge-base-en-v1.5).")
            return _cached_embed_model

        from sentence_transformers import SentenceTransformer
        try:
            if logger:
                logger.info("Initializing BAAI/bge-base-en-v1.5 Model (768 Dims) from local cache...")
            model = SentenceTransformer('BAAI/bge-base-en-v1.5', local_files_only=True)
        except Exception as e:
            if logger:
                logger.info(f"Local cache lookup failed ({e}). Fetching model online...")
            model = SentenceTransformer('BAAI/bge-base-en-v1.5')
            try:
                hf_cache_vol.commit()
            except Exception as commit_err:
                if logger:
                    logger.error(f"Failed to commit HF cache: {commit_err}")

        _cached_embed_model = model
        return _cached_embed_model

@app.function(
    image=image,
    secrets=secrets,
    volumes={
        "/data": vol,
        "/root/.cache/huggingface": hf_cache_vol
    },
    timeout=600
)
def process_query_async(query_id: str, user_query: str, session_id: str = None, conversation_history: list = None):
    import os
    import time
    import json
    import logging
    from sentence_transformers import SentenceTransformer
    from supabase import create_client, Client
    import requests
    from google import genai
    
    # Set up logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    logger = logging.getLogger("acaicia-async-processor")
    
    start_time = time.time()
    total_tokens = 0
    
    # Initialize API Clients
    GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
    NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    USE_NVIDIA = os.environ.get("USE_NVIDIA", "false").lower() == "true"
    
    ai_client = genai.Client(api_key=GOOGLE_API_KEY) if GOOGLE_API_KEY else None
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Silence verbose dependencies to keep logs clean
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    # Load embedding model from module-level cache (persists across warm container reuses)
    os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"
    embed_model = _get_cached_embed_model(logger)
        
    def call_llm(prompt: str, agent_type: str) -> dict:
        provider = get_active_provider(logger)
        logger.info(f"Using LLM Provider: {provider} for agent: {agent_type}")
        
        if provider == "modal":
            try:
                if GEMMA_CLS is None:
                    raise RuntimeError("Gemma inference class not available. Deploy acaicia-gemma-inference first.")
                gemma_instance = GEMMA_CLS()
                max_tokens = AGENT_MAX_TOKENS.get(agent_type, 1024)
                temperature = AGENT_TEMPERATURE.get(agent_type, 0.7)
                logger.info(f"Calling Modal Gemma (vLLM) for agent {agent_type} (max_tokens={max_tokens}, temp={temperature})...")
                # Pass conversation history only for synthesis agent
                history = conversation_history if agent_type == "synthesis" else None
                text = gemma_instance.generate.remote(
                    prompt=prompt,
                    temperature=temperature,
                    top_p=0.95,
                    top_k=64,
                    max_tokens=max_tokens,
                    conversation_history=history,
                )
                estimated_tokens = len(prompt) // 4 + len(text) // 4
                return {"text": text.strip(), "tokens": estimated_tokens}
            except Exception as e:
                logger.error(f"Failed to generate content with Modal Gemma (vLLM): {e}")
                raise e
        elif provider == "nvidia":
            if not NVIDIA_API_KEY:
                raise RuntimeError("NVIDIA provider active, but NVIDIA_API_KEY is not configured.")
            model_map = {
                "guardian": "meta/llama-3.1-8b-instruct",
                "architect": "meta/llama-3.1-8b-instruct",
                "synthesis": "meta/llama-3.3-70b-instruct"
            }
            model = model_map.get(agent_type, "meta/llama-3.1-8b-instruct")
            invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Accept": "application/json"
            }
            messages = []
            if conversation_history and agent_type == "synthesis":
                messages.extend(conversation_history)
            messages.append({"role": "user", "content": prompt})
            
            payload = {
                "model": model,
                "messages": messages,
                "max_tokens": AGENT_MAX_TOKENS.get(agent_type, 1024),
                "temperature": AGENT_TEMPERATURE.get(agent_type, 0.7),
                "top_p": 0.70
            }
            try:
                response = requests.post(invoke_url, headers=headers, json=payload, timeout=30)
                if response.status_code != 200:
                    logger.error(f"NVIDIA API Error [{response.status_code}]: {response.text}")
                    raise Exception(f"NVIDIA LLM Generation Failed with status {response.status_code}")
                data = response.json()
                text = data["choices"][0]["message"]["content"]
                tokens = data.get("usage", {}).get("total_tokens", 0)
                return {"text": text, "tokens": tokens}
            except Exception as e:
                logger.error(f"Failed to generate content with NVIDIA API: {e}")
                raise e
        elif provider == "deepseek":
            DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")
            if not DEEPSEEK_API_KEY:
                raise RuntimeError("DeepSeek provider active, but DEEPSEEK_API_KEY is not configured.")
            model_map = {
                "guardian": "deepseek-chat",
                "architect": "deepseek-chat",
                "synthesis": "deepseek-reasoner"
            }
            model = model_map.get(agent_type, "deepseek-chat")
            invoke_url = "https://api.deepseek.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json"
            }
            messages = []
            if conversation_history and agent_type == "synthesis":
                messages.extend(conversation_history)
            messages.append({"role": "user", "content": prompt})
            
            payload = {
                "model": model,
                "messages": messages,
                "max_tokens": AGENT_MAX_TOKENS.get(agent_type, 1024),
                "temperature": AGENT_TEMPERATURE.get(agent_type, 0.7),
                "top_p": 0.70
            }
            try:
                response = requests.post(invoke_url, headers=headers, json=payload, timeout=60)
                if response.status_code != 200:
                    logger.error(f"DeepSeek API Error [{response.status_code}]: {response.text}")
                    raise Exception(f"DeepSeek LLM Generation Failed with status {response.status_code}")
                data = response.json()
                text = data["choices"][0]["message"]["content"]
                tokens = data.get("usage", {}).get("total_tokens", 0)
                return {"text": text, "tokens": tokens}
            except Exception as e:
                logger.error(f"Failed to generate content with DeepSeek API: {e}")
                raise e
        else: # gemini
            if not ai_client:
                raise RuntimeError("Gemini provider active, but GOOGLE_API_KEY is not configured.")
            model_map = {
                "guardian": "gemini-2.5-flash",
                "architect": "gemini-2.5-flash",
                "synthesis": "gemini-2.5-flash"
            }
            model = model_map.get(agent_type, "gemini-2.5-flash")
            contents = []
            if conversation_history and agent_type == "synthesis":
                for msg in conversation_history:
                    gemini_role = "model" if msg["role"] == "assistant" else "user"
                    contents.append({"role": gemini_role, "parts": [{"text": msg["content"]}]})
            contents.append({"role": "user", "parts": [{"text": prompt}]})
            try:
                res = ai_client.models.generate_content(
                    model=model,
                    contents=contents
                )
                tokens = res.usage_metadata.total_token_count if hasattr(res, 'usage_metadata') and res.usage_metadata else 0
                return {"text": res.text.strip(), "tokens": tokens}
            except Exception as e:
                logger.error(f"Failed to generate content with Google API: {e}")
                raise e

    # Log metadata container
    telemetry = {
        "session_id": "anonymous",
        "original_query": user_query,
        "guardian_passed": False,
        "architect_query": None,
        "retrieved_doc_ids": [],
        "synthesis_source": None,
        "total_tokens_used": 0,
        "latency_ms": 0
    }
    
    def update_status(status_dict: dict):
        try:
            os.makedirs("/data/queries", exist_ok=True)
            with open(f"/data/queries/{query_id}.json", "w") as f:
                json.dump(status_dict, f)
            vol.commit()
            logger.info(f"Updated status for query {query_id} to {status_dict.get('status')}")
        except Exception as e:
            logger.error(f"Failed to write query status: {e}")

    try:
        # 1 & 2. Guardian + Architect Agents (run concurrently for ~2x speedup)
        # Guardian checks safety/relevance while Architect optimizes the query.
        # These are independent — if Guardian fails, we discard the Architect result.
        logger.info(f"Processing query {query_id}: {user_query}")
        guardian_prompt = f"""
        Task: You are the Guardian Agent for acAIcia (CIFOR-ICRAF).
        Determine if the following user query is safe and relevant to forestry, agroforestry, climate change, or CIFOR-ICRAF's mandate.
        Reply with exactly 'PASS' if it is relevant, or 'FAIL' if it is malicious, harmful, or entirely off-topic.
        Query: {user_query}
        """
        architect_prompt = f"""
        Task: You are the Architect Agent. Rewrite the user's query into an optimized search string for vector database retrieval. 
        Focus on scientific and domain-specific keywords. Do not answer the question, only output the optimized query string.
        Original Query: {user_query}
        """
        
        from concurrent.futures import ThreadPoolExecutor
        
        with ThreadPoolExecutor(max_workers=2) as executor:
            guardian_future = executor.submit(call_llm, guardian_prompt, "guardian")
            architect_future = executor.submit(call_llm, architect_prompt, "architect")
            
            # Wait for Guardian result first (cheap — max 16 tokens)
            try:
                guard_res = guardian_future.result()
                total_tokens += guard_res["tokens"]
                guard_text = guard_res["text"]
            except Exception as e:
                error_msg = f"System Error: The underlying AI model failed to process the request. Please check the logs. Details: {e}"
                update_status({"status": "failed", "error": error_msg})
                return
                
            if 'FAIL' in guard_text.upper():
                logger.warning("Query failed Guardian check.")
                telemetry["latency_ms"] = int((time.time() - start_time) * 1000)
                telemetry["total_tokens_used"] = total_tokens
                
                try:
                    supabase.table("query_interaction_logs").insert(telemetry).execute()
                except Exception as ex:
                    logger.error(f"Failed to insert telemetry: {ex}")
                    
                update_status({
                    "status": "completed",
                    "response": "I'm sorry, I can only assist with queries related to forestry, agroforestry, climate change, and Landscape Alliance's research areas.",
                    "sources": []
                })
                return
            
            telemetry["guardian_passed"] = True
            
            # Guardian passed — collect Architect result
            try:
                arch_res = architect_future.result()
                total_tokens += arch_res["tokens"]
                optimized_query = arch_res["text"]
            except Exception as e:
                update_status({"status": "failed", "error": f"System Error: The Architect Agent failed to process the query. Details: {e}"})
                return
        
        telemetry["architect_query"] = optimized_query
        logger.info(f"Architect optimized query: {optimized_query}")
        
        # 3. The Retrieval Step (Vector Search with Supabase)
        query_embedding = embed_model.encode([optimized_query], convert_to_numpy=True)[0].tolist()
        
        # Execute Supabase RPC
        results = []
        try:
            matches = supabase.rpc("match_documents", {
                "query_embedding": query_embedding,
                "match_threshold": 0.5,
                "match_count": 5
            }).execute()
            results = matches.data if matches.data else []
            
            doc_ids = list(set([r.get('document_id') for r in results if r.get('document_id')]))
            telemetry["retrieved_doc_ids"] = doc_ids
        except Exception as e:
            logger.error(f"Supabase RPC Exception: {e}")
            raise RuntimeError(f"Database query failure: {e}")
        
        # 4. The Synthesis Agent (acAIcia Persona)
        sources = []
        if results:
            telemetry["synthesis_source"] = "database_match"
            context_text = ""
            for i, r in enumerate(results):
                title = r.get('title') or 'Unknown Title'
                authors = ', '.join(r.get('authors', [])) if r.get('authors') else 'Unknown Authors'
                year = r.get('publication_year') or 'n.d.'
                chunk = r.get('chunk_text', '')
                
                context_text += f"\nDocument {i+1}:\nTitle: {title}\nAuthors: {authors}\nYear: {year}\nExcerpt: {chunk}\n"
                
                source_meta = {
                    "title": title,
                    "authors": authors,
                    "year": year,
                    "url": r.get('url_link', ''),
                    "doi": r.get('doi', '')
                }
                if source_meta not in sources:
                    sources.append(source_meta)
            
            synthesis_prompt = f"""
            You are acAIcia, an expert research assistant for Landscape Alliance (formerly CIFOR-ICRAF). 
            Your goal is to answer the user's query professionally and academically using ONLY the provided excerpts below. 

            CRITICAL CITATION RULES:
            1. You MUST cite the source of information at the relevant points in your answer using the exact format: [Author(s), Year] (e.g., [Hoang et al., 2010]).
            2. DO NOT use document index citations like "[Document 1]", "[Document 2]", or "[1]", "[2]" in your response text.
            3. If an excerpt has no authors, use the Title or 'Landscape Alliance' and the Year (e.g., [Landscape Alliance, 2020]).
            4. Ensure every claim you make is backed by a specific inline citation in the [Author(s), Year] format.

            User's Original Query: {user_query}

            Excerpts from internal knowledge base:
            {context_text}
            """
        else:
            telemetry["synthesis_source"] = "general_knowledge_fallback"
            synthesis_prompt = f"""
            You are acAIcia, an expert research assistant for Landscape Alliance (formerly CIFOR-ICRAF). 
            The internal database lacks this information. Provide a general scientific answer to the query based on your training data. 
            Explicitly state that this information does not come from the Landscape Alliance knowledge base.
            
            User's Query: {user_query}
            """
            
        try:
            synth_res = call_llm(synthesis_prompt, "synthesis")
            total_tokens += synth_res["tokens"]
            synth_text = synth_res["text"]
        except Exception as e:
            update_status({"status": "failed", "error": f"System Error: The Synthesis Agent failed to formulate an answer. Details: {e}"})
            return
            
        # Finalize Telemetry
        telemetry["latency_ms"] = int((time.time() - start_time) * 1000)
        telemetry["total_tokens_used"] = total_tokens
        
        try:
            supabase.table("query_interaction_logs").insert(telemetry).execute()
            logger.info("Successfully pushed telemetry to query_interaction_logs.")
        except Exception as e:
            logger.error(f"Failed to insert telemetry: {e}")
            
        logger.info(f"Request fulfilled in {telemetry['latency_ms']}ms using {total_tokens} tokens.")
        
        # Save conversation history for this session so follow-up questions
        # can reference prior context within the idle timeout window.
        if session_id:
            try:
                vol.reload()
                history_dir = "/data/sessions"
                os.makedirs(history_dir, exist_ok=True)
                history_path = f"{history_dir}/{session_id}.json"
                
                # Load existing history
                existing = []
                if os.path.exists(history_path):
                    with open(history_path, "r") as f:
                        existing = json.load(f)
                
                # Append this exchange
                existing.append({"role": "user", "content": user_query})
                existing.append({"role": "assistant", "content": synth_text.strip()})
                
                # Keep only last 10 messages (5 exchanges) to bound storage
                existing = existing[-10:]
                
                with open(history_path, "w") as f:
                    json.dump(existing, f)
                vol.commit()
                logger.info(f"Saved conversation history for session {session_id} ({len(existing)} messages).")
            except Exception as hist_err:
                logger.error(f"Failed to save conversation history: {hist_err}")
        
        update_status({
            "status": "completed",
            "response": synth_text.strip(),
            "sources": sources
        })
        
    except Exception as e:
        logger.error(f"Unhandled error in process_query_async: {e}")
        update_status({"status": "failed", "error": f"Internal Server Error: {str(e)}"})

@app.function(
    image=image, 
    secrets=secrets, 
    volumes={
        "/data": vol,
        "/root/.cache/huggingface": hf_cache_vol
    }
)
@modal.asgi_app()
def fastapi_app_entrypoint():
    from google import genai
    from supabase import create_client, Client
    import logging
    import requests

    # Configure Python Standard Logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    logger = logging.getLogger("acaicia-backend")
    
    # Silence verbose dependencies
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    # Initialize API Clients
    GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
    NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")
    DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    USE_NVIDIA = os.environ.get("USE_NVIDIA", "false").lower() == "true"

    if not all([SUPABASE_URL, SUPABASE_KEY]):
        raise RuntimeError("Missing necessary environment variables for Supabase in Modal Secret.")

    ai_client = genai.Client(api_key=GOOGLE_API_KEY) if GOOGLE_API_KEY else None
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    import json
    
    fastapi_app = FastAPI(title="acAIcia Core API")

    @fastapi_app.get("/settings", response_model=SettingsResponse)
    def get_settings():
        vol.reload()
        active_source = "default"
        provider = "modal"
        
        if os.path.exists("/data/settings.json"):
            try:
                with open("/data/settings.json", "r") as f:
                    data = json.load(f)
                    val = data.get("llm_provider")
                    if val in ["gemini", "nvidia", "modal", "deepseek"]:
                        provider = val
                        active_source = "volume"
            except Exception as e:
                logger.error(f"Error reading settings.json: {e}")
                
        if active_source == "default":
            env_provider = os.environ.get("LLM_PROVIDER")
            if env_provider in ["gemini", "nvidia", "modal", "deepseek"]:
                provider = env_provider
                active_source = "env"
            elif USE_NVIDIA:
                provider = "nvidia"
                active_source = "env"
                
        return SettingsResponse(
            llm_provider=provider,
            google_api_key_configured=bool(GOOGLE_API_KEY),
            nvidia_api_key_configured=bool(NVIDIA_API_KEY),
            deepseek_api_key_configured=bool(os.environ.get("DEEPSEEK_API_KEY")),
            hf_token_configured=bool(os.environ.get("HF_TOKEN")),
            active_source=active_source
        )

    @fastapi_app.post("/settings", response_model=SettingsResponse)
    def update_settings(request: SettingsRequest):
        if request.llm_provider not in ["gemini", "nvidia", "modal", "deepseek"]:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Invalid LLM provider. Must be 'gemini', 'nvidia', 'modal', or 'deepseek'.")
            
        try:
            vol.reload()
            with open("/data/settings.json", "w") as f:
                json.dump({"llm_provider": request.llm_provider}, f)
            vol.commit()
            invalidate_settings_cache()
            logger.info(f"LLM provider updated to {request.llm_provider} on persistent volume.")
        except Exception as e:
            logger.error(f"Failed to write settings to volume: {e}")
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"Failed to write settings: {e}")
            
        return SettingsResponse(
            llm_provider=request.llm_provider,
            google_api_key_configured=bool(GOOGLE_API_KEY),
            nvidia_api_key_configured=bool(NVIDIA_API_KEY),
            deepseek_api_key_configured=bool(os.environ.get("DEEPSEEK_API_KEY")),
            hf_token_configured=bool(os.environ.get("HF_TOKEN")),
            active_source="volume"
        )

    def log_interaction_to_supabase(log_data: dict):
        """Background task to insert telemetry into Supabase without blocking the user response."""
        try:
            supabase.table("query_interaction_logs").insert(log_data).execute()
            logger.info("Successfully pushed telemetry to query_interaction_logs.")
        except Exception as e:
            logger.error(f"Failed to insert telemetry into query_interaction_logs: {e}")

    @fastapi_app.post("/query")
    def handle_query(request: QueryRequest):
        import uuid
        query_id = str(uuid.uuid4())
        
        try:
            vol.reload()
            os.makedirs("/data/queries", exist_ok=True)
            status_path = f"/data/queries/{query_id}.json"
            with open(status_path, "w") as f:
                json.dump({
                    "status": "processing",
                    "query_id": query_id,
                    "original_query": request.query
                }, f)
            vol.commit()
            
            # Resolve conversation history: use what the frontend sent,
            # or load from the session volume if a session_id was provided.
            conversation_history = request.conversation_history
            session_id = request.session_id
            
            if conversation_history is None and session_id:
                try:
                    history_path = f"/data/sessions/{session_id}.json"
                    if os.path.exists(history_path):
                        with open(history_path, "r") as f:
                            conversation_history = json.load(f)
                        logger.info(f"Loaded {len(conversation_history)} messages from session {session_id}.")
                except Exception as hist_err:
                    logger.error(f"Failed to load session history: {hist_err}")
            
            # Spawn the background task on Modal with session context
            process_query_async.spawn(
                query_id, request.query,
                session_id=session_id,
                conversation_history=conversation_history,
            )
            
            logger.info(f"Spawned background query job {query_id} for user query.")
            return {"query_id": query_id, "status": "processing"}
        except Exception as e:
            logger.error(f"Failed to start async query: {e}")
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"Failed to initialize query processing: {e}")

    @fastapi_app.get("/query/status/{query_id}")
    def get_query_status(query_id: str):
        try:
            vol.reload()
            status_path = f"/data/queries/{query_id}.json"
            if not os.path.exists(status_path):
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail="Query status not found.")
                
            with open(status_path, "r") as f:
                data = json.load(f)
            return data
        except Exception as e:
            logger.error(f"Failed to fetch status for query {query_id}: {e}")
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=str(e))

    return fastapi_app
