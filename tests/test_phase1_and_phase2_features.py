"""Unit tests for Phase 1 & Phase 2 features:
- Issue #19: Multi-replica SharedQueryStatusStore
- Issue #6: Native pgvector semantic cache RPC lookup
- Issue #3: Cross-Encoder reranker
- Issue #2: LiteLLM Unified Gateway
- Issue #7: Langfuse Observability
"""

from __future__ import annotations

import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest

from backend.core import (
    FileSettingsStore,
    SharedQueryStatusStore,
    build_llm_caller,
    get_langfuse_client,
    trace_generation_with_langfuse,
)
from backend.pipeline import get_cached_reranker, rerank_chunks, run_rag_query


def test_shared_query_status_store_writes_both_local_and_supabase():
    with tempfile.TemporaryDirectory() as tmp_dir:
        file_store = FileSettingsStore(tmp_dir)
        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table
        mock_table.upsert.return_value.execute.return_value = MagicMock(data=[])

        store = SharedQueryStatusStore(file_store, supabase_client=mock_supabase)
        query_id = "test-query-1234"
        payload = {
            "status": "processing",
            "stage": "Hybrid Retrieval",
            "original_query": "What is agroforestry?",
        }

        store.write_status(query_id, payload)

        # 1. Local file store must have it
        local_read = file_store.read_status(query_id)
        assert local_read is not None
        assert local_read["status"] == "processing"
        assert local_read["stage"] == "Hybrid Retrieval"

        # 2. Supabase upsert must have been called
        mock_supabase.table.assert_called_with("query_jobs")
        mock_table.upsert.assert_called_once()
        upsert_arg = mock_table.upsert.call_args[0][0]
        assert upsert_arg["query_id"] == query_id
        assert upsert_arg["status"] == "processing"


def test_shared_query_status_store_reads_from_supabase_when_local_absent():
    with tempfile.TemporaryDirectory() as tmp_dir:
        file_store = FileSettingsStore(tmp_dir)
        mock_supabase = MagicMock()
        mock_table = MagicMock()
        mock_supabase.table.return_value = mock_table

        # Mock query_jobs returning a completed query from another replica
        mock_table.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            MagicMock(
                data=[
                    {
                        "query_id": "replica-query-5678",
                        "status": "completed",
                        "stage": "Completed",
                        "response": "Agroforestry integrates trees with crops.",
                        "sources": [{"title": "CIFOR Agroforestry Guide"}],
                        "cache_hit": False,
                    }
                ]
            )
        )

        store = SharedQueryStatusStore(file_store, supabase_client=mock_supabase)
        status = store.read_status("replica-query-5678")

        assert status is not None
        assert status["status"] == "completed"
        assert status["response"] == "Agroforestry integrates trees with crops."
        assert len(status["sources"]) == 1


def test_cross_encoder_rerank_chunks_reorders_by_score():
    chunks = [
        {"id": "doc1", "chunk_text": "Random text about cars and engines."},
        {"id": "doc2", "chunk_text": "Detailed CIFOR study on agroforestry and soil fertility."},
    ]
    query = "Agroforestry soil fertility"

    mock_reranker = MagicMock()
    # Assign higher score to doc2
    mock_reranker.predict.return_value = [0.12, 0.95]

    with patch("backend.pipeline.get_cached_reranker", return_value=mock_reranker):
        reranked, applied = rerank_chunks(query, chunks, top_k=2)
        assert applied is True
        assert len(reranked) == 2
        assert reranked[0]["id"] == "doc2"
        assert reranked[0]["rerank_score"] == 0.95
        assert reranked[1]["id"] == "doc1"


def test_cross_encoder_rerank_handles_model_failure_gracefully():
    chunks = [
        {"id": "doc1", "chunk_text": "Sample chunk 1"},
        {"id": "doc2", "chunk_text": "Sample chunk 2"},
    ]
    query = "Sample query"

    with patch("backend.pipeline.get_cached_reranker", return_value=None):
        reranked, applied = rerank_chunks(query, chunks, top_k=1)
        assert applied is False
        assert len(reranked) == 1
        assert reranked[0]["id"] == "doc1"


def test_native_pgvector_semantic_cache_rpc_hit(monkeypatch):
    mock_supabase = MagicMock()
    mock_rpc = MagicMock()
    mock_supabase.rpc.return_value = mock_rpc

    # Simulate RPC match_semantic_cache_pgvector returning a hit
    mock_rpc.execute.return_value = MagicMock(
        data=[
            {
                "cache_id": "cache-uuid-1111",
                "query_text": "What is agroforestry?",
                "response_text": "Cached agroforestry response from pgvector.",
                "sources": [{"title": "Cached Paper"}],
                "similarity": 0.992,
            }
        ]
    )

    mock_embed = MagicMock()
    mock_embed.encode.return_value = [[0.1] * 768]

    status_updates = []
    run_rag_query(
        query_id="query-pgvector-test",
        user_query="What is agroforestry?",
        supabase=mock_supabase,
        embed_model=mock_embed,
        call_llm=MagicMock(),
        provider_getter=lambda: "mistral",
        status_writer=lambda s: status_updates.append(s),
    )

    # Must verify RPC was called with disambiguated parameter names
    rpc_calls = [c for c in mock_supabase.rpc.call_args_list if c.args and c.args[0] == "match_semantic_cache_pgvector"]
    assert len(rpc_calls) > 0
    rpc_args = rpc_calls[0].args[1]
    assert "p_query_embedding" in rpc_args
    assert "p_match_threshold" in rpc_args
    assert "p_filter_topic" in rpc_args

    # Status must be completed with cached response
    last_status = status_updates[-1]
    assert last_status["status"] == "completed"
    assert last_status["response"] == "Cached agroforestry response from pgvector."
    assert last_status["cache_hit"] is True


def test_litellm_gateway_provider_call():
    mock_litellm = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "Answer generated via LiteLLM gateway."
    mock_resp = MagicMock(choices=[mock_choice])
    mock_resp.usage.prompt_tokens = 45
    mock_resp.usage.completion_tokens = 22
    mock_resp.usage.total_tokens = 67
    mock_litellm.completion.return_value = mock_resp

    with patch.dict("sys.modules", {"litellm": mock_litellm}):
        call_llm = build_llm_caller(provider_getter=lambda: "litellm")
        res = call_llm(prompt="What is agroforestry?", agent_type="synthesis")

        assert res["text"] == "Answer generated via LiteLLM gateway."
        assert res["tokens"] == 67
        assert res["prompt_tokens"] == 45
        assert res["completion_tokens"] == 22
        mock_litellm.completion.assert_called_once()


def test_langfuse_tracing_noops_safely_when_unconfigured():
    # Should not throw any exception when LANGFUSE keys are not present
    with patch.dict(os.environ, {}, clear=True):
        assert get_langfuse_client() is None
        trace_generation_with_langfuse(
            name="test_span",
            model="mistral-small",
            prompt="Hello",
            output="World",
            tokens=10,
            input_tokens=5,
            output_tokens=5,
        )
