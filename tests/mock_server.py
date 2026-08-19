import os
import uuid
import time
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field

def create_mock_app() -> FastAPI:
    app = FastAPI(title="acAIcia Test Mock API")

    # Stateful In-Memory Storage
    state = {
        "global_settings": {
            "llm_provider": "modal",
            "google_api_key_configured": True,
            "nvidia_api_key_configured": True,
            "deepseek_api_key_configured": True,
            "hf_token_configured": True,
            "active_source": "default"
        },
        "user_profiles": {},
        "feedback_entries": [],
        "queries": {},
        "query_interaction_logs": [],
        "prompt_pills": [
            "What percentage of Ghana anthropogenic GHG emissions come from food systems?",
            "Outline indigenous agroforestry plants in Kenya and suitable soil profiles.",
            "What are key policy recommendations for peatland restoration in Southeast Asia?",
            "How do shade-grown coffee systems impact soil organic carbon sequestration?"
        ],
        "evaluations": [
            {
                "timestamp": "2026-08-19T02:00:00Z",
                "faithfulness_score": 0.98,
                "answer_relevance_score": 0.95,
                "context_recall_score": 0.92,
                "passed": True
            }
        ],
        "guest_query_counts": {}  # session_id -> count
    }

    # Request Models
    class SettingsRequest(BaseModel):
        llm_provider: str

    class UserProfileRequest(BaseModel):
        user_id: Optional[str] = None
        email: Optional[str] = None
        full_name: Optional[str] = None
        preferred_name: Optional[str] = None
        work_description: Optional[str] = None
        custom_instructions: Optional[str] = None

    class FeedbackRequest(BaseModel):
        log_id: str
        user_id: Optional[str] = None
        rating: int
        correction_text: Optional[str] = None

    class QueryRequest(BaseModel):
        query: str
        session_id: Optional[str] = None
        user_id: Optional[str] = None
        conversation_history: Optional[List[Dict[str, str]]] = None

    class AuthLoginRequest(BaseModel):
        email: str
        password: str

    # Helper Reset Function for Tests
    @app.post("/test/reset")
    def reset_state():
        state["global_settings"]["llm_provider"] = "modal"
        state["user_profiles"].clear()
        state["feedback_entries"].clear()
        state["queries"].clear()
        state["query_interaction_logs"].clear()
        state["guest_query_counts"].clear()
        return {"status": "reset"}

    # 1. Prompt Pills Endpoint
    @app.get("/prompt_pills")
    def get_prompt_pills():
        return {"pills": state["prompt_pills"]}

    # 2. Global Settings Endpoints
    @app.get("/settings")
    def get_settings():
        return state["global_settings"]

    @app.post("/settings")
    def update_settings(req: SettingsRequest, is_guest: bool = False):
        valid_providers = ["gemini", "nvidia", "modal", "deepseek"]
        if req.llm_provider not in valid_providers:
            raise HTTPException(status_code=400, detail="Invalid LLM provider.")
        if is_guest and req.llm_provider != "modal":
            raise HTTPException(status_code=403, detail="Guest users are locked to Modal Gemma 4.")
        state["global_settings"]["llm_provider"] = req.llm_provider
        state["global_settings"]["active_source"] = "volume"
        return state["global_settings"]

    # 3. User Profile / Custom Instructions Endpoints
    @app.get("/user/settings")
    def get_user_profile(user_id: Optional[str] = None):
        if not user_id:
            raise HTTPException(status_code=400, detail="Missing required user_id parameter.")
        if user_id in state["user_profiles"]:
            return state["user_profiles"][user_id]
        return {
            "user_id": user_id,
            "full_name": "Guest Researcher",
            "preferred_name": "",
            "work_description": "",
            "custom_instructions": ""
        }

    @app.post("/user/settings")
    def update_user_profile(req: UserProfileRequest):
        u_id = req.user_id or "00000000-0000-0000-0000-000000000000"
        
        # Boundary validation: long instructions
        if req.custom_instructions and len(req.custom_instructions) > 5000:
            custom_inst = req.custom_instructions[:5000]
        else:
            custom_inst = req.custom_instructions or ""

        profile = {
            "user_id": u_id,
            "email": req.email or "",
            "full_name": req.full_name or "Researcher",
            "preferred_name": req.preferred_name or "",
            "work_description": req.work_description or "",
            "custom_instructions": custom_inst,
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }
        state["user_profiles"][u_id] = profile
        return {"status": "success", "profile": profile}

    # 4. Feedback Endpoint
    @app.post("/feedback")
    def submit_feedback(req: FeedbackRequest):
        if not req.log_id:
            raise HTTPException(status_code=422, detail="log_id is required.")
        if req.rating not in [1, -1]:
            raise HTTPException(status_code=400, detail="Rating must be 1 (upvote) or -1 (downvote).")
        
        corr_text = req.correction_text
        if corr_text and len(corr_text) > 2000:
            corr_text = corr_text[:2000]

        entry = {
            "log_id": req.log_id,
            "user_id": req.user_id,
            "rating": req.rating,
            "correction_text": corr_text,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }
        # Handle duplicate submission or appends safely
        existing = [e for e in state["feedback_entries"] if e["log_id"] == req.log_id and e.get("user_id") == req.user_id]
        if existing:
            existing[0]["rating"] = req.rating
            existing[0]["correction_text"] = corr_text
        else:
            state["feedback_entries"].append(entry)
        
        return {"status": "success"}

    # 5. Auth Simulation Endpoint
    @app.post("/auth/login")
    def login(req: AuthLoginRequest):
        if not req.email or not req.password:
            raise HTTPException(status_code=400, detail="Email and password are required.")
        if "@" not in req.email:
            raise HTTPException(status_code=400, detail="Invalid email format.")
        if req.password == "invalid" or req.password == "wrong":
            raise HTTPException(status_code=401, detail="Invalid credentials.")

        role = "admin" if req.email.lower() in ["b.obaga@landscapealliance.org", "admin@acaicia.org"] else "researcher"
        return {
            "status": "success",
            "token": f"mock-token-{uuid.uuid4()}",
            "user": {
                "user_id": req.email,
                "email": req.email,
                "role": role,
                "full_name": req.email.split("@")[0].title()
            }
        }

    # 6. Admin Metrics Endpoint
    @app.get("/admin/metrics")
    def get_admin_metrics(user_role: Optional[str] = None):
        if user_role and user_role != "admin":
            raise HTTPException(status_code=403, detail="Forbidden: Admin access required")

        logs = state["query_interaction_logs"]
        total_queries = len(logs)
        cache_hits = sum(1 for l in logs if l.get("cache_hit"))
        guardian_fails = sum(1 for l in logs if not l.get("guardian_passed"))

        latencies = [l.get("latency_ms", 0) for l in logs if l.get("latency_ms")]
        latencies.sort()

        p50 = latencies[int(len(latencies)*0.5)] if latencies else 0
        p95 = latencies[int(len(latencies)*0.95)] if latencies else 0

        guardian_avg = sum(l.get("guardian_ms", 0) for l in logs if l.get("guardian_ms")) / max(total_queries, 1)
        architect_avg = sum(l.get("architect_ms", 0) for l in logs if l.get("architect_ms")) / max(total_queries, 1)
        retrieval_avg = sum(l.get("retrieval_ms", 0) for l in logs if l.get("retrieval_ms")) / max(total_queries, 1)
        synthesis_avg = sum(l.get("synthesis_ms", 0) for l in logs if l.get("synthesis_ms")) / max(total_queries, 1)

        ratings = [f.get("rating") for f in state["feedback_entries"] if f.get("rating")]
        upvotes = sum(1 for r in ratings if r == 1)
        downvotes = sum(1 for r in ratings if r == -1)

        satisfaction_pct = round((upvotes / max(upvotes + downvotes, 1)) * 100, 1) if (upvotes + downvotes) > 0 else 100.0

        return {
            "total_queries": total_queries,
            "cache_hit_rate_pct": round((cache_hits / max(total_queries, 1)) * 100, 1),
            "guardian_pass_rate_pct": round(((total_queries - guardian_fails) / max(total_queries, 1)) * 100, 1),
            "p50_latency_ms": p50,
            "p95_latency_ms": p95,
            "stage_latency_averages": {
                "guardian_ms": round(guardian_avg, 1),
                "architect_ms": round(architect_avg, 1),
                "retrieval_ms": round(retrieval_avg, 1),
                "synthesis_ms": round(synthesis_avg, 1)
            },
            "user_feedback": {
                "upvotes": upvotes,
                "downvotes": downvotes,
                "satisfaction_pct": satisfaction_pct
            },
            "recent_evaluations": state["evaluations"]
        }

    # 7. Query Endpoints
    @app.post("/query")
    def handle_query(req: QueryRequest, is_authenticated: bool = True):
        query_text = req.query.strip() if req.query else ""
        if not query_text:
            raise HTTPException(status_code=400, detail="Query text cannot be empty.")

        # Guest Limit Enforcement (20 max queries)
        session_id = req.session_id or "default-session"
        if not is_authenticated:
            current_count = state["guest_query_counts"].get(session_id, 0)
            if current_count >= 20:
                raise HTTPException(status_code=429, detail="Guest query limit reached (20/20). Please sign in.")
            state["guest_query_counts"][session_id] = current_count + 1

        query_id = str(uuid.uuid4())

        # Guardian Guardrail Check (Simulated)
        off_topic_words = ["malicious", "hack", "entertainment", "recipe", "commercial code"]
        is_off_topic = any(word in query_text.lower() for word in off_topic_words)

        # Check Semantic Cache Simulation
        is_cache_hit = False
        cached_query = next((l for l in state["query_interaction_logs"] if l.get("original_query") == query_text and l.get("guardian_passed")), None)
        if cached_query and not is_off_topic:
            is_cache_hit = True

        if is_off_topic:
            status_data = {
                "status": "completed",
                "query_id": query_id,
                "response": "I'm sorry, I can only assist with queries related to forestry, agroforestry, climate change, peatlands, food systems, and Landscape Alliance's research areas.",
                "sources": [],
                "cache_hit": False,
                "guardian_passed": False
            }
            log_entry = {
                "log_id": query_id,
                "original_query": query_text,
                "guardian_passed": False,
                "latency_ms": 120,
                "guardian_ms": 120,
                "architect_ms": 0,
                "retrieval_ms": 0,
                "synthesis_ms": 0,
                "cache_hit": False
            }
        elif is_cache_hit:
            status_data = {
                "status": "completed",
                "query_id": query_id,
                "response": f"⚡ (Fast Cache Hit)\n\nKey research findings indicate significant ecosystem impact in shade-grown coffee and agroforestry systems [Bohne et al., 2026].",
                "sources": [
                    {
                        "title": "Opportunities for a low-emission transformation of Ghana's food systems",
                        "authors": "Bohne, S., Martius, C., Pingault, N.",
                        "year": 2026,
                        "url": "https://www.cifor-icraf.org/publications",
                        "doi": "10.17528/cifor-icraf/009417"
                    }
                ],
                "cache_hit": True,
                "guardian_passed": True
            }
            log_entry = {
                "log_id": query_id,
                "original_query": query_text,
                "guardian_passed": True,
                "latency_ms": 45,
                "guardian_ms": 15,
                "architect_ms": 0,
                "retrieval_ms": 0,
                "synthesis_ms": 0,
                "cache_hit": True
            }
        else:
            # Custom instructions injection check
            user_inst = ""
            if req.user_id and req.user_id in state["user_profiles"]:
                user_inst = state["user_profiles"][req.user_id].get("custom_instructions", "")

            inst_prefix = f"[Applied User Custom Instructions: '{user_inst}']\n\n" if user_inst else ""

            resp_text = f"{inst_prefix}Based on Landscape Alliance literature, low-emission agroforestry and peatland restoration practices contribute up to 45% soil organic carbon retention in tropical ecosystems [Pingault & Martius, 2025]."

            status_data = {
                "status": "completed",
                "query_id": query_id,
                "response": resp_text,
                "sources": [
                    {
                        "title": "Towards low-emission food systems in Ghana: A country profile",
                        "authors": "Pingault, N., Martius, C.",
                        "year": 2025,
                        "url": "https://www.cifor-icraf.org/publications",
                        "doi": "10.17528/cifor-icraf/009412"
                    }
                ],
                "cache_hit": False,
                "guardian_passed": True
            }
            log_entry = {
                "log_id": query_id,
                "original_query": query_text,
                "guardian_passed": True,
                "latency_ms": 1150,
                "guardian_ms": 120,
                "architect_ms": 230,
                "retrieval_ms": 300,
                "synthesis_ms": 500,
                "cache_hit": False
            }

        state["queries"][query_id] = status_data
        state["query_interaction_logs"].append(log_entry)

        return {"query_id": query_id, "status": "processing"}

    @app.get("/query/status/{query_id}")
    def get_query_status(query_id: str):
        if query_id not in state["queries"]:
            raise HTTPException(status_code=404, detail="Query status not found.")
        return state["queries"][query_id]

    # 8. Info Navigation Endpoint
    @app.get("/info/{section}")
    def get_info_section(section: str):
        valid_sections = {
            "about": "# About acAIcia\nacAIcia is an autonomous multi-agent Retrieval-Augmented Generation (RAG) system built for Landscape Alliance (CIFOR-ICRAF).",
            "faqs": "# Frequently Asked Questions\nQ: What literature sources does acAIcia cover?\nA: Peer-reviewed publications and technical reports from CIFOR-ICRAF.",
            "blogs": "# Featured Publications & Policy Briefs\n- Opportunities for a low-emission transformation of Ghana's food systems (2026) [DOI: 10.17528/cifor-icraf/009417]",
            "contact": "# Contact & Institutional Research Enquiries\nEmail: info@acaicia.org\nAdministrator: b.obaga@landscapealliance.org"
        }
        if section not in valid_sections:
            raise HTTPException(status_code=404, detail="Info section not found.")
        return {"section": section, "content_markdown": valid_sections[section]}

    return app
