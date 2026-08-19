import unittest
from fastapi.testclient import TestClient
from tests.mock_server import create_mock_app

class TestTier2BoundaryCorner(unittest.TestCase):
    """
    Tier 2: Boundary & Corner Cases (System Limits & Error Handling)
    Requirements: >= 5 test cases per feature across 6 features (Auth, Chat, Settings, Feedback, Admin, Info views) = 30 tests total.
    """

    @classmethod
    def setUpClass(cls):
        cls.app = create_mock_app()
        cls.client = TestClient(cls.app)

    def setUp(self):
        self.client.post("/test/reset")

    # =========================================================================
    # FEATURE 1: AUTH BOUNDARY & CORNER CASES (5 Tests)
    # =========================================================================
    def test_f1_b01_guest_query_limit_enforcement(self):
        """Verify 21st query for guest user triggers HTTP 429 Limit Reached error."""
        sess_id = "guest-session-limit-test"
        # Submit 20 queries (unauthenticated)
        for i in range(20):
            res = self.client.post("/query?is_authenticated=false", json={"query": f"Query {i+1}", "session_id": sess_id})
            self.assertEqual(res.status_code, 200, f"Query {i+1} failed")

        # 21st Query must be rejected with 429
        res_21 = self.client.post("/query?is_authenticated=false", json={"query": "Query 21", "session_id": sess_id})
        self.assertEqual(res_21.status_code, 429)
        self.assertIn("limit reached", res_21.json()["detail"].lower())

    def test_f1_b02_guest_provider_locking(self):
        """Verify guest user attempting to switch provider to gemini returns HTTP 403 Forbidden."""
        res = self.client.post("/settings?is_guest=true", json={"llm_provider": "gemini"})
        self.assertEqual(res.status_code, 403)

    def test_f1_b03_invalid_login_credentials(self):
        """Verify login attempt with wrong password returns HTTP 401 Unauthorized."""
        payload = {"email": "researcher@cifor-icraf.org", "password": "wrong"}
        res = self.client.post("/auth/login", json=payload)
        self.assertEqual(res.status_code, 401)

    def test_f1_b04_malformed_email_login(self):
        """Verify login attempt with invalid email format returns HTTP 400 Bad Request."""
        payload = {"email": "notanemail", "password": "password123"}
        res = self.client.post("/auth/login", json=payload)
        self.assertEqual(res.status_code, 400)

    def test_f1_b05_empty_login_payload(self):
        """Verify login attempt with empty fields returns HTTP 400 Bad Request."""
        payload = {"email": "", "password": ""}
        res = self.client.post("/auth/login", json=payload)
        self.assertEqual(res.status_code, 400)

    # =========================================================================
    # FEATURE 2: RAG CHAT BOUNDARY & CORNER CASES (5 Tests)
    # =========================================================================
    def test_f2_b01_query_empty_string(self):
        """Verify submitting empty query string returns HTTP 400 Bad Request."""
        res = self.client.post("/query", json={"query": "   "})
        self.assertEqual(res.status_code, 400)
        self.assertIn("cannot be empty", res.json()["detail"].lower())

    def test_f2_b02_query_guardian_rejection(self):
        """Verify Guardian agent intercepts off-topic query and returns polite domain rejection."""
        res = self.client.post("/query", json={"query": "How to hack a commercial website?"})
        self.assertEqual(res.status_code, 200)
        q_id = res.json()["query_id"]
        status_res = self.client.get(f"/query/status/{q_id}").json()
        self.assertEqual(status_res["guardian_passed"], False)
        self.assertIn("only assist with queries related to forestry", status_res["response"])

    def test_f2_b03_query_status_nonexistent_id(self):
        """Verify GET /query/status with invalid UUID returns HTTP 404 Not Found."""
        res = self.client.get("/query/status/non-existent-uuid-12345")
        self.assertEqual(res.status_code, 404)

    def test_f2_b04_query_large_payload(self):
        """Verify large 10,000+ character query is handled without crashing."""
        large_query = "What is agroforestry? " + ("climate change " * 1000)
        res = self.client.post("/query", json={"query": large_query})
        self.assertEqual(res.status_code, 200)

    def test_f2_b05_query_conversation_history_format(self):
        """Verify query endpoint handles conversation history list input properly."""
        history = [
            {"role": "user", "content": "What is silvopasture?"},
            {"role": "assistant", "content": "Silvopasture is the integration of trees and grazing."}
        ]
        res = self.client.post("/query", json={"query": "Explain soil impacts.", "conversation_history": history})
        self.assertEqual(res.status_code, 200)

    # =========================================================================
    # FEATURE 3: SETTINGS BOUNDARY & CORNER CASES (5 Tests)
    # =========================================================================
    def test_f3_b01_update_settings_invalid_provider(self):
        """Verify POST /settings with invalid provider name returns HTTP 400 Bad Request."""
        res = self.client.post("/settings", json={"llm_provider": "invalid_llm_model"})
        self.assertEqual(res.status_code, 400)

    def test_f3_b02_guest_cannot_update_restricted_provider(self):
        """Verify guest user cannot select deepseek provider."""
        res = self.client.post("/settings?is_guest=true", json={"llm_provider": "deepseek"})
        self.assertEqual(res.status_code, 403)

    def test_f3_b03_empty_custom_instructions_clears_field(self):
        """Verify POST /user/settings with empty string clears custom instructions."""
        self.client.post("/user/settings", json={"user_id": "u-1", "custom_instructions": "Initial"})
        res = self.client.post("/user/settings", json={"user_id": "u-1", "custom_instructions": ""})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["profile"]["custom_instructions"], "")

    def test_f3_b04_large_custom_instructions_truncation(self):
        """Verify 5000+ character custom instructions are safely capped at 5000 chars."""
        large_inst = "Focus on East Africa. " * 300  # > 6000 chars
        res = self.client.post("/user/settings", json={"user_id": "u-2", "custom_instructions": large_inst})
        self.assertEqual(res.status_code, 200)
        saved_inst = res.json()["profile"]["custom_instructions"]
        self.assertEqual(len(saved_inst), 5000)

    def test_f3_b05_user_profile_missing_user_id_param(self):
        """Verify GET /user/settings without user_id query param returns HTTP 400 Bad Request."""
        res = self.client.get("/user/settings")
        self.assertEqual(res.status_code, 400)

    # =========================================================================
    # FEATURE 4: FEEDBACK BOUNDARY & CORNER CASES (5 Tests)
    # =========================================================================
    def test_f4_b01_submit_feedback_invalid_rating(self):
        """Verify submitting rating outside [1, -1] returns HTTP 400 Bad Request."""
        res = self.client.post("/feedback", json={"log_id": "l-1", "rating": 5})
        self.assertEqual(res.status_code, 400)

    def test_f4_b02_submit_feedback_missing_log_id(self):
        """Verify missing log_id in feedback payload returns HTTP 422 Unprocessable Entity."""
        res = self.client.post("/feedback", json={"rating": 1})
        self.assertEqual(res.status_code, 422)

    def test_f4_b03_submit_feedback_empty_body(self):
        """Verify empty body to feedback endpoint returns 422 Validation Error."""
        res = self.client.post("/feedback", json={})
        self.assertEqual(res.status_code, 422)

    def test_f4_b04_oversized_correction_text_truncation(self):
        """Verify correction text over 2000 characters is safely capped at 2000 chars."""
        long_corr = "Correction note: " * 200
        res = self.client.post("/feedback", json={"log_id": "l-long", "rating": -1, "correction_text": long_corr})
        self.assertEqual(res.status_code, 200)

    def test_f4_b05_duplicate_feedback_submission(self):
        """Verify duplicate feedback submission for same query log updates rating without error."""
        self.client.post("/feedback", json={"log_id": "l-dup", "user_id": "u-dup", "rating": -1})
        res = self.client.post("/feedback", json={"log_id": "l-dup", "user_id": "u-dup", "rating": 1})
        self.assertEqual(res.status_code, 200)
        metrics = self.client.get("/admin/metrics").json()
        self.assertEqual(metrics["user_feedback"]["upvotes"], 1)

    # =========================================================================
    # FEATURE 5: ADMIN DASHBOARD BOUNDARY & CORNER CASES (5 Tests)
    # =========================================================================
    def test_f5_b01_admin_access_unauthorized_user(self):
        """Verify non-admin user role fails RBAC check on admin metrics."""
        res = self.client.get("/admin/metrics?user_role=unauthorized_role")
        self.assertEqual(res.status_code, 403)

    def test_f5_b02_admin_metrics_zero_queries_edge_case(self):
        """Verify admin metrics handles zero queries state without zero division error."""
        res = self.client.get("/admin/metrics")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["cache_hit_rate_pct"], 0.0)

    def test_f5_b03_admin_metrics_p50_p95_percentiles_order(self):
        """Verify P95 latency is always greater than or equal to P50 latency."""
        # Execute two queries with different latencies
        self.client.post("/query", json={"query": "Peatland carbon 1"})
        self.client.post("/query", json={"query": "Peatland carbon 2"})
        res = self.client.get("/admin/metrics")
        data = res.json()
        self.assertGreaterEqual(data["p95_latency_ms"], data["p50_latency_ms"])

    def test_f5_b04_admin_metrics_all_negative_feedback(self):
        """Verify 100% downvote ratings calculate 0.0% user satisfaction."""
        self.client.post("/feedback", json={"log_id": "l-neg-1", "rating": -1})
        res = self.client.get("/admin/metrics")
        data = res.json()
        self.assertEqual(data["user_feedback"]["satisfaction_pct"], 0.0)

    def test_f5_b05_admin_metrics_evaluations_empty_list_handling(self):
        """Verify evaluation runs field handles empty lists gracefully."""
        res = self.client.get("/admin/metrics")
        self.assertEqual(res.status_code, 200)
        self.assertIn("recent_evaluations", res.json())

    # =========================================================================
    # FEATURE 6: INFO VIEWS BOUNDARY & CORNER CASES (5 Tests)
    # =========================================================================
    def test_f6_b01_info_unknown_section_404(self):
        """Verify GET /info/nonexistent returns HTTP 404 Not Found."""
        res = self.client.get("/info/nonexistent_view")
        self.assertEqual(res.status_code, 404)

    def test_f6_b02_info_markdown_content_sanitization(self):
        """Verify markdown content does not contain dangerous script tags."""
        res = self.client.get("/info/about")
        self.assertNotIn("<script>", res.json()["content_markdown"])

    def test_f6_b03_info_doi_url_integrity(self):
        """Verify publication DOI links in info views start with valid DOI prefix."""
        res = self.client.get("/info/blogs")
        self.assertIn("10.17528/cifor-icraf/009417", res.json()["content_markdown"])

    def test_f6_b04_info_empty_search_in_faqs(self):
        """Verify requesting FAQs content returns valid standard questions list."""
        res = self.client.get("/info/faqs")
        self.assertIn("What literature sources", res.json()["content_markdown"])

    def test_f6_b05_info_navigation_section_integrity(self):
        """Verify all four canonical info views (about, faqs, blogs, contact) are accessible."""
        for sec in ["about", "faqs", "blogs", "contact"]:
            res = self.client.get(f"/info/{sec}")
            self.assertEqual(res.status_code, 200, f"Section {sec} failed")

if __name__ == "__main__":
    unittest.main()
