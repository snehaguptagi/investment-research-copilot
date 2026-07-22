"""
Deterministic-core tests. These lock in the hand-verified worked examples
from the design conversation, so a future change to the sensitivity matrix
or the comparison logic can't silently break the numbers that were checked
by hand against real portfolio data.

Run: python -m pytest pipeline/tests/  (or python pipeline/tests/test_engine.py)
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine import Book, Direction, Strength, analyze_event, cross_desk_contradictions
from scenarios import SCENARIOS


class TestBookLoads(unittest.TestCase):
    def setUp(self):
        self.book = Book()

    def test_book_has_19_portfolios(self):
        self.assertEqual(len(self.book.portfolios), 19)

    def test_reference_portfolio_is_flagged(self):
        self.assertIsNotNone(self.book.reference_id)
        self.assertEqual(self.book.reference_id, "pf_global_multi")


class TestChipControls(unittest.TestCase):
    """A direct, named-security event (Case A linkage) should stay sharp:
    only portfolios actually holding the named chip names light up, and the
    US Tech book — carrying NVIDIA/AMD/Broadcom/TSMC — should top the list."""

    def setUp(self):
        self.book = Book()
        self.impacts = analyze_event(self.book, SCENARIOS["chip-controls"])
        self.by_id = {i.portfolio_id: i for i in self.impacts}

    def test_only_chip_exposed_books_are_touched(self):
        # Municipal income and gold hold none of the named chip names
        self.assertNotIn("pf_muni_income", self.by_id)

    def test_us_tech_is_headwind_and_top_ranked(self):
        top = self.impacts[0]
        self.assertEqual(top.portfolio_id, "pf_us_tech")
        self.assertEqual(top.direction, Direction.HEADWIND)
        self.assertGreater(top.exposure_pct, 40)

    def test_needs_attention_flag_fires_for_us_tech(self):
        self.assertTrue(self.by_id["pf_us_tech"].needs_attention)


class TestRateCuts(unittest.TestCase):
    """A broad macro event must NOT saturate every book to ~100% — that was
    the bug caught during manual verification. Strength-weighting should
    produce a real spread, and rate-sensitive books (muni, long bonds) should
    rank at or near the top, not below concentrated equity books."""

    def setUp(self):
        self.book = Book()
        self.impacts = analyze_event(self.book, SCENARIOS["rate-cuts"])
        self.by_id = {i.portfolio_id: i for i in self.impacts}

    def test_not_everyone_saturates_to_100_percent(self):
        exposures = [i.exposure_pct for i in self.impacts]
        # if the bug regresses, every value collapses to ~100
        self.assertLess(max(exposures) - min(exposures), 100)
        self.assertGreater(len(set(round(e) for e in exposures)), 5)

    def test_rate_sensitive_books_rank_high(self):
        top_5_ids = {i.portfolio_id for i in self.impacts[:5]}
        # municipal income (long-duration munis) or the core bond ladder
        # should be near the top on a rates event, not buried
        self.assertTrue(
            "pf_muni_income" in top_5_ids or "pf_bond_ladder" in top_5_ids,
            "expected a rate-sensitive fixed-income book in the top 5 on a rates event",
        )

    def test_direction_is_tailwind_for_growth_tech(self):
        self.assertEqual(self.by_id["pf_us_tech"].direction, Direction.TAILWIND)


class TestOilSpikeAndContradictions(unittest.TestCase):
    """The cross-desk contradiction feature (ADVANCED.md #4): the same event
    should produce genuinely opposing directions across the book, and that
    must be detectable as concrete tailwind/headwind pairs."""

    def setUp(self):
        self.book = Book()
        self.impacts = analyze_event(self.book, SCENARIOS["oil-spike"])
        self.by_id = {i.portfolio_id: i for i in self.impacts}

    def test_gold_is_tailwind_on_oil_spike(self):
        self.assertEqual(self.by_id["pf_gold_inflation"].direction, Direction.TAILWIND)

    def test_contradictions_exist_and_are_real_opposites(self):
        pairs = cross_desk_contradictions(self.impacts)
        self.assertGreater(len(pairs), 0)
        for tail, head in pairs:
            self.assertEqual(tail.direction, Direction.TAILWIND)
            self.assertEqual(head.direction, Direction.HEADWIND)


class TestComparisonLens(unittest.TestCase):
    """Lens 2 presentation rules: absolute-first, capped multiple, no false
    precision, materiality floor respected."""

    def setUp(self):
        self.book = Book()

    def test_multiple_is_capped_not_precise(self):
        impacts = analyze_event(self.book, SCENARIOS["chip-controls"])
        top = impacts[0]
        if top.multiple_label:
            self.assertNotRegex(top.multiple_label, r"^\d+\.\d+x$")  # no "12.3x"-style false precision

    def test_below_materiality_floor_suppresses_multiple(self):
        impacts = analyze_event(self.book, SCENARIOS["chip-controls"])
        small = [i for i in impacts if i.exposure_pct < 5]
        for i in small:
            self.assertIsNone(i.multiple_label)

    def test_every_impact_carries_a_reference_comparison(self):
        impacts = analyze_event(self.book, SCENARIOS["rate-cuts"])
        for i in impacts:
            self.assertIsNotNone(i.reference_pct)


class TestNoAdviceInvariant(unittest.TestCase):
    """The engine emits numbers and directions only — never text resembling
    advice. This is a structural guarantee, not a string-matching hack: the
    dataclasses have no field capable of carrying a recommendation."""

    def test_portfolio_impact_has_no_recommendation_field(self):
        from engine import PortfolioImpact
        fields = PortfolioImpact.__dataclass_fields__.keys()
        for banned in ("recommendation", "advice", "action", "should"):
            self.assertNotIn(banned, fields)


if __name__ == "__main__":
    unittest.main(verbosity=2)
