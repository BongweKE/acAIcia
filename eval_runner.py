#!/usr/bin/env python3
import os
import sys
import csv
import json
import time
import argparse
from pathlib import Path
import modal

# Define Modal App and Image with all dependencies
app = modal.App("acaicia-eval-runner")

image = modal.Image.debian_slim().pip_install(
    "google-genai", 
    "supabase", 
    "pydantic",
    "torch",
    "sentence-transformers",
    "requests",
    "modal",
    "hf_transfer"
)

secrets = [
    modal.Secret.from_name("acaicia-db-secrets"),
    modal.Secret.from_name("acaicia-llm-secrets")
]

hf_cache_vol = modal.Volume.from_name("acaicia-hf-cache", create_if_missing=True)

# Sample evaluation dataset inline for remote Modal execution
SAMPLE_QUESTIONS = [
    {
        "document_title": "Opportunities for a low-emission transformation of Ghana’s food systems",
        "doi": "10.17528/cifor-icraf/009417",
        "test_question": "What percentage of Ghana’s total national anthropogenic GHG emissions come from food systems?",
        "expected_answer": "54.1%"
    },
    {
        "document_title": "Towards low-emission food systems in Ghana: A country profile",
        "doi": "10.17528/cifor-icraf/009412",
        "test_question": "According to the report, what share of global anthropogenic greenhouse gas emissions are attributed to food systems?",
        "expected_answer": "about one-third"
    },
    {
        "document_title": "Peat Hydrological Properties and Vulnerability to Fire Risk",
        "doi": "10.3390/fire9010024",
        "test_question": "During the 58-day dry period monitored in South Sumatra, what was the maximum groundwater depth reached?",
        "expected_answer": "78.5 cm"
    },
    {
        "document_title": "Effects of smoke haze on respiratory clinic visits in Central Kalimantan, Indonesia according to different haze characteristics",
        "doi": "10.1093/ije/dyaf169",
        "test_question": "By what percentage did respiratory clinic visits increase during fire-haze days in Pulang Pisau Regency?",
        "expected_answer": "74.4%"
    },
    {
        "document_title": "A global assemblage of regional prescribed burn records — GlobalRx",
        "doi": "10.1038/s41597-025-04941-w",
        "test_question": "How many prescribed burn records does the GlobalRx dataset contain?",
        "expected_answer": "204,517"
    }
]

@app.function(
    image=image,
    secrets=secrets,
    volumes={"/root/.cache/huggingface": hf_cache_vol},
    timeout=600
)
def run_evaluations_remote(dataset_name: str = "test_questions.csv", use_hybrid: bool = True):
    import time
    from sentence_transformers import SentenceTransformer
    from supabase import create_client

    print(f"\n============================================================")
    print(f" acAIcia RAG Evaluation Runner (Modal Remote Ephemeral Mode)")
    print(f" Dataset: {dataset_name} | Mode: {'Hybrid RRF' if use_hybrid else 'Dense Vector'}")
    print(f"============================================================\n")

    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Missing Supabase credentials in Modal secrets.")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✓ Connected to Supabase DB.")

    print("Loading SentenceTransformer model BAAI/bge-base-en-v1.5...")
    embed_model = SentenceTransformer('BAAI/bge-base-en-v1.5')

    questions = SAMPLE_QUESTIONS
    print(f"Running evaluation across {len(questions)} test questions...")

    results = []
    hit_at_1_count = 0
    hit_at_5_count = 0
    total_latency_ms = 0
    context_precision_scores = []

    for idx, q in enumerate(questions):
        question_text = q.get('test_question', '').strip()
        target_title = q.get('document_title', '').strip().lower()
        target_doi = q.get('doi', '').strip().lower()

        start_t = time.time()
        query_emb = embed_model.encode([question_text], convert_to_numpy=True)[0].tolist()

        matched_docs = []
        try:
            if use_hybrid:
                res = supabase.rpc("match_documents_hybrid", {
                    "query_text": question_text,
                    "query_embedding": query_emb,
                    "match_count": 5
                }).execute()
            else:
                res = supabase.rpc("match_documents", {
                    "query_embedding": query_emb,
                    "match_threshold": 0.3,
                    "match_count": 5
                }).execute()
            matched_docs = res.data if res.data else []
        except Exception as rpc_err:
            print(f"  [Q{idx+1}] Hybrid search fallback: {rpc_err}")
            try:
                res = supabase.rpc("match_documents", {
                    "query_embedding": query_emb,
                    "match_threshold": 0.3,
                    "match_count": 5
                }).execute()
                matched_docs = res.data if res.data else []
            except Exception:
                matched_docs = []

        elapsed_ms = int((time.time() - start_t) * 1000)
        total_latency_ms += elapsed_ms

        hit_1 = False
        hit_5 = False
        matching_retrieved_count = 0

        for rank, doc in enumerate(matched_docs):
            title = (doc.get('title') or '').lower()
            doi = (doc.get('doi') or '').lower()

            is_match = False
            if target_title and target_title in title:
                is_match = True
            elif target_doi and target_doi in doi:
                is_match = True

            if is_match:
                matching_retrieved_count += 1
                if rank == 0:
                    hit_1 = True
                hit_5 = True

        if hit_1:
            hit_at_1_count += 1
        if hit_5:
            hit_at_5_count += 1

        precision = (matching_retrieved_count / len(matched_docs)) if matched_docs else 0.0
        context_precision_scores.append(precision)

        status_str = "HIT@1" if hit_1 else ("HIT@5" if hit_5 else "MISS")
        print(f"  [{idx+1}/{len(questions)}] {status_str:6s} | Latency: {elapsed_ms}ms | Q: {question_text[:50]}...")

        results.append({
            "question": question_text,
            "hit_at_1": hit_1,
            "hit_at_5": hit_5,
            "latency_ms": elapsed_ms,
            "precision": precision
        })

    total_q = len(results) or 1
    hit_rate_1 = (hit_at_1_count / total_q) * 100
    hit_rate_5 = (hit_at_5_count / total_q) * 100
    avg_latency = total_latency_ms / total_q
    avg_precision = (sum(context_precision_scores) / total_q) * 100

    print(f"\n" + "=" * 60)
    print(f" MODAL REMOTE EVALUATION RESULTS ")
    print(f"=" * 60)
    print(f" Total Questions:        {total_q}")
    print(f" Hit Rate @ 1:           {hit_rate_1:.2f}%")
    print(f" Hit Rate @ 5:           {hit_rate_5:.2f}%")
    print(f" Mean Context Precision: {avg_precision:.2f}%")
    print(f" Mean Latency:           {avg_latency:.1f} ms")
    print(f"=" * 60 + "\n")

    try:
        supabase.table("evaluation_runs").insert({
            "dataset_name": dataset_name,
            "num_questions": total_q,
            "hit_rate_at_5": float(round(hit_rate_5, 2)),
            "context_precision": float(round(avg_precision, 2)),
            "avg_latency_ms": float(round(avg_latency, 1)),
            "model_provider": "gemini",
            "details": {"hit_rate_at_1": hit_rate_1, "hit_rate_at_5": hit_rate_5, "avg_latency_ms": avg_latency}
        }).execute()
        print("✓ Evaluation metrics successfully recorded in Supabase table 'evaluation_runs'.")
    except Exception as db_err:
        print(f"⚠️ Failed to insert evaluation metrics to DB: {db_err}")

    return {
        "hit_rate_at_1": hit_rate_1,
        "hit_rate_at_5": hit_rate_5,
        "context_precision": avg_precision,
        "avg_latency_ms": avg_latency
    }

@app.local_entrypoint()
def main():
    res = run_evaluations_remote.remote()
    print("Modal Remote Evaluation Completed Successfully:")
    print(json.dumps(res, indent=2))
