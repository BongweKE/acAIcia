import json
import os
import time
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from backend.core import (
    DEFAULT_MISTRAL_TIMEOUT_MS,
    build_llm_caller,
    build_llm_stream_caller,
    get_mistral_client,
)
from backend.evaluation_engine import EVAL_CONFIG
from backend.server import app


class TestStreamTimeoutAndKeepalive(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    # ─────────────────────────────────────────────────────────────────────────
    # 1. Mistral Client & Timeout Configuration
    # ─────────────────────────────────────────────────────────────────────────
    def test_get_mistral_client_default_timeout(self):
        with patch.dict(os.environ, {"MISTRAL_API_KEY": "test-key-timeout"}):
            with patch("mistralai.client.Mistral") as mock_mistral:
                get_mistral_client()
                mock_mistral.assert_called_once_with(
                    api_key="test-key-timeout", timeout_ms=DEFAULT_MISTRAL_TIMEOUT_MS
                )
                self.assertGreaterEqual(DEFAULT_MISTRAL_TIMEOUT_MS, 180000)

    def test_get_mistral_client_custom_timeout_param(self):
        with patch.dict(os.environ, {"MISTRAL_API_KEY": "test-key-timeout"}):
            with patch("mistralai.client.Mistral") as mock_mistral:
                get_mistral_client(timeout_ms=240000)
                mock_mistral.assert_called_once_with(
                    api_key="test-key-timeout", timeout_ms=240000
                )

    def test_call_llm_passes_timeout_and_handles_timeout_fallback(self):
        mock_client = MagicMock()
        timeout_err = Exception("HTTP connection timed out after 210000ms")

        mock_fallback_choice = MagicMock()
        mock_fallback_choice.message.content = "PASS"
        mock_fallback_usage = MagicMock()
        mock_fallback_usage.prompt_tokens = 25
        mock_fallback_usage.completion_tokens = 5
        mock_fallback_usage.total_tokens = 30
        mock_fallback_res = MagicMock()
        mock_fallback_res.choices = [mock_fallback_choice]
        mock_fallback_res.usage = mock_fallback_usage

        # First call raises timeout error, second call (fallback) succeeds
        mock_client.chat.complete.side_effect = [timeout_err, mock_fallback_res]

        with patch("backend.core.get_mistral_client", return_value=mock_client):
            caller = build_llm_caller(lambda: "mistral")
            res = caller("Test prompt", "guardian")

            self.assertEqual(res["text"], "PASS")
            self.assertEqual(mock_client.chat.complete.call_count, 2)
            # Verify timeout_ms was passed to both calls
            for call_args in mock_client.chat.complete.call_args_list:
                self.assertEqual(call_args.kwargs.get("timeout_ms"), DEFAULT_MISTRAL_TIMEOUT_MS)

    def test_call_llm_stream_passes_timeout_and_handles_timeout_fallback(self):
        mock_client = MagicMock()
        timeout_err = Exception("Read timeout occurred while connecting")

        mock_chunk = MagicMock()
        mock_chunk.data.choices = [MagicMock()]
        mock_chunk.data.choices[0].delta.content = "Recovered token"
        mock_chunk.data.usage = None

        # First call raises timeout error, second call (fallback) succeeds
        mock_client.chat.stream.side_effect = [timeout_err, [mock_chunk]]

        with patch("backend.core.get_mistral_client", return_value=mock_client):
            stream_caller = build_llm_stream_caller(lambda: "mistral")
            chunks = list(stream_caller("Test prompt", "synthesis"))

            self.assertIn("Recovered token", chunks)
            self.assertEqual(mock_client.chat.stream.call_count, 2)
            for call_args in mock_client.chat.stream.call_args_list:
                self.assertEqual(call_args.kwargs.get("timeout_ms"), DEFAULT_MISTRAL_TIMEOUT_MS)

    def test_call_llm_stream_handles_stream_iteration_timeout_fallback(self):
        mock_client = MagicMock()

        def failing_iter():
            raise Exception("Read timeout during chunk transfer")
            yield  # pragma: no cover

        mock_fallback_chunk = MagicMock()
        mock_fallback_chunk.data.choices = [MagicMock()]
        mock_fallback_chunk.data.choices[0].delta.content = "Chunk after iter failure"
        mock_fallback_chunk.data.usage = None

        mock_client.chat.stream.side_effect = [failing_iter(), [mock_fallback_chunk]]

        with patch("backend.core.get_mistral_client", return_value=mock_client):
            stream_caller = build_llm_stream_caller(lambda: "mistral")
            chunks = list(stream_caller("Test prompt", "synthesis"))

            self.assertIn("Chunk after iter failure", chunks)
            self.assertEqual(mock_client.chat.stream.call_count, 2)

    # ─────────────────────────────────────────────────────────────────────────
    # 2. SSE Keepalive Heartbeat & Initial Ping
    # ─────────────────────────────────────────────────────────────────────────
    @patch("backend.server.run_rag_query_stream")
    @patch("backend.server.get_cached_embed_model")
    def test_stream_emits_initial_ping_and_events(self, mock_embed, mock_stream):
        mock_embed.return_value = MagicMock()

        def dummy_events(*args, **kwargs):
            yield {"type": "stage", "stage": "Guardian Check"}
            yield {"type": "token", "text": "Synthesized insight"}
            yield {"type": "done", "query_id": "test-done-id"}

        mock_stream.side_effect = dummy_events

        res = self.client.post("/query/stream", json={"query": "Agroforestry in Kenya"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "text/event-stream; charset=utf-8")
        # Verify initial ping is emitted immediately
        self.assertIn(": ping\n\n", res.text)
        # Verify data events are emitted
        self.assertIn("data: ", res.text)
        self.assertIn('"stage": "Guardian Check"', res.text)
        self.assertIn('"text": "Synthesized insight"', res.text)
        self.assertIn('"type": "done"', res.text)

    @patch("backend.server.STREAM_KEEPALIVE_INTERVAL_SEC", 0.05)
    @patch("backend.server.run_rag_query_stream")
    @patch("backend.server.get_cached_embed_model")
    def test_stream_emits_keepalive_comments_during_quiet_periods(
        self, mock_embed, mock_stream
    ):
        mock_embed.return_value = MagicMock()

        def slow_events(*args, **kwargs):
            yield {"type": "stage", "stage": "Guardian Check"}
            # Simulate a quiet pause longer than STREAM_KEEPALIVE_INTERVAL_SEC (0.05s)
            time.sleep(0.12)
            yield {"type": "token", "text": "After quiet"}
            yield {"type": "done", "query_id": "slow-done-id"}

        mock_stream.side_effect = slow_events

        res = self.client.post("/query/stream", json={"query": "Peatland depths"})
        self.assertEqual(res.status_code, 200)
        # Verify keepalive comment was emitted
        self.assertIn(": keepalive\n\n", res.text)
        self.assertIn('"text": "After quiet"', res.text)

    @patch("backend.server.MAX_STREAM_TIMEOUT_SEC", 0.08)
    @patch("backend.server.STREAM_KEEPALIVE_INTERVAL_SEC", 0.03)
    @patch("backend.server.STORE")
    @patch("backend.server.run_rag_query_stream")
    @patch("backend.server.get_cached_embed_model")
    def test_stream_times_out_and_writes_failed_status_when_exceeding_max_stream_timeout(
        self, mock_embed, mock_stream, mock_store
    ):
        mock_embed.return_value = MagicMock()

        def hanging_worker(*args, **kwargs):
            time.sleep(0.2)
            yield {"type": "token", "text": "Too late"}

        mock_stream.side_effect = hanging_worker

        res = self.client.post("/query/stream", json={"query": "Hanging query"})
        self.assertEqual(res.status_code, 200)
        self.assertIn(": keepalive\n\n", res.text)
        self.assertIn('"type": "error"', res.text)
        self.assertIn("Stream processing timed out", res.text)
        # Verify failure status was written to STORE
        mock_store.write_status.assert_called()
        last_call_args = mock_store.write_status.call_args[0]
        self.assertEqual(last_call_args[1].get("status"), "failed")
        self.assertIn("Stream processing timed out", last_call_args[1].get("error", ""))

    @patch("backend.server.STORE")
    @patch("backend.server.run_rag_query_stream")
    @patch("backend.server.get_cached_embed_model")
    def test_stream_handles_worker_exception_gracefully(self, mock_embed, mock_stream, mock_store):
        mock_embed.return_value = MagicMock()

        def faulty_events(*args, **kwargs):
            yield {"type": "stage", "stage": "Guardian Check"}
            raise RuntimeError("Database connection suddenly dropped")

        mock_stream.side_effect = faulty_events

        res = self.client.post("/query/stream", json={"query": "Soil salinity"})
        self.assertEqual(res.status_code, 200)
        self.assertIn(": ping\n\n", res.text)
        self.assertIn('"type": "error"', res.text)
        self.assertIn("Database connection suddenly dropped", res.text)
        mock_store.write_status.assert_called()

    # ─────────────────────────────────────────────────────────────────────────
    # 3. Evaluation Engine Timeout
    # ─────────────────────────────────────────────────────────────────────────
    def test_evaluation_engine_backend_timeout_is_at_least_240s(self):
        self.assertGreaterEqual(EVAL_CONFIG["backend_timeout_sec"], 240)
