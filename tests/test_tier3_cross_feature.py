import unittest
from fastapi.testclient import TestClient
from tests.mock_server import create_mock_app

class TestTier3CrossFeature(unittest.TestCase):
    """
    Tier 3: Cross-Feature Combinations (Pairwise Feature Integration)
    Validates inter-module behavior, state propagation, and feature interactions.
    """

    @classmethod
    def setUpClass(cls):
        cls.app = create_mock_app()
        cls.client = TestClient(cls.app)

    def setUp(self):
        self.client.post("/test/reset")

    def test_t3_01_auth_and_settings_provider_unlock(self):
        """Cross-Feature: Auth + Settings -> Logging in as researcher unlocks non-guest LLM providers."""
        # 1. Guest attempt to switch provider to gemini fails with 403
        guest_res = self.client.post("/settings?is_guest=true", json={"llm_provider": "gemini"})
        self.assertEqual(guest_res.status_code, 403)

        # 2. Login as authenticated researcher
        login_res = self.client.post("/auth/login", json={"email": "researcher@cifor-icraf.org", "password": "valid_password"})
        self.assertEqual(login_res.status_code, 200)

        # 3. Authenticated researcher switches provider to gemini successfully
        auth_res = self.client.post("/settings?is_guest=false", json={"llm_provider": "gemini"})
        self.assertEqual(auth_res.status_code, 200)
        self.assertEqual(auth_res.json()["llm_provider"], "gemini")

    def test_t3_02_chat_feedback_admin_metrics_integration(self):
        """Cross-Feature: Chat + Feedback + Admin -> Submitting query, upvoting feedback, and observing admin metrics update."""
        # 1. Submit RAG query
        q_res = self.client.post("/query", json={"query": "Peatland organic carbon retention"})
        q_id = q_res.json()["query_id"]

        # 2. Submit upvote feedback for query
        fb_res = self.client.post("/feedback", json={"log_id": q_id, "rating": 1})
        self.assertEqual(fb_res.status_code, 200)

        # 3. Verify Admin metrics reflects updated query count and upvote count
        m_res = self.client.get("/admin/metrics")
        self.assertEqual(m_res.status_code, 200)
        m_data = m_res.json()
        self.assertEqual(m_data["total_queries"], 1)
        self.assertEqual(m_data["user_feedback"]["upvotes"], 1)
        self.assertEqual(m_data["user_feedback"]["satisfaction_pct"], 100.0)

    def test_t3_03_settings_custom_instructions_chat_synthesis_injection(self):
        """Cross-Feature: Settings + Chat -> Custom instructions set in settings are injected into Synthesis response."""
        user_id = "researcher-cross-user"
        custom_instructions = "Focus strictly on East African agroforestry policy recommendations."

        # 1. Set custom instructions in User Settings
        self.client.post("/user/settings", json={"user_id": user_id, "custom_instructions": custom_instructions})

        # 2. Submit query under this user_id
        q_res = self.client.post("/query", json={"query": "What agroforestry practices work in Kenya?", "user_id": user_id})
        q_id = q_res.json()["query_id"]

        # 3. Poll query completion and inspect response text for custom instructions injection
        status_res = self.client.get(f"/query/status/{q_id}").json()
        self.assertIn("Focus strictly on East African agroforestry", status_res["response"])

    def test_t3_04_guest_auth_chat_limit_restoration(self):
        """Cross-Feature: Guest Auth + Chat -> Exceeding guest limit blocks queries, logging in restores access."""
        sess_id = "guest-upgrade-session"

        # 1. Exhaust guest 20 query allowance
        for i in range(20):
            self.client.post("/query?is_authenticated=false", json={"query": f"Q{i}", "session_id": sess_id})

        # 2. 21st query fails as guest
        block_res = self.client.post("/query?is_authenticated=false", json={"query": "Q21", "session_id": sess_id})
        self.assertEqual(block_res.status_code, 429)

        # 3. Log in as researcher and submit query
        succ_res = self.client.post("/query?is_authenticated=true", json={"query": "Q21", "session_id": sess_id})
        self.assertEqual(succ_res.status_code, 200)

    def test_t3_05_admin_telemetry_multi_agent_stage_latencies(self):
        """Cross-Feature: Admin Telemetry + Multi-Agent -> Query execution populates multi-agent stage latencies."""
        # 1. Execute query
        self.client.post("/query", json={"query": "Forest fire management in Kalimantan"})

        # 2. Check Admin Metrics stage latency breakdown
        metrics = self.client.get("/admin/metrics").json()
        stages = metrics["stage_latency_averages"]
        self.assertGreater(stages["guardian_ms"], 0)
        self.assertGreater(stages["architect_ms"], 0)
        self.assertGreater(stages["retrieval_ms"], 0)
        self.assertGreater(stages["synthesis_ms"], 0)

    def test_t3_06_auth_admin_dashboard_rbac(self):
        """Cross-Feature: Auth + Admin Dashboard -> Role-Based Access Control filters unauthorized access."""
        # 1. Unauthorized role access is forbidden
        unauth_res = self.client.get("/admin/metrics?user_role=researcher")
        self.assertEqual(unauth_res.status_code, 403)

        # 2. Admin role access succeeds
        admin_res = self.client.get("/admin/metrics?user_role=admin")
        self.assertEqual(admin_res.status_code, 200)

if __name__ == "__main__":
    unittest.main()
