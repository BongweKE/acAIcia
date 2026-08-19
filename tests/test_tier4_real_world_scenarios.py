import unittest
from fastapi.testclient import TestClient
from tests.mock_server import create_mock_app

class TestTier4RealWorldScenarios(unittest.TestCase):
    """
    Tier 4: Real-World Application Scenarios (End-to-End Researcher Journeys)
    Validates complete multi-step researcher workflows from login to feedback and observability.
    """

    @classmethod
    def setUpClass(cls):
        cls.app = create_mock_app()
        cls.client = TestClient(cls.app)

    def setUp(self):
        self.client.post("/test/reset")

    def test_scenario_01_end_to_end_researcher_workflow(self):
        """
        Scenario 1: Complete End-to-End Researcher Workflow
        1. Login -> 2. Set Custom Instructions -> 3. Change LLM Provider ->
        4. Submit Query -> 5. Poll Status -> 6. Inspect Citations & DOIs ->
        7. Submit Feedback -> 8. Verify Admin Metrics Telemetry
        """
        # Step 1: Researcher Login
        login_res = self.client.post("/auth/login", json={
            "email": "b.obaga@landscapealliance.org",
            "password": "admin_secure_pass"
        })
        self.assertEqual(login_res.status_code, 200)
        user_info = login_res.json()["user"]
        user_id = user_info["user_id"]
        self.assertEqual(user_info["role"], "admin")

        # Step 2: Configure Custom Research Instructions
        custom_inst = "Emphasize quantitative carbon stock measurements in West African agroforestry."
        profile_res = self.client.post("/user/settings", json={
            "user_id": user_id,
            "custom_instructions": custom_inst
        })
        self.assertEqual(profile_res.status_code, 200)

        # Step 3: Change LLM Provider to Gemini 2.5
        settings_res = self.client.post("/settings?is_guest=false", json={"llm_provider": "gemini"})
        self.assertEqual(settings_res.status_code, 200)
        self.assertEqual(settings_res.json()["llm_provider"], "gemini")

        # Step 4: Submit Research Query
        query_text = "What percentage of Ghana anthropogenic GHG emissions come from food systems?"
        init_res = self.client.post("/query", json={
            "query": query_text,
            "user_id": user_id,
            "session_id": "sess-real-world-01"
        })
        self.assertEqual(init_res.status_code, 200)
        q_id = init_res.json()["query_id"]

        # Step 5: Poll Query Status until Completed
        status_res = self.client.get(f"/query/status/{q_id}")
        self.assertEqual(status_res.status_code, 200)
        q_data = status_res.json()
        self.assertEqual(q_data["status"], "completed")

        # Step 6: Inspect Response & Citations Formatting
        response_text = q_data["response"]
        sources = q_data["sources"]
        self.assertIn("West African agroforestry", response_text)  # Custom instruction injected
        self.assertRegex(response_text, r"\[[A-Za-z\s&]+,\s*\d{4}\]")  # Inline citation present
        self.assertGreater(len(sources), 0)
        self.assertTrue(sources[0]["doi"].startswith("10.17528/"))  # Valid DOI present

        # Step 7: Submit Downvote Feedback with Correction Text
        fb_res = self.client.post("/feedback", json={
            "log_id": q_id,
            "user_id": user_id,
            "rating": -1,
            "correction_text": "Please provide more regional breakdown details."
        })
        self.assertEqual(fb_res.status_code, 200)

        # Step 8: Verify Admin Metrics Observability Dashboard
        metrics_res = self.client.get("/admin/metrics?user_role=admin")
        self.assertEqual(metrics_res.status_code, 200)
        m_data = metrics_res.json()
        self.assertEqual(m_data["total_queries"], 1)
        self.assertEqual(m_data["user_feedback"]["downvotes"], 1)
        self.assertGreater(m_data["stage_latency_averages"]["synthesis_ms"], 0)

    def test_scenario_02_guest_to_authenticated_upgrade(self):
        """
        Scenario 2: Guest-to-Authenticated Upgrade Journey
        Guest query limit warning -> Sign in -> Seamless query submission
        """
        guest_session = "guest-upgrade-journey"
        # Exhaust 20 guest queries
        for i in range(20):
            self.client.post("/query?is_authenticated=false", json={"query": f"Guest Query {i}", "session_id": guest_session})

        # 21st query fails
        fail_res = self.client.post("/query?is_authenticated=false", json={"query": "Guest Query 21", "session_id": guest_session})
        self.assertEqual(fail_res.status_code, 429)

        # User Signs In
        login_res = self.client.post("/auth/login", json={"email": "researcher@cifor-icraf.org", "password": "valid_password"})
        self.assertEqual(login_res.status_code, 200)

        # Query succeeds without limit
        succ_res = self.client.post("/query?is_authenticated=true", json={"query": "Guest Query 21", "session_id": guest_session})
        self.assertEqual(succ_res.status_code, 200)

    def test_scenario_03_semantic_cache_hit_workflow(self):
        """
        Scenario 3: Fast Semantic Response Caching Journey
        First run computes full pipeline -> Second run triggers instant cache hit (<50ms)
        """
        q = "How do shade-grown coffee systems impact soil organic carbon?"

        # First run: Cache Miss
        r1 = self.client.post("/query", json={"query": q})
        q_id1 = r1.json()["query_id"]
        s1 = self.client.get(f"/query/status/{q_id1}").json()
        self.assertEqual(s1["cache_hit"], False)

        # Second run: Cache Hit
        r2 = self.client.post("/query", json={"query": q})
        q_id2 = r2.json()["query_id"]
        s2 = self.client.get(f"/query/status/{q_id2}").json()
        self.assertEqual(s2["cache_hit"], True)
        self.assertIn("Fast Cache Hit", s2["response"])

        # Check Admin Metrics reflects cache hit rate
        metrics = self.client.get("/admin/metrics").json()
        self.assertEqual(metrics["total_queries"], 2)
        self.assertEqual(metrics["cache_hit_rate_pct"], 50.0)

    def test_scenario_04_guardian_domain_guardrail_rejection(self):
        """
        Scenario 4: Guardian Domain Guardrail Rejection Journey
        Off-topic query -> Guardian intercepts & rejects -> Polite message & telemetry logged
        """
        bad_query = "Give me a commercial code recipe for entertainment app."
        r = self.client.post("/query", json={"query": bad_query})
        q_id = r.json()["query_id"]

        status = self.client.get(f"/query/status/{q_id}").json()
        self.assertEqual(status["guardian_passed"], False)
        self.assertIn("only assist with queries related to forestry", status["response"])

        metrics = self.client.get("/admin/metrics").json()
        self.assertEqual(metrics["guardian_pass_rate_pct"], 0.0)

if __name__ == "__main__":
    unittest.main()
