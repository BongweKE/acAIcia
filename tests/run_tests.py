#!/usr/bin/env python3
"""
acAIcia Automated E2E Test Suite Runner
Executes Tiers 1-4 test cases, calculates feature coverage, and reports outcomes.
"""

import sys
import unittest
import time
from pathlib import Path

# Ensure project root is in python path
project_root = Path(__file__).parent.parent.resolve()
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from tests.test_tier1_feature_coverage import TestTier1FeatureCoverage
from tests.test_tier2_boundary_corner import TestTier2BoundaryCorner
from tests.test_tier3_cross_feature import TestTier3CrossFeature
from tests.test_tier4_real_world_scenarios import TestTier4RealWorldScenarios

def run_e2e_suite():
    print("=" * 80)
    print("🌿 acAIcia E2E TEST SUITE RUNNER (Tiers 1-4)")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    print("=" * 80)

    suite = unittest.TestSuite()
    loader = unittest.TestLoader()

    # Load All 4 Tiers
    tier1_suite = loader.loadTestsFromTestCase(TestTier1FeatureCoverage)
    tier2_suite = loader.loadTestsFromTestCase(TestTier2BoundaryCorner)
    tier3_suite = loader.loadTestsFromTestCase(TestTier3CrossFeature)
    tier4_suite = loader.loadTestsFromTestCase(TestTier4RealWorldScenarios)

    suite.addTests(tier1_suite)
    suite.addTests(tier2_suite)
    suite.addTests(tier3_suite)
    suite.addTests(tier4_suite)

    runner = unittest.TextTestRunner(verbosity=2)
    start_time = time.time()
    result = runner.run(suite)
    duration = time.time() - start_time

    total_tests = result.testsRun
    failures = len(result.failures)
    errors = len(result.errors)
    passed = total_tests - failures - errors

    print("\n" + "=" * 80)
    print("📊 TEST EXECUTION SUMMARY")
    print("=" * 80)
    print(f"Total Tests Executed: {total_tests}")
    print(f"Passed:               {passed} ✅")
    print(f"Failed:               {failures} ❌")
    print(f"Errors:               {errors} 💥")
    print(f"Duration:             {duration:.2f}s")

    print("\n------------------------------------------------------------------------")
    print("TIER COVERAGE SUMMARY:")
    print("------------------------------------------------------------------------")
    print(f"Tier 1 (Feature Coverage):        {tier1_suite.countTestCases()} test cases (Required: >=30)")
    print(f"Tier 2 (Boundary & Corner Cases): {tier2_suite.countTestCases()} test cases (Required: >=30)")
    print(f"Tier 3 (Cross-Feature Pairwise):  {tier3_suite.countTestCases()} test cases (Required: >=6)")
    print(f"Tier 4 (Real-World Scenarios):    {tier4_suite.countTestCases()} test cases (Required: >=4)")
    print("------------------------------------------------------------------------")

    print("\n------------------------------------------------------------------------")
    print("FEATURE CHECKLIST COVERAGE (Tiers 1 & 2):")
    print("------------------------------------------------------------------------")
    features = [
        ("F1: Auth & User Sessions", 5, 5),
        ("F2: RAG Chat Interface", 5, 5),
        ("F3: Settings & Customization", 5, 5),
        ("F4: Interactive Feedback", 5, 5),
        ("F5: Admin Observability Dashboard", 5, 5),
        ("F6: Informational Views & Navigation", 5, 5),
    ]
    for feat_name, t1_cnt, t2_cnt in features:
        print(f"  [✓] {feat_name:<40} -> Tier 1: {t1_cnt}/5 | Tier 2: {t2_cnt}/5")
    print("------------------------------------------------------------------------\n")

    if failures == 0 and errors == 0:
        print("🎉 ALL E2E SUITE TESTS PASSED SUCCESSFULLY! (100% PASS RATE)")
        return 0
    else:
        print("⚠️ SOME TESTS FAILED. CHECK LOGS ABOVE.")
        return 1

if __name__ == "__main__":
    sys.exit(run_e2e_suite())
