"""Standalone FastAPI server for acAIcia (Railway deployment).

Runs the same 4-stage RAG pipeline as the legacy Modal app, but with no Modal
dependency: Mistral is used for inference, Supabase for data, a local file store
(Railway volume) for settings/status, and an in-process thread for async queries.

Entrypoint:  ``uvicorn backend.server:app --host 0.0.0.0 --port $PORT``
"""

from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone as tz
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import (
    ALLOWED_PROVIDERS,
    COST_PER_1M_TOKENS,
    MISTRAL_CLASSIFIER_MODEL,
    MISTRAL_JUDGE_MODEL,
)
from .core import (
    FileSettingsStore,
    build_llm_caller,
    get_cached_embed_model,
    get_mistral_client,
    invalidate_provider_cache,
    mistral_complete,
    resolve_provider,
    verify_admin_key,
)
from .pipeline import run_rag_query

# ─────────────────────────────────────────────────────────────────────────────
# Logging / env
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("acaicia-server")

# Local dev convenience: load backend/.env if python-dotenv is available.
try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    load_dotenv()
except Exception:
    pass

DATA_DIR = os.environ.get("ACAICIA_DATA_DIR", "/data")
if not os.access(DATA_DIR, os.W_OK):
    DATA_DIR = os.environ.get("TMPDIR", "/tmp")
STORE = FileSettingsStore(DATA_DIR)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY]):
    raise RuntimeError(
        "Missing necessary environment variables for Supabase (SUPABASE_URL, SUPABASE_KEY)."
    )

from supabase import Client, create_client  # noqa: E402  (after env validation)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ─────────────────────────────────────────────────────────────────────────────
# Provider + LLM wiring
# ─────────────────────────────────────────────────────────────────────────────
def provider_getter() -> str:
    return resolve_provider(STORE, logger)


def _mistral_classifier(prompt: str) -> str:
    return mistral_complete(
        prompt, MISTRAL_CLASSIFIER_MODEL, max_tokens=12, temperature=0.0
    )


def _mistral_judge(prompt: str) -> str:
    return mistral_complete(prompt, MISTRAL_JUDGE_MODEL, max_tokens=8, temperature=0.0)


call_llm = build_llm_caller(provider_getter, logger)

_QUERY_WORKERS = int(os.environ.get("ACAICIA_QUERY_WORKERS", "4"))
_executor = ThreadPoolExecutor(max_workers=_QUERY_WORKERS, thread_name_prefix="rag")


def _run_query_job(query_id: str, req: "QueryRequest") -> None:
    try:
        embed_model = get_cached_embed_model(logger)
        run_rag_query(
            query_id=query_id,
            user_query=req.query,
            conversation_history=req.conversation_history,
            session_id=req.session_id,
            user_id=req.user_id,
            guest_session_id=req.guest_session_id,
            supabase=supabase,
            embed_model=embed_model,
            call_llm=call_llm,
            provider_getter=provider_getter,
            status_writer=lambda payload: STORE.write_status(query_id, payload),
            mistral_judge=_mistral_judge,
            topic_classifier=_mistral_classifier,
            logger=logger,
        )
    except Exception as exc:  # pragma: no cover - last-resort guard
        logger.exception("Unhandled error running RAG job %s", query_id)
        STORE.write_status(
            query_id, {"status": "failed", "error": f"Internal Server Error: {exc}"}
        )


# ─────────────────────────────────────────────────────────────────────────────
# Request / response models
# ─────────────────────────────────────────────────────────────────────────────
class QueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    guest_session_id: Optional[str] = None
    conversation_history: Optional[list[dict]] = None


class SettingsResponse(BaseModel):
    llm_provider: str
    google_api_key_configured: bool
    nvidia_api_key_configured: bool
    deepseek_api_key_configured: bool
    mistral_api_key_configured: bool
    hf_token_configured: bool
    active_source: str


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
    log_id: Optional[str] = None
    user_id: Optional[str] = None
    rating: int
    correction_text: Optional[str] = None


def _settings_response(provider: str, source: str) -> SettingsResponse:
    return SettingsResponse(
        llm_provider=provider,
        google_api_key_configured=bool(GOOGLE_API_KEY),
        nvidia_api_key_configured=bool(NVIDIA_API_KEY),
        deepseek_api_key_configured=bool(os.environ.get("DEEPSEEK_API_KEY")),
        mistral_api_key_configured=bool(os.environ.get("MISTRAL_API_KEY")),
        hf_token_configured=bool(os.environ.get("HF_TOKEN")),
        active_source=source,
    )


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="acAIcia Core API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # wildcard origin must not be combined with credentials
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "provider": provider_getter(),
        "mistral_configured": bool(os.environ.get("MISTRAL_API_KEY")),
    }


@app.get("/prompt_pills")
def get_prompt_pills():
    try:
        res = (
            supabase.table("prompt_pills")
            .select("*")
            .order("created_at", desc=True)
            .limit(6)
            .execute()
        )
        if res.data and len(res.data) > 0:
            return {
                "pills": [
                    item.get("question_text")
                    for item in res.data
                    if item.get("question_text")
                ]
            }
    except Exception as e:
        logger.warning("Could not fetch prompt pills from DB: %s", e)
    return {
        "pills": [
            "What percentage of Ghana anthropogenic GHG emissions come from food systems?",
            "Outline indigenous agroforestry plants in Kenya and suitable soil profiles.",
            "What are key policy recommendations for peatland restoration in Southeast Asia?",
            "How do shade-grown coffee systems impact soil organic carbon sequestration?",
        ]
    }


@app.get("/settings", response_model=SettingsResponse)
def get_settings():
    provider = "mistral"
    active_source = "default"
    data = STORE.read_settings()
    val = data.get("llm_provider")
    if val in ALLOWED_PROVIDERS:
        provider = val
        active_source = "store"
    else:
        provider = provider_getter()
        active_source = "env"
    return _settings_response(provider, active_source)


@app.post("/settings", response_model=SettingsResponse)
def update_settings(
    request: SettingsRequest, authorization: Optional[str] = Header(default=None)
):
    # Global model governance is admin-only.
    if not verify_admin_key(authorization):
        raise HTTPException(
            status_code=401,
            detail="Admin API key required. Set Authorization: Bearer <ADMIN_API_KEY>.",
        )
    if request.llm_provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid LLM provider.")
    try:
        STORE.write_settings({"llm_provider": request.llm_provider})
        invalidate_provider_cache()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write settings: {e}")
    return _settings_response(request.llm_provider, "store")


@app.post("/feedback")
def submit_feedback(req: FeedbackRequest):
    try:

        def safe_uuid(val: Optional[str]) -> Optional[str]:
            if not val:
                return None
            try:
                return str(uuid.UUID(val))
            except Exception:
                return None

        user_uuid = safe_uuid(req.user_id)
        if not user_uuid and req.user_id and "@" in req.user_id:
            try:
                p_res = (
                    supabase.table("user_profiles")
                    .select("user_id")
                    .eq("email", req.user_id)
                    .execute()
                )
                if p_res.data:
                    user_uuid = p_res.data[0]["user_id"]
                else:
                    up_res = (
                        supabase.table("user_profiles")
                        .upsert(
                            {
                                "email": req.user_id,
                                "full_name": req.user_id.split("@")[0].capitalize(),
                                "role": "researcher",
                            }
                        )
                        .execute()
                    )
                    if up_res.data:
                        user_uuid = up_res.data[0]["user_id"]
            except Exception as u_err:
                logger.warning(
                    "Could not resolve user UUID for email %s: %s", req.user_id, u_err
                )

        log_uuid = safe_uuid(req.log_id)
        if log_uuid:
            try:
                log_check = (
                    supabase.table("query_interaction_logs")
                    .select("log_id")
                    .eq("log_id", log_uuid)
                    .execute()
                )
                if not log_check.data:
                    log_uuid = None
            except Exception:
                log_uuid = None

        payload = {"rating": req.rating, "correction_text": req.correction_text}
        if user_uuid:
            payload["user_id"] = user_uuid
        if log_uuid:
            payload["log_id"] = log_uuid

        res = supabase.table("query_feedback").insert(payload).execute()
        logger.info(
            "👍 Feedback recorded: rating=%s, user=%s, log=%s",
            req.rating,
            req.user_id,
            req.log_id,
        )
        return {"status": "success", "data": res.data}
    except Exception as e:
        logger.error("Feedback insert error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {e}")


@app.get("/user/settings")
def get_user_profile(user_id: str):
    try:
        res = (
            supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
        )
        if res.data and len(res.data) > 0:
            return res.data[0]
        return {
            "user_id": user_id,
            "full_name": "Guest Researcher",
            "preferred_name": "",
            "work_description": "",
            "custom_instructions": "",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/user/settings")
def update_user_profile(req: UserProfileRequest):
    try:
        u_id = req.user_id or "00000000-0000-0000-0000-000000000000"
        payload = {
            "user_id": u_id,
            "email": req.email,
            "full_name": req.full_name,
            "preferred_name": req.preferred_name,
            "work_description": req.work_description,
            "custom_instructions": req.custom_instructions,
            "updated_at": "now()",
        }
        res = supabase.table("user_profiles").upsert(payload).execute()
        return {"status": "success", "profile": res.data[0] if res.data else payload}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# Admin endpoints
# ─────────────────────────────────────────────────────────────────────────────
def _require_admin(authorization: Optional[str] = None):
    if not verify_admin_key(authorization):
        raise HTTPException(
            status_code=401,
            detail="Admin API key required. Set Authorization: Bearer <ADMIN_API_KEY>.",
        )


@app.get("/admin/metrics")
def get_admin_metrics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    topic: Optional[str] = None,
    provider: Optional[str] = None,
    query_type: Optional[str] = None,
    hour_start: Optional[int] = None,
    hour_end: Optional[int] = None,
    authorization: Optional[str] = Header(default=None),
):
    _require_admin(authorization)
    try:
        end_dt = end_date or datetime.now(tz.utc).date().isoformat()
        start_dt = (
            start_date or (datetime.now(tz.utc).date() - timedelta(days=30)).isoformat()
        )

        q = (
            supabase.table("query_interaction_logs")
            .select("*")
            .gte("timestamp", f"{start_dt}T00:00:00Z")
            .lte("timestamp", f"{end_dt}T23:59:59Z")
            .order("timestamp", desc=True)
            .limit(2000)
        )
        if topic:
            q = q.eq("topic_category", topic)
        if provider:
            q = q.eq("provider_used", provider)
        if query_type:
            q = q.eq("query_type", query_type)
        logs = q.execute().data or []

        if hour_start is not None or hour_end is not None:
            hs, he = (hour_start or 0), (hour_end or 23)

            def in_hour(row):
                try:
                    ts = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
                    return hs <= ts.hour <= he
                except Exception:
                    return True

            logs = [entry for entry in logs if in_hour(entry)]

        total_queries = len(logs)
        cache_hits = sum(1 for entry in logs if entry.get("cache_hit"))
        guardian_fails = sum(1 for entry in logs if not entry.get("guardian_passed"))
        fallback_count = sum(
            1
            for entry in logs
            if entry.get("synthesis_source") == "general_knowledge_fallback"
        )

        user_ids = set()
        for entry in logs:
            if entry.get("user_id"):
                user_ids.add(str(entry["user_id"]))
            elif entry.get("guest_session_id"):
                user_ids.add(f"guest:{entry['guest_session_id']}")
        guest_queries = sum(1 for entry in logs if not entry.get("user_id"))

        lats = sorted(
            [entry.get("latency_ms", 0) for entry in logs if entry.get("latency_ms")]
        )

        def pct(arr, p):
            return arr[min(int(len(arr) * p // 100), len(arr) - 1)] if arr else 0

        p50, p95, p99 = pct(lats, 50), pct(lats, 95), pct(lats, 99)

        tq = max(total_queries, 1)

        def stage_avg(field):
            return sum(entry.get(field, 0) or 0 for entry in logs) / tq

        total_tokens = sum(entry.get("total_tokens_used", 0) or 0 for entry in logs)
        total_in_tok = sum(entry.get("input_tokens", 0) or 0 for entry in logs)
        total_out_tok = sum(entry.get("output_tokens", 0) or 0 for entry in logs)
        total_cost = sum(entry.get("estimated_cost_usd", 0.0) or 0.0 for entry in logs)

        cost_by_prov: dict = {}
        topic_dist: dict = {}
        qtype_dist: dict = {}
        ts_map: dict = {}
        hm_map: dict = {}

        for entry in logs:
            pv = entry.get("provider_used") or "unknown"
            cost_by_prov[pv] = round(
                cost_by_prov.get(pv, 0.0) + (entry.get("estimated_cost_usd") or 0.0), 6
            )
            t = entry.get("topic_category") or "general"
            topic_dist[t] = topic_dist.get(t, 0) + 1
            qt = entry.get("query_type") or "unknown"
            qtype_dist[qt] = qtype_dist.get(qt, 0) + 1
            try:
                day = entry["timestamp"][:10]
                e = ts_map.setdefault(
                    day,
                    {
                        "day": day,
                        "total_queries": 0,
                        "cache_hits": 0,
                        "lat_sum": 0,
                        "lat_n": 0,
                        "tokens": 0,
                        "cost": 0.0,
                    },
                )
                e["total_queries"] += 1
                if entry.get("cache_hit"):
                    e["cache_hits"] += 1
                if entry.get("latency_ms"):
                    e["lat_sum"] += entry["latency_ms"]
                    e["lat_n"] += 1
                e["tokens"] += entry.get("total_tokens_used", 0) or 0
                e["cost"] += entry.get("estimated_cost_usd", 0.0) or 0.0
            except Exception:
                pass
            try:
                ts = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00"))
                k = (ts.weekday(), ts.hour)
                he = hm_map.setdefault(
                    k,
                    {
                        "day_of_week": k[0],
                        "hour_utc": k[1],
                        "query_count": 0,
                        "cache_hits": 0,
                        "lat_sum": 0,
                        "lat_n": 0,
                    },
                )
                he["query_count"] += 1
                if entry.get("cache_hit"):
                    he["cache_hits"] += 1
                if entry.get("latency_ms"):
                    he["lat_sum"] += entry["latency_ms"]
                    he["lat_n"] += 1
            except Exception:
                pass

        timeseries = [
            {
                "day": d,
                "total_queries": e["total_queries"],
                "cache_hits": e["cache_hits"],
                "avg_latency_ms": round(e["lat_sum"] / (e["lat_n"] or 1), 1),
                "total_tokens": e["tokens"],
                "estimated_cost_usd": round(e["cost"], 6),
            }
            for d, e in sorted(ts_map.items())
        ]
        hourly_heatmap = [
            {
                "day_of_week": e["day_of_week"],
                "hour_utc": e["hour_utc"],
                "query_count": e["query_count"],
                "cache_hits": e["cache_hits"],
                "avg_latency_ms": round(e["lat_sum"] / (e["lat_n"] or 1), 1),
            }
            for e in sorted(
                hm_map.values(), key=lambda x: (x["day_of_week"], x["hour_utc"])
            )
        ]

        fb_res = (
            supabase.table("query_feedback")
            .select("feedback_id,rating,correction_text,created_at,user_id,log_id")
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        fb_data = fb_res.data or []
        if fb_data:
            u_ids = list(set([f["user_id"] for f in fb_data if f.get("user_id")]))
            if u_ids:
                try:
                    users_res = (
                        supabase.table("user_profiles")
                        .select("user_id, email, full_name")
                        .in_("user_id", u_ids)
                        .execute()
                    )
                    umap = {
                        u["user_id"]: u.get("email") or u.get("full_name")
                        for u in (users_res.data or [])
                    }
                    for f in fb_data:
                        if f.get("user_id") in umap:
                            f["user_email"] = umap[f["user_id"]]
                except Exception as umap_err:
                    logger.warning("Failed to map user emails: %s", umap_err)
        ratings = [f.get("rating") for f in fb_data if f.get("rating")]
        upvotes = sum(1 for r in ratings if r == 1)
        downvotes = sum(1 for r in ratings if r == -1)

        ragas_res = (
            supabase.table("production_eval_scores")
            .select("*")
            .order("timestamp", desc=True)
            .limit(20)
            .execute()
        )
        alerts_res = (
            supabase.table("system_alerts")
            .select("*")
            .eq("resolved", False)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        eval_res = (
            supabase.table("evaluation_runs")
            .select("*")
            .order("timestamp", desc=True)
            .limit(10)
            .execute()
        )

        return {
            "filter_state": {
                "start_date": start_dt,
                "end_date": end_dt,
                "topic": topic,
                "provider": provider,
                "query_type": query_type,
                "hour_start": hour_start,
                "hour_end": hour_end,
            },
            "total_queries": total_queries,
            "unique_users": len(user_ids),
            "guest_queries": guest_queries,
            "cache_hit_rate_pct": round((cache_hits / tq) * 100, 1),
            "guardian_pass_rate_pct": round(
                ((total_queries - guardian_fails) / tq) * 100, 1
            ),
            "fallback_rate_pct": round((fallback_count / tq) * 100, 1),
            "p50_latency_ms": p50,
            "p95_latency_ms": p95,
            "p99_latency_ms": p99,
            "stage_latency_averages": {
                "guardian_ms": round(stage_avg("guardian_ms"), 1),
                "architect_ms": round(stage_avg("architect_ms"), 1),
                "retrieval_ms": round(stage_avg("retrieval_ms"), 1),
                "synthesis_ms": round(stage_avg("synthesis_ms"), 1),
            },
            "total_tokens_used": total_tokens,
            "total_input_tokens": total_in_tok,
            "total_output_tokens": total_out_tok,
            "estimated_total_cost_usd": round(total_cost, 4),
            "cost_by_provider": cost_by_prov,
            "topic_distribution": topic_dist,
            "query_type_distribution": qtype_dist,
            "timeseries": timeseries,
            "hourly_heatmap": hourly_heatmap,
            "user_feedback": {
                "upvotes": upvotes,
                "downvotes": downvotes,
                "satisfaction_pct": round(
                    (upvotes / max(upvotes + downvotes, 1)) * 100, 1
                ),
            },
            "recent_evaluations": eval_res.data or [],
            "recent_feedback": fb_data,
            "ragas_scores": ragas_res.data or [],
            "system_alerts": alerts_res.data or [],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/users")
def get_admin_users(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    limit: int = 25,
    authorization: Optional[str] = Header(default=None),
):
    _require_admin(authorization)
    try:
        end_dt = end_date or datetime.now(tz.utc).date().isoformat()
        start_dt = (
            start_date or (datetime.now(tz.utc).date() - timedelta(days=30)).isoformat()
        )
        result = supabase.rpc(
            "get_user_cost_breakdown",
            {
                "p_start_date": start_dt,
                "p_end_date": end_dt,
                "p_limit": limit * page,
            },
        ).execute()
        all_rows = result.data or []
        offset = (page - 1) * limit
        return {
            "users": all_rows[offset : offset + limit],
            "total": len(all_rows),
            "page": page,
            "limit": limit,
            "start_date": start_dt,
            "end_date": end_dt,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/topics")
def get_admin_topics(authorization: Optional[str] = Header(default=None)):
    _require_admin(authorization)
    try:
        taxonomy = (
            supabase.table("topic_taxonomy").select("*").order("sort_order").execute()
        )
        counts_res = (
            supabase.table("query_interaction_logs").select("topic_category").execute()
        )
        counts: dict = {}
        for row in counts_res.data or []:
            t = row.get("topic_category") or "general"
            counts[t] = counts.get(t, 0) + 1
        topics_out = []
        for t in taxonomy.data or []:
            t["query_count"] = counts.get(t["topic_id"], 0)
            topics_out.append(t)
        return {"topics": topics_out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/documents/popular")
def get_popular_documents(
    limit: int = 20, authorization: Optional[str] = Header(default=None)
):
    _require_admin(authorization)
    try:
        res = (
            supabase.table("popular_documents")
            .select("*")
            .order("query_count", desc=True)
            .limit(limit)
            .execute()
        )
        return {"documents": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/cache/stats")
def get_cache_stats(authorization: Optional[str] = Header(default=None)):
    _require_admin(authorization)
    try:
        stats = (
            supabase.table("semantic_cache")
            .select("cache_id,created_at")
            .order("created_at")
            .execute()
        )
        entries = stats.data or []
        return {
            "total_entries": len(entries),
            "oldest_entry_at": entries[0]["created_at"] if entries else None,
            "newest_entry_at": entries[-1]["created_at"] if entries else None,
            "cost_per_1m_tokens": COST_PER_1M_TOKENS,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/cache/clear")
def clear_semantic_cache(authorization: Optional[str] = Header(default=None)):
    _require_admin(authorization)
    try:
        supabase.table("semantic_cache").delete().neq(
            "cache_id", "00000000-0000-0000-0000-000000000000"
        ).execute()
        logger.info("⚠️ Semantic cache cleared by admin.")
        return {"status": "cleared", "message": "Semantic cache has been cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/alerts")
def get_system_alerts(
    resolved: bool = False, authorization: Optional[str] = Header(default=None)
):
    _require_admin(authorization)
    try:
        res = (
            supabase.table("system_alerts")
            .select("*")
            .eq("resolved", resolved)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        return {"alerts": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, authorization: Optional[str] = Header(default=None)):
    _require_admin(authorization)
    try:
        supabase.table("system_alerts").update(
            {"resolved": True, "resolved_at": datetime.now(tz.utc).isoformat()}
        ).eq("alert_id", alert_id).execute()
        return {"status": "resolved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/evaluations")
def get_evaluation_history(
    limit: int = 20, page: int = 1, authorization: Optional[str] = Header(default=None)
):
    _require_admin(authorization)
    try:
        offset = (page - 1) * limit
        eval_res = (
            supabase.table("evaluation_runs")
            .select("*")
            .order("timestamp", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        ragas_res = (
            supabase.table("production_eval_scores")
            .select("*")
            .order("timestamp", desc=True)
            .limit(50)
            .execute()
        )
        ragas_data = ragas_res.data or []

        def avgf(field):
            vals = [r[field] for r in ragas_data if r.get(field) is not None]
            return round(sum(vals) / len(vals), 4) if vals else None

        runs_list = eval_res.data or []
        return {
            "evaluation_runs": runs_list,
            "data": runs_list,
            "page": page,
            "limit": limit,
            "production_ragas": {
                "sample_count": len(ragas_data),
                "avg_faithfulness": avgf("faithfulness"),
                "avg_answer_relevance": avgf("answer_relevance"),
                "avg_context_precision": avgf("context_precision"),
                "avg_overall_score": avgf("overall_score"),
                "recent_scores": ragas_data[:20],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _run_evaluation_job(run_id: str, dataset: str, limit: int, eval_mode: str) -> None:
    try:
        from .evaluation_engine import EvaluationEngine

        backend_url = os.environ.get("ACAICIA_BACKEND_URL", "http://localhost:8000")
        engine = EvaluationEngine(
            supabase_client=supabase,
            backend_url=backend_url,
            judge_model_name=MISTRAL_JUDGE_MODEL,
        )
        engine.run_evaluation(
            dataset_name=dataset,
            run_type="admin_dashboard",
            triggered_by="admin_dashboard",
            limit=limit,
            run_id=run_id,
            eval_mode=eval_mode,
            include_canaries=(eval_mode != "retrieval_only"),
        )
    except Exception as err:
        logger.error("Evaluation background thread failed: %s", err)


@app.post("/admin/evaluations/trigger")
def trigger_evaluation(
    dataset: str = "test_questions.csv",
    limit: int = 20,
    eval_mode: str = "full",
    authorization: Optional[str] = Header(default=None),
):
    _require_admin(authorization)
    run_id = str(uuid.uuid4())
    try:
        run_payload = {
            "run_id": run_id,
            "dataset_name": dataset,
            "num_questions": 0,
            "hit_rate_at_5": 0.0,
            "context_precision": 0.0,
            "avg_latency_ms": 0.0,
            "model_provider": MISTRAL_JUDGE_MODEL,
            "timestamp": datetime.now(tz.utc).isoformat(),
            "details": {
                "status": "running",
                "run_type": "admin_dashboard",
                "eval_mode": eval_mode,
                "judge_model": MISTRAL_JUDGE_MODEL,
                "triggered_by": "admin_dashboard",
                "config": {"dataset": dataset, "limit": limit, "eval_mode": eval_mode},
            },
        }
        try:
            extended_payload = dict(run_payload)
            extended_payload.update(
                {
                    "run_type": "admin_dashboard",
                    "eval_mode": eval_mode,
                    "judge_model": MISTRAL_JUDGE_MODEL,
                    "triggered_by": "admin_dashboard",
                    "status": "running",
                    "config": {
                        "dataset": dataset,
                        "limit": limit,
                        "eval_mode": eval_mode,
                    },
                }
            )
            supabase.table("evaluation_runs").upsert(extended_payload).execute()
        except Exception as upsert_err:
            logger.warning(
                "Extended evaluation_runs upsert failed (%s), using base columns...",
                upsert_err,
            )
            supabase.table("evaluation_runs").upsert(run_payload).execute()

        threading.Thread(
            target=_run_evaluation_job,
            args=(run_id, dataset, limit, eval_mode),
            daemon=True,
        ).start()
        logger.info("Started evaluation worker thread for run %s", run_id)
        return {
            "run_id": run_id,
            "status": "running",
            "message": f"Evaluation run {run_id} started successfully.",
        }
    except Exception as e:
        logger.error("Failed to trigger evaluation run: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/evaluations/trends")
def get_evaluation_trends(
    limit: int = 30, authorization: Optional[str] = Header(default=None)
):
    _require_admin(authorization)
    try:
        try:
            trends_res = (
                supabase.table("evaluation_score_trends")
                .select("*")
                .order("timestamp", desc=False)
                .limit(limit)
                .execute()
            )
            if trends_res.data:
                return {"trends": trends_res.data}
        except Exception as view_err:
            logger.warning(
                "evaluation_score_trends view query failed (%s), using table fallback.",
                view_err,
            )

        runs = (
            supabase.table("evaluation_runs")
            .select("*")
            .order("timestamp", desc=False)
            .limit(limit)
            .execute()
            .data
            or []
        )
        trends = []
        for r in runs:
            details_dict = r.get("details") or {}
            trends.append(
                {
                    "run_id": r.get("run_id"),
                    "timestamp": r.get("timestamp"),
                    "run_type": r.get("run_type")
                    or details_dict.get("run_type", "manual"),
                    "dataset_name": r.get("dataset_name", ""),
                    "judge_model": r.get("judge_model")
                    or details_dict.get("judge_model", r.get("model_provider")),
                    "passed": r.get("passed")
                    if r.get("passed") is not None
                    else details_dict.get("passed", False),
                    "num_questions": r.get("num_questions", 0),
                    "status": r.get("status")
                    or details_dict.get("status", "completed"),
                    "duration_sec": r.get("duration_sec")
                    or details_dict.get("duration_sec"),
                    "run_cost_usd": r.get("total_cost_usd", 0.0),
                    "avg_faithfulness": details_dict.get("avg_faithfulness"),
                    "avg_answer_relevancy": details_dict.get("avg_answer_relevancy"),
                    "avg_context_precision": r.get("context_precision"),
                    "avg_context_recall": details_dict.get("avg_context_recall"),
                    "avg_citation_quality": details_dict.get("avg_citation_quality"),
                    "avg_latency_ms": r.get("avg_latency_ms"),
                    "hit_rate_at_5_pct": r.get("hit_rate_at_5"),
                    "canary_violations": details_dict.get("canary_violations", 0),
                    "canary_total": details_dict.get("canary_total", 0),
                    "total_details": r.get("num_questions", 0),
                }
            )
        return {"trends": trends}
    except Exception as e:
        logger.error("Error fetching evaluation trends: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/evaluations/{run_id}/details")
def get_evaluation_run_details(
    run_id: str, authorization: Optional[str] = Header(default=None)
):
    _require_admin(authorization)
    try:
        run_res = (
            supabase.table("evaluation_runs").select("*").eq("run_id", run_id).execute()
        )
        if not run_res.data:
            raise HTTPException(
                status_code=404, detail=f"Evaluation run '{run_id}' not found"
            )
        details = []
        try:
            details_res = (
                supabase.table("evaluation_details")
                .select("*")
                .eq("run_id", run_id)
                .order("question_index", desc=False)
                .execute()
            )
            details = details_res.data or []
        except Exception as de:
            logger.warning(
                "Could not query evaluation_details (%s), returning empty list", de
            )
        return {"run": run_res.data[0], "details": details}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching eval run details for %s: %s", run_id, e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/export/csv")
def export_query_logs_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    _require_admin(authorization)
    try:
        import csv
        import io
        from fastapi.responses import StreamingResponse

        end_dt = end_date or datetime.now(tz.utc).date().isoformat()
        start_dt = (
            start_date or (datetime.now(tz.utc).date() - timedelta(days=30)).isoformat()
        )
        rows = (
            supabase.table("query_interaction_logs")
            .select(
                "log_id,timestamp,session_id,original_query,guardian_passed,topic_category,provider_used,synthesis_source,total_tokens_used,estimated_cost_usd,latency_ms,cache_hit,search_mode"
            )
            .gte("timestamp", f"{start_dt}T00:00:00Z")
            .lte("timestamp", f"{end_dt}T23:59:59Z")
            .order("timestamp")
            .limit(5000)
            .execute()
            .data
            or []
        )
        buf = io.StringIO()
        if rows:
            writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        buf.seek(0)
        filename = f"acaicia_logs_{start_dt}_to_{end_dt}.csv"
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# Query endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/query")
def handle_query(request: QueryRequest):
    query_id = str(uuid.uuid4())
    try:
        STORE.write_status(
            query_id,
            {
                "status": "processing",
                "query_id": query_id,
                "original_query": request.query,
            },
        )
        _executor.submit(_run_query_job, query_id, request)
        return {"query_id": query_id, "status": "processing"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to initialize query processing: {e}"
        )


@app.get("/query/status/{query_id}")
def get_query_status(query_id: str):
    # 1. Local status file
    data = STORE.read_status(query_id)
    if data and data.get("status") in ("completed", "failed"):
        return data

    # 2. Supabase fallback (covers restarts / multiple instances)
    try:
        log_res = (
            supabase.table("query_interaction_logs")
            .select("original_query, cache_hit")
            .eq("log_id", query_id)
            .execute()
        )
        if log_res.data:
            orig_q = log_res.data[0].get("original_query")
            if orig_q:
                cache_res = (
                    supabase.table("semantic_cache")
                    .select("response_text, sources")
                    .eq("query_text", orig_q)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if cache_res.data:
                    return {
                        "status": "completed",
                        "query_id": query_id,
                        "response": cache_res.data[0].get("response_text"),
                        "sources": cache_res.data[0].get("sources", []),
                        "cache_hit": log_res.data[0].get("cache_hit", False),
                    }
    except Exception as db_err:
        logger.debug("Supabase status fallback failed for %s: %s", query_id, db_err)

    # 3. Still processing locally
    if data:
        return data

    # 4. Graceful default (never 404)
    return {
        "status": "processing",
        "query_id": query_id,
        "stage": "Processing RAG Pipeline",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.server:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000"))
    )
