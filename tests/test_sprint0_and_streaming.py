import json
import os
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from backend.config import COST_PER_1M_TOKENS
from backend.core import build_llm_caller, build_llm_stream_caller, estimate_query_cost
from backend.pipeline import run_rag_query, run_rag_query_stream

os.environ.setdefault("SUPABASE_URL", "https://mock.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "mock-key-for-testing")

from backend.server import app


class TestSprint0AndStreaming(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        os.environ["ADMIN_API_KEY"] = "test_admin_secret_key_12345"

    def tearDown(self):
        os.environ.pop("ADMIN_API_KEY", None)

    # ─────────────────────────────────────────────────────────────────────────
    # Issue #14: Admin CSV Export 401 Fix (Query Parameter Auth)
    # ─────────────────────────────────────────────────────────────────────────
    @patch("backend.server.supabase")
    def test_admin_csv_export_query_param_auth_success(self, mock_sb):
        mock_data = [
            {
                "log_id": "test-log-1",
                "timestamp": "2026-09-29T00:00:00Z",
                "session_id": "sess-1",
                "original_query": "soil test",
                "guardian_passed": True,
                "topic_category": "soil_science",
                "provider_used": "mistral",
                "synthesis_source": "internal_corpus",
                "total_tokens_used": 150,
                "estimated_cost_usd": 0.0002,
                "latency_ms": 1200,
                "cache_hit": False,
                "search_mode": "hybrid",
            }
        ]
        mock_sb.table().select().gte().lte().order().limit().execute.return_value.data = mock_data

        # 1. Test via query param: ?authorization=Bearer <KEY>
        res = self.client.get(
            "/admin/export/csv?authorization=Bearer test_admin_secret_key_12345"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "text/csv; charset=utf-8")
        self.assertIn("soil test", res.text)
        self.assertIn("test-log-1", res.text)

        # 2. Test via query param: ?token=Bearer <KEY>
        res2 = self.client.get("/admin/export/csv?token=Bearer test_admin_secret_key_12345")
        self.assertEqual(res2.status_code, 200)

        # 3. Test via query param with raw token (no 'Bearer ' prefix)
        res_raw1 = self.client.get("/admin/export/csv?token=test_admin_secret_key_12345")
        self.assertEqual(res_raw1.status_code, 200)
        res_raw2 = self.client.get("/admin/export/csv?authorization=test_admin_secret_key_12345")
        self.assertEqual(res_raw2.status_code, 200)

        # 4. Test via standard Authorization header
        res3 = self.client.get(
            "/admin/export/csv",
            headers={"Authorization": "Bearer test_admin_secret_key_12345"},
        )
        self.assertEqual(res3.status_code, 200)

    def test_admin_csv_export_unauthorized(self):
        # 1. No token provided
        res = self.client.get("/admin/export/csv")
        self.assertEqual(res.status_code, 401)

        # 2. Invalid token in query param
        res2 = self.client.get("/admin/export/csv?authorization=Bearer wrong_key")
        self.assertEqual(res2.status_code, 401)

        # 3. Invalid raw token in query param
        res3 = self.client.get("/admin/export/csv?token=wrong_key")
        self.assertEqual(res3.status_code, 401)


    # ─────────────────────────────────────────────────────────────────────────
    # Issue #15: Exact Token Usage Telemetry Refactor
    # ─────────────────────────────────────────────────────────────────────────
    def test_exact_token_telemetry_no_50_50_split(self):
        # Verify call_llm returns prompt_tokens and completion_tokens
        mock_client = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = "Synthesized research answer on agroforestry."
        mock_usage = MagicMock()
        mock_usage.prompt_tokens = 2400
        mock_usage.completion_tokens = 600
        mock_usage.total_tokens = 3000

        mock_res = MagicMock()
        mock_res.choices = [mock_choice]
        mock_res.usage = mock_usage
        mock_client.chat.complete.return_value = mock_res

        with patch("backend.core.get_mistral_client", return_value=mock_client):
            caller = build_llm_caller(lambda: "mistral")
            res = caller("Test prompt", "synthesis")

            self.assertEqual(res["text"], "Synthesized research answer on agroforestry.")
            self.assertEqual(res["tokens"], 3000)
            self.assertEqual(res["prompt_tokens"], 2400)
            self.assertEqual(res["completion_tokens"], 600)

        # Verify pipeline calculates exact input and output tokens
        mock_sb = MagicMock()
        mock_embed = MagicMock()
        mock_embed.encode.return_value = [[0.1] * 768]

        guard_out = {
            "text": "PASS",
            "tokens": 40,
            "prompt_tokens": 30,
            "completion_tokens": 10,
        }
        arch_out = {
            "text": "agroforestry soil carbon",
            "tokens": 80,
            "prompt_tokens": 60,
            "completion_tokens": 20,
        }
        synth_out = {
            "text": "Synthesized academic answer [Hoang et al., 2010].",
            "tokens": 2500,
            "prompt_tokens": 2000,
            "completion_tokens": 500,
        }

        def mock_llm_dispatch(prompt, agent_type, history=None):
            if agent_type == "guardian":
                return guard_out
            if agent_type == "architect":
                return arch_out
            return synth_out

        logged_telemetry = []

        def capture_insert(payload):
            logged_telemetry.append(payload)
            m = MagicMock()
            m.execute.return_value = MagicMock()
            return m

        mock_sb.table().insert.side_effect = capture_insert
        mock_sb.rpc().execute.return_value.data = [
            {
                "document_id": "doc-1",
                "title": "Agroforestry Paper",
                "authors": ["Hoang, T."],
                "publication_year": 2010,
                "doi": "10.1000/182",
                "chunk_text": "Agroforestry systems increase soil carbon.",
                "similarity": 0.88,
            }
        ]

        run_rag_query(
            query_id="telemetry-exact-test",
            user_query="How does agroforestry affect soil carbon?",
            supabase=mock_sb,
            embed_model=mock_embed,
            call_llm=mock_llm_dispatch,
            provider_getter=lambda: "mistral",
            status_writer=lambda s: None,
            conversation_history=[{"role": "user", "content": "prior"}],
        )

        self.assertTrue(len(logged_telemetry) >= 1)
        telem = logged_telemetry[0]
        # Exact input = 30 (guard) + 60 (arch) + 2000 (synth) = 2090
        # Exact output = 10 (guard) + 20 (arch) + 500 (synth) = 530
        self.assertEqual(telem["input_tokens"], 2090)
        self.assertEqual(telem["output_tokens"], 530)
        self.assertEqual(telem["total_tokens_used"], 2620)

        # Expected cost = (2090/1M * 0.15) + (530/1M * 0.60) = 0.0003135 + 0.000318 = 0.0006315
        expected_cost = round((2090 * 0.15 + 530 * 0.60) / 1_000_000, 6)
        self.assertAlmostEqual(telem["estimated_cost_usd"], expected_cost, places=6)

    # ─────────────────────────────────────────────────────────────────────────
    # Issue #16: Eval Worker Failure State Handling
    # ─────────────────────────────────────────────────────────────────────────
    def test_evaluation_worker_failure_state_handling(self):
        from backend.server import _run_evaluation_job

        with patch("backend.server.supabase") as mock_sb:
            mock_table = MagicMock()
            mock_sb.table.return_value = mock_table

            # Force evaluation engine import or instantiation to raise an exception
            with patch("backend.evaluation_engine.EvaluationEngine", side_effect=RuntimeError("Supabase connection timeout")):
                _run_evaluation_job("test-eval-run-uuid", "test_questions.csv", 5, "full")

            # Verify that supabase evaluation_runs update was called with status = 'failed'
            mock_sb.table.assert_called_with("evaluation_runs")
            mock_table.update.assert_called()
            call_args = mock_table.update.call_args[0][0]
            self.assertEqual(call_args.get("status"), "failed")
            self.assertIn("Supabase connection timeout", call_args.get("details", {}).get("error", ""))

    # ─────────────────────────────────────────────────────────────────────────
    # Issue #17: Secure Legacy Rollback Target (backend/app.py)
    # ─────────────────────────────────────────────────────────────────────────
    def test_legacy_rollback_post_settings_auth(self):
        import backend.app as legacy_app

        with patch.dict(
            os.environ,
            {
                "SUPABASE_URL": "https://example.supabase.co",
                "SUPABASE_KEY": "fake_supabase_key",
                "ADMIN_API_KEY": "test_admin_secret_key_12345",
            },
        ):
            raw_app_fn = legacy_app.fastapi_app_entrypoint.get_raw_f()
            client = TestClient(raw_app_fn())

        # Without admin key -> 401
        res_unauth = client.post("/settings", json={"llm_provider": "gemini"})
        self.assertEqual(res_unauth.status_code, 401)

        # With wrong admin key -> 401
        res_wrong = client.post(
            "/settings",
            json={"llm_provider": "gemini"},
            headers={"Authorization": "Bearer invalid_key"},
        )
        self.assertEqual(res_wrong.status_code, 401)

        # With correct admin key
        with patch.object(legacy_app.vol, "reload"), patch.object(legacy_app.vol, "commit"), patch("builtins.open", unittest.mock.mock_open()):
            res_auth = client.post(
                "/settings",
                json={"llm_provider": "mistral"},
                headers={"Authorization": "Bearer test_admin_secret_key_12345"},
            )
            self.assertEqual(res_auth.status_code, 200)
            self.assertEqual(res_auth.json()["llm_provider"], "mistral")

    # ─────────────────────────────────────────────────────────────────────────
    # Issue #18: Point Dev Tooling to Railway by Default
    # ─────────────────────────────────────────────────────────────────────────
    def test_dev_tooling_points_to_railway_by_default(self):
        import cli_admin
        from tests import deepeval_suite

        # Clear env overrides to test defaults
        with patch.dict(os.environ, {}, clear=True):
            backend_url = cli_admin.get_backend_url()
            self.assertIn("acaicia-backend-production.up.railway.app", backend_url)
            self.assertNotIn("modal.run", backend_url)

        self.assertIn(
            "acaicia-backend-production.up.railway.app",
            deepeval_suite.ACAICIA_BACKEND_URL,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Issue #1: Streaming Responses (SSE)
    # ─────────────────────────────────────────────────────────────────────────
    def test_run_rag_query_stream_generator_events(self):
        mock_sb = MagicMock()
        mock_embed = MagicMock()
        mock_embed.encode.return_value = [[0.05] * 768]

        guard_res = {
            "text": "PASS",
            "tokens": 20,
            "prompt_tokens": 15,
            "completion_tokens": 5,
        }
        arch_res = {
            "text": "peatland fire carbon hydrology",
            "tokens": 30,
            "prompt_tokens": 20,
            "completion_tokens": 10,
        }

        def mock_call_llm(prompt, agent_type, history=None):
            if agent_type == "guardian":
                return guard_res
            return arch_res

        def mock_call_llm_stream(prompt, agent_type, history=None, usage_collector=None):
            tokens = ["Peatlands ", "store ", "immense ", "carbon."]
            for t in tokens:
                yield t
            if usage_collector is not None:
                usage_collector["prompt_tokens"] = 500
                usage_collector["completion_tokens"] = 100
                usage_collector["total_tokens"] = 600

        mock_sb.rpc().execute.return_value.data = [
            {
                "document_id": "peat-doc-1",
                "title": "Tropical Peatland Hydrology",
                "authors": ["Page, S.E.", "Rieley, J.O."],
                "publication_year": 2011,
                "doi": "10.1038/nature1000",
                "chunk_text": "Tropical peatlands store up to 70 Gt of carbon.",
                "similarity": 0.92,
            }
        ]

        events = list(
            run_rag_query_stream(
                query_id="stream-test-uuid",
                user_query="How much carbon do peatlands store?",
                supabase=mock_sb,
                embed_model=mock_embed,
                call_llm=mock_call_llm,
                call_llm_stream=mock_call_llm_stream,
                provider_getter=lambda: "mistral",
                conversation_history=[{"role": "user", "content": "hello"}],
            )
        )

        event_types = [e["type"] for e in events]
        self.assertIn("stage", event_types)
        self.assertIn("sources", event_types)
        self.assertIn("token", event_types)
        self.assertIn("done", event_types)

        # Check sources
        sources_events = [e for e in events if e["type"] == "sources"]
        self.assertTrue(len(sources_events) >= 1)
        self.assertEqual(sources_events[0]["sources"][0]["doi"], "10.1038/nature1000")

        # Check tokens
        token_texts = "".join([e["text"] for e in events if e["type"] == "token"])
        self.assertEqual(token_texts, "Peatlands store immense carbon.")

        # Check done event
        done_event = [e for e in events if e["type"] == "done"][0]
        self.assertEqual(done_event["query_id"], "stream-test-uuid")
        self.assertFalse(done_event["cache_hit"])
        self.assertEqual(done_event["telemetry"]["input_tokens"], 15 + 20 + 500)
        self.assertEqual(done_event["telemetry"]["output_tokens"], 5 + 10 + 100)

    @patch("backend.server.get_cached_embed_model")
    @patch("backend.server.run_rag_query_stream")
    def test_post_query_stream_endpoint(self, mock_stream, mock_get_embed):
        mock_get_embed.return_value = MagicMock()

        def dummy_events(*args, **kwargs):
            yield {"type": "stage", "stage": "Guardian Check"}
            yield {"type": "token", "text": "Hello"}
            yield {"type": "done", "query_id": "test-stream-id"}

        mock_stream.side_effect = dummy_events

        res = self.client.post("/query/stream", json={"query": "Test query stream"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "text/event-stream; charset=utf-8")
        self.assertIn("data: ", res.text)
        self.assertIn('"stage": "Guardian Check"', res.text)
        self.assertIn('"text": "Hello"', res.text)
        self.assertIn('"type": "done"', res.text)

    def test_guardian_failure_exact_telemetry_polling(self):
        mock_sb = MagicMock()
        mock_embed = MagicMock()
        mock_call_llm = MagicMock()
        mock_call_llm.side_effect = [
            # Guardian returns FAIL with token usage
            {
                "text": "FAIL",
                "tokens": 40,
                "prompt_tokens": 30,
                "completion_tokens": 10,
            },
            # Architect (won't be called, but provided)
            {"text": "query", "tokens": 10, "prompt_tokens": 8, "completion_tokens": 2},
        ]
        status_updates = []

        run_rag_query(
            query_id="guard-fail-uuid",
            user_query="How to hack a satellite?",
            supabase=mock_sb,
            embed_model=mock_embed,
            call_llm=mock_call_llm,
            provider_getter=lambda: "mistral",
            status_writer=lambda s: status_updates.append(s),
        )

        self.assertTrue(any(s.get("status") == "completed" for s in status_updates))
        # Verify Supabase query_interaction_logs recorded exact input/output tokens and cost
        inserted_telemetry = mock_sb.table("query_interaction_logs").insert.call_args[0][0]
        self.assertEqual(inserted_telemetry["input_tokens"], 30)
        self.assertEqual(inserted_telemetry["output_tokens"], 10)
        self.assertEqual(inserted_telemetry["total_tokens_used"], 40)
        self.assertFalse(inserted_telemetry["guardian_passed"])
        self.assertGreater(inserted_telemetry["estimated_cost_usd"], 0.0)

    def test_stream_client_disconnect_finally_telemetry(self):
        mock_sb = MagicMock()
        mock_embed = MagicMock()
        mock_embed.encode.return_value = [[0.1] * 768]
        mock_call_llm = MagicMock()
        mock_call_llm.side_effect = [
            {"text": "PASS", "tokens": 20, "prompt_tokens": 15, "completion_tokens": 5},
            {"text": "carbon peatlands", "tokens": 30, "prompt_tokens": 20, "completion_tokens": 10},
        ]

        def stream_tokens(*args, **kwargs):
            usage = args[3] if len(args) > 3 else kwargs.get("usage_collector")
            if usage is not None:
                usage["prompt_tokens"] = 500
                usage["completion_tokens"] = 100
                usage["total_tokens"] = 600
            yield "First chunk "
            yield "Second chunk "

        gen = run_rag_query_stream(
            query_id="abort-uuid",
            user_query="Peatland carbon stock",
            supabase=mock_sb,
            embed_model=mock_embed,
            call_llm=mock_call_llm,
            call_llm_stream=stream_tokens,
            provider_getter=lambda: "mistral",
        )

        # Consume until first token event
        for event in gen:
            if event["type"] == "token":
                break

        # Simulate client disconnect by closing generator
        gen.close()

        # Verify query_interaction_logs was inserted via finally: block despite GeneratorExit
        insert_calls = mock_sb.table("query_interaction_logs").insert.call_args_list
        self.assertTrue(len(insert_calls) >= 1)
        logged = insert_calls[-1][0][0]
        self.assertEqual(logged["log_id"], "abort-uuid")
        self.assertEqual(logged["input_tokens"], 15 + 20 + 500)
        self.assertEqual(logged["output_tokens"], 5 + 10 + 100)

    def test_stream_citation_tags_formatting(self):
        mock_sb = MagicMock()
        mock_embed = MagicMock()
        mock_embed.encode.return_value = [[0.1] * 768]
        mock_call_llm = MagicMock()
        mock_call_llm.side_effect = [
            {"text": "PASS", "tokens": 10, "prompt_tokens": 8, "completion_tokens": 2},
            {"text": "agroforestry soil", "tokens": 15, "prompt_tokens": 10, "completion_tokens": 5},
        ]
        # Mock retrieval returning docs
        mock_sb.rpc().execute.return_value.data = [
            {
                "document_id": "doc-1",
                "title": "Agroforestry Impact",
                "authors": ["Mwangi, J.", "Smith, A."],
                "publication_year": 2024,
                "url_link": "https://cifor-icraf.org/pub1",
                "doi": "10.1016/j.env.2024.01",
                "chunk_text": "Agroforestry improves soil organic carbon significantly.",
                "rrf_score": 0.033,
            }
        ]

        received_prompts = []

        def stream_tokens(prompt, *args, **kwargs):
            received_prompts.append(prompt)
            yield "Agroforestry improves soil carbon [Mwangi et al., 2024]."

        events = list(
            run_rag_query_stream(
                query_id="cite-test-uuid",
                user_query="How does agroforestry affect soil?",
                supabase=mock_sb,
                embed_model=mock_embed,
                call_llm=mock_call_llm,
                call_llm_stream=stream_tokens,
                provider_getter=lambda: "mistral",
            )
        )

        self.assertEqual(len(received_prompts), 1)
        synth_prompt = received_prompts[0]
        # Verify exact citation tag [Mwangi et al., 2024] is present in the prompt
        self.assertIn("[Mwangi et al., 2024]", synth_prompt)
        self.assertIn("MUST USE THIS EXACT CITATION TAG", synth_prompt)

        # Verify sources event
        sources_events = [e for e in events if e["type"] == "sources"]
        self.assertEqual(len(sources_events), 1)
        src = sources_events[0]["sources"][0]
        self.assertEqual(src["url"], "https://cifor-icraf.org/pub1")
        self.assertEqual(src["score"], 0.033)


if __name__ == "__main__":
    unittest.main()

