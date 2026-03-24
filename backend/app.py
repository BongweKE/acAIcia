import os
import time
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
    "sentence-transformers"
)

# Request & Response Models for FastAPI
class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    response: str
    sources: list[dict]

# Load secrets from Modal remote secrets manager
secrets = [
    modal.Secret.from_name("acaicia-db-secrets"),
    modal.Secret.from_name("acaicia-llm-secrets")
]

@app.function(image=image, secrets=secrets)
@modal.asgi_app()
def fastapi_app_entrypoint():
    from google import genai
    from supabase import create_client, Client
    import logging
    from sentence_transformers import SentenceTransformer

    # Configure Python Standard Logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    logger = logging.getLogger("acaicia-backend")

    # Load Open-Source Embedding Model
    logger.info("Initializing HuggingFace BAAI/bge-base-en-v1.5 Model (768 Dims)...")
    embed_model = SentenceTransformer('BAAI/bge-base-en-v1.5')

    # Initialize API Clients
    GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

    if not all([GOOGLE_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
        raise RuntimeError("Missing necessary environment variables for Google AI or Supabase in Modal Secret.")

    ai_client = genai.Client(api_key=GOOGLE_API_KEY)
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    fastapi_app = FastAPI(title="acAIcia Core API")

    def log_interaction_to_supabase(log_data: dict):
        """Background task to insert telemetry into Supabase without blocking the user response."""
        try:
            supabase.table("query_interaction_logs").insert(log_data).execute()
            logger.info("Successfully pushed telemetry to query_interaction_logs.")
        except Exception as e:
            logger.error(f"Failed to insert telemetry into query_interaction_logs: {e}")

    @fastapi_app.post("/query", response_model=QueryResponse)
    def handle_query(request: QueryRequest, background_tasks: BackgroundTasks):
        start_time = time.time()
        user_query = request.query
        total_tokens = 0
        
        # Log metadata container
        telemetry = {
            "session_id": "anonymous", # Placeholder for future history implementation
            "original_query": user_query,
            "guardian_passed": False,
            "architect_query": None,
            "retrieved_doc_ids": [],
            "synthesis_source": None,
            "total_tokens_used": 0,
            "latency_ms": 0
        }
        
        # 1. The Guardian Agent (Safety & Relevance)
        logger.info(f"Received query: {user_query}")
        guardian_prompt = f"""
        Task: You are the Guardian Agent for acAIcia (CIFOR-ICRAF).
        Determine if the following user query is safe and relevant to forestry, agroforestry, climate change, or CIFOR-ICRAF's mandate.
        Reply with exactly 'PASS' if it is relevant, or 'FAIL' if it is malicious, harmful, or entirely off-topic.
        Query: {user_query}
        """
        guard_res = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=guardian_prompt
        )
        if hasattr(guard_res, 'usage_metadata') and guard_res.usage_metadata:
            total_tokens += guard_res.usage_metadata.total_token_count
            
        if 'FAIL' in guard_res.text.strip().upper():
            logger.warning("Query failed Guardian check.")
            telemetry["latency_ms"] = int((time.time() - start_time) * 1000)
            telemetry["total_tokens_used"] = total_tokens
            background_tasks.add_task(log_interaction_to_supabase, telemetry)
            
            return QueryResponse(
                response="I'm sorry, I can only assist with queries related to forestry, agroforestry, climate change, and CIFOR-ICRAF's research areas.",
                sources=[]
            )
        
        telemetry["guardian_passed"] = True
            
        # 2. The Architect Agent (Query Enhancement)
        architect_prompt = f"""
        Task: You are the Architect Agent. Rewrite the user's query into an optimized search string for vector database retrieval. 
        Focus on scientific and domain-specific keywords. Do not answer the question, only output the optimized query string.
        Original Query: {user_query}
        """
        arch_res = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=architect_prompt
        )
        if hasattr(arch_res, 'usage_metadata') and arch_res.usage_metadata:
            total_tokens += arch_res.usage_metadata.total_token_count
            
        optimized_query = arch_res.text.strip()
        telemetry["architect_query"] = optimized_query
        logger.info(f"Architect optimized query: {optimized_query}")
        
        # 3. The Retrieval Step (Vector Search with Supabase)
        query_embedding = embed_model.encode([optimized_query], convert_to_numpy=True)[0].tolist()
        
        # Execute Supabase RPC
        results = []
        try:
            matches = supabase.rpc("match_documents", {
                "query_embedding": query_embedding,
                "match_threshold": 0.5, # Configurable threshold
                "match_count": 5
            }).execute()
            results = matches.data if matches.data else []
            
            doc_ids = list(set([r.get('document_id') for r in results if r.get('document_id')]))
            telemetry["retrieved_doc_ids"] = doc_ids
        except Exception as e:
            logger.error(f"Supabase RPC Exception: {e}")
        
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
                
                context_text += f"\n[Document {i+1}] Title: {title}\nAuthors: {authors}\nYear: {year}\nExcerpt: {chunk}\n"
                
                # De-duplicate sources
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
            You are acAIcia, an expert research assistant for CIFOR-ICRAF. 
            Answer the user's query using *only* the provided excerpts below. 
            Maintain a professional, academic tone. 
            Cite the authors and year at the relevant points in your answer (e.g., [Authors, Year]).
            
            User's Original Query: {user_query}
            
            Excerpts from internal knowledge base:
            {context_text}
            """
        else:
            telemetry["synthesis_source"] = "general_knowledge_fallback"
            synthesis_prompt = f"""
            You are acAIcia, an expert research assistant for CIFOR-ICRAF. 
            The internal database lacks this information. Provide a general scientific answer to the query based on your training data. 
            Explicitly state that this information does not come from the CIFOR-ICRAF knowledge base.
            
            User's Query: {user_query}
            """
            
        synth_res = ai_client.models.generate_content(
            model='gemini-2.5-pro',
            contents=synthesis_prompt
        )
        if hasattr(synth_res, 'usage_metadata') and synth_res.usage_metadata:
            total_tokens += synth_res.usage_metadata.total_token_count
            
        # Finalize Telemetry and schedule background task
        telemetry["latency_ms"] = int((time.time() - start_time) * 1000)
        telemetry["total_tokens_used"] = total_tokens
        background_tasks.add_task(log_interaction_to_supabase, telemetry)
        
        logger.info(f"Request fulfilled in {telemetry['latency_ms']}ms using {total_tokens} tokens.")
        
        return QueryResponse(
            response=synth_res.text.strip(),
            sources=sources
        )

    return fastapi_app
