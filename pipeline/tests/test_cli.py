"""
CLI smoke tests. The unit tests in test_engine.py call engine.py directly
and never exercise run.py's own print/formatting code — which is exactly
how a stale field reference in the display layer (pct_nav_touched, renamed
to exposure_pct during the strength-weighting fix) shipped without being
caught. These tests invoke the actual CLI as a subprocess so that class of
bug fails loudly instead of silently.
"""

import os
import subprocess
import sys
import unittest

PIPELINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUN_PY = os.path.join(PIPELINE_DIR, "run.py")


def run_cli(*args):
    result = subprocess.run(
        [sys.executable, RUN_PY, *args],
        cwd=PIPELINE_DIR,
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result


class TestCliSmoke(unittest.TestCase):
    def test_list_scenarios_exits_clean(self):
        r = run_cli()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("chip-controls", r.stdout)

    def test_every_scenario_runs_without_crashing(self):
        scenarios = ["chip-controls", "rate-cuts", "oil-spike", "credit-stress",
                     "risk-off", "inflation-shock", "dollar-strength"]
        for s in scenarios:
            r = run_cli(s)
            self.assertEqual(r.returncode, 0, f"{s} crashed:\n{r.stderr}")

    def test_contradictions_flag_does_not_crash(self):
        # this exact path shipped broken once (stale pct_nav_touched reference)
        r = run_cli("oil-spike", "--contradictions")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("CROSS-DESK CONTRADICTIONS", r.stdout)

    def test_unknown_scenario_fails_gracefully(self):
        r = run_cli("not-a-real-scenario")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("Unknown scenario", r.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
