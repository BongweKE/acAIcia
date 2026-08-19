import unittest
import os
from fastapi.testclient import TestClient
from tests.mock_server import create_mock_app

class TestTier1FeatureCoverage(unittest.TestCase):
    """
    Tier 1: Feature Coverage (Happy Path Validation)
    Requirements: >= 5 test cases per feature across 6 features (Auth, Chat, Settings, Feedback, Admin, Info views) = 30 tests total.
    """

    @classmethod
    def setUpClass(cls):
        cls.app = create_mock_app()
        cls.client = TestClient(cls.app)

    def setUp(self):
        self.client.post("/test/reset")

    # =========================================================================
    # FEATURE 1: AUTH & USER SESSIONS (5 Tests)
    # =========================================================================
    def test_f1_01_guest_session_initialization(self):
        """Verify guest user session initializes with default settings."""
        response = self.client.get("/settings")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["llm_provider"], "modal")

    def test_f1_02_researcher_login_success(self):
        """Verify valid researcher credentials return success status and researcher role."""
        payload = {"email": "researcher@cifor-icraf.org", "password": "valid_password_123"}
        response = self.client.post("/auth/login", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["user"]["role"], "researcher")

    def test_f1_03_admin_login_success(self):
        """Verify login with site admin email returns admin role."""
        payload = {"email": "b.obaga@landscapealliance.org", "password": "admin_secure_pass"}
        response = self.client.post("/auth/login", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["user"]["role"], "admin")

    def test_f1_04_user_logout_resets_session(self):
        """Verify state reset restores default guest settings."""
        # Update settings as user
        self.client.post("/settings", json={"llm_provider": "gemini"})
        # Reset (simulate logout)
        self.client.post("/test/reset")
        res = self.client.get("/settings")
        self.assertEqual(res.json()["llm_provider"], "modal")

    def test_f1_05_session_identity_persistence(self):
        """Verify user identity profiles persist under user_id key."""
        profile_data = {"user_id": "usr-101", "email": "dr.smith@cifor.org", "full_name": "Dr. Smith"}
        self.client.post("/user/settings", json=profile_data)
        res = self.client.get("/user/settings?user_id=usr-101")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["full_name"], "Dr. Smith")

    # =========================================================================
    # FEATURE 2: RAG CHAT INTERFACE (5 Tests)
    # =========================================================================
    def test_f2_01_get_prompt_pills(self):
        """Verify prompt pills endpoint returns sample scientific research topics."""
        response = self.client.get("/prompt_pills")
        self.assertEqual(response.status_code, 200)
        pills = response.json().get("pills", [])
        self.assertGreaterEqual(len(pills), 4)
        self.assertIn("Ghana", pills[0])

    def test_f2_02_submit_query_processing_status(self):
        """Verify POST /query initializes processing status and returns query_id."""
        payload = {"query": "What are agroforestry solutions in Kenya?", "session_id": "sess-1"}
        response = self.client.post("/query", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("query_id", data)
        self.assertEqual(data["status"], "processing")

    def test_f2_03_poll_query_status_completion(self):
        """Verify polling query status transitions to completed with response text."""
        init_res = self.client.post("/query", json={"query": "Explain peatland hydrology."})
        q_id = init_res.json()["query_id"]
        status_res = self.client.get(f"/query/status/{q_id}")
        self.assertEqual(status_res.status_code, 200)
        s_data = status_res.json()
        self.assertEqual(s_data["status"], "completed")
        self.assertIn("peatland", s_data["response"].lower())

    def test_f2_04_query_response_inline_citations(self):
        """Verify completed query response includes [Author, Year] scientific citations."""
        init_res = self.client.post("/query", json={"query": "Food system emissions in Ghana"})
        q_id = init_res.json()["query_id"]
        s_data = self.client.get(f"/query/status/{q_id}").json()
        self.assertRegex(s_data["response"], r"\[[A-Za-z\s&]+,\s*\d{4}\]")

    def test_f2_05_query_response_source_chunks(self):
        """Verify completed query status returns source chunk card metadata with DOIs."""
        init_res = self.client.post("/query", json={"query": "Soil organic carbon sequestration"})
        q_id = init_res.json()["query_id"]
        s_data = self.client.get(f"/query/status/{q_id}").json()
        sources = s_data.get("sources", [])
        self.assertGreater(len(sources), 0)
        self.assertIn("doi", sources[0])
        self.assertTrue(sources[0]["doi"].startswith("10.17528/"))

    # =========================================================================
    # FEATURE 3: SETTINGS & CUSTOMIZATION (5 Tests)
    # =========================================================================
    def test_f3_01_get_global_settings(self):
        """Verify GET /settings returns provider status and API key flags."""
        response = self.client.get("/settings")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("llm_provider", data)
        self.assertTrue(data["google_api_key_configured"])

    def test_f3_02_update_global_settings_authenticated(self):
        """Verify POST /settings updates global LLM provider."""
        response = self.client.post("/settings", json={"llm_provider": "gemini"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["llm_provider"], "gemini")

    def test_f3_03_get_user_profile_settings(self):
        """Verify GET /user/settings returns profile for given user_id."""
        response = self.client.get("/user/settings?user_id=test-user")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user_id"], "test-user")

    def test_f3_04_update_user_custom_instructions(self):
        """Verify POST /user/settings saves user custom instructions."""
        payload = {"user_id": "usr-202", "custom_instructions": "Focus on East Africa policy briefs."}
        response = self.client.post("/user/settings", json=payload)
        self.assertEqual(response.status_code, 200)
        profile = response.json()["profile"]
        self.assertEqual(profile["custom_instructions"], "Focus on East Africa policy briefs.")

    def test_f3_05_user_profile_default_fallback(self):
        """Verify GET /user/settings for new user_id returns Guest Researcher default."""
        response = self.client.get("/user/settings?user_id=new-unseen-id")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["full_name"], "Guest Researcher")

    # =========================================================================
    # FEATURE 4: INTERACTIVE FEEDBACK (5 Tests)
    # =========================================================================
    def test_f4_01_submit_positive_feedback(self):
        """Verify submitting positive rating (+1) returns success status."""
        payload = {"log_id": "log-001", "rating": 1}
        response = self.client.post("/feedback", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "success")

    def test_f4_02_submit_negative_feedback(self):
        """Verify submitting negative rating (-1) returns success status."""
        payload = {"log_id": "log-002", "rating": -1}
        response = self.client.post("/feedback", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "success")

    def test_f4_03_submit_feedback_with_correction_text(self):
        """Verify submitting feedback with text correction saves text."""
        payload = {"log_id": "log-003", "rating": -1, "correction_text": "Missing 2026 citation."}
        response = self.client.post("/feedback", json=payload)
        self.assertEqual(response.status_code, 200)
        metrics = self.client.get("/admin/metrics").json()
        self.assertGreater(metrics["user_feedback"]["downvotes"], 0)

    def test_f4_04_submit_feedback_anonymous(self):
        """Verify submitting feedback without user_id succeeds."""
        payload = {"log_id": "log-004", "rating": 1}
        response = self.client.post("/feedback", json=payload)
        self.assertEqual(response.status_code, 200)

    def test_f4_05_submit_feedback_authenticated(self):
        """Verify submitting feedback with explicit user_id succeeds."""
        payload = {"log_id": "log-005", "user_id": "user-789", "rating": 1}
        response = self.client.post("/feedback", json=payload)
        self.assertEqual(response.status_code, 200)

    # =========================================================================
    # FEATURE 5: ADMIN OBSERVABILITY DASHBOARD (5 Tests)
    # =========================================================================
    def test_f5_01_get_admin_metrics_structure(self):
        """Verify GET /admin/metrics returns full observational metrics payload."""
        response = self.client.get("/admin/metrics")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total_queries", data)
        self.assertIn("cache_hit_rate_pct", data)
        self.assertIn("p50_latency_ms", data)
        self.assertIn("p95_latency_ms", data)

    def test_f5_02_admin_metrics_stage_latencies(self):
        """Verify stage latency averages breakdown contains all 4 multi-agent stages."""
        data = self.client.get("/admin/metrics").json()
        stages = data.get("stage_latency_averages", {})
        self.assertIn("guardian_ms", stages)
        self.assertIn("architect_ms", stages)
        self.assertIn("retrieval_ms", stages)
        self.assertIn("synthesis_ms", stages)

    def test_f5_03_admin_metrics_user_feedback_totals(self):
        """Verify user_feedback metrics report upvotes, downvotes, and satisfaction %."""
        data = self.client.get("/admin/metrics").json()
        fb = data.get("user_feedback", {})
        self.assertIn("upvotes", fb)
        self.assertIn("downvotes", fb)
        self.assertIn("satisfaction_pct", fb)

    def test_f5_04_admin_metrics_recent_evaluations(self):
        """Verify recent evaluations return array of benchmark evaluation runs."""
        data = self.client.get("/admin/metrics").json()
        evals = data.get("recent_evaluations", [])
        self.assertIsInstance(evals, list)
        self.assertGreater(len(evals), 0)

    def test_f5_05_admin_metrics_cache_hit_rate_bounds(self):
        """Verify cache_hit_rate_pct is within numeric range [0, 100]."""
        data = self.client.get("/admin/metrics").json()
        rate = data.get("cache_hit_rate_pct", -1)
        self.assertGreaterEqual(rate, 0.0)
        self.assertLessEqual(rate, 100.0)

    # =========================================================================
    # FEATURE 6: INFORMATIONAL VIEWS & NAVIGATION (5 Tests)
    # =========================================================================
    def test_f6_01_info_about_content(self):
        """Verify GET /info/about returns About acAIcia section content."""
        response = self.client.get("/info/about")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Landscape Alliance", response.json()["content_markdown"])

    def test_f6_02_info_faqs_content(self):
        """Verify GET /info/faqs returns FAQ questions and answers."""
        response = self.client.get("/info/faqs")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Frequently Asked Questions", response.json()["content_markdown"])

    def test_f6_03_info_blogs_publications_content(self):
        """Verify GET /info/blogs returns featured research publication papers."""
        response = self.client.get("/info/blogs")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Ghana", response.json()["content_markdown"])

    def test_f6_04_info_contact_content(self):
        """Verify GET /info/contact returns research contact email."""
        response = self.client.get("/info/contact")
        self.assertEqual(response.status_code, 200)
        self.assertIn("info@acaicia.org", response.json()["content_markdown"])

    def test_f6_05_info_view_markdown_formatting(self):
        """Verify info views content contains standard Markdown headers."""
        response = self.client.get("/info/about")
        markdown = response.json()["content_markdown"]
        self.assertTrue(markdown.startswith("# "))

if __name__ == "__main__":
    unittest.main()
