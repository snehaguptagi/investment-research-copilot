"""
PRISM deterministic core — direction, roll-up, comparison, ranking.

This is the auditable heart of the pipeline. Given a market EVENT and the
portfolio book, it computes, with plain arithmetic and no LLM:

  - which holdings each portfolio has that the event touches   (linkage)
  - the direction (tailwind / headwind / mixed) per holding     (LLD Sec 7)
  - the % of NAV exposed per portfolio                          (LLD Sec 11)
  - "you vs a normal book" exposure comparison                  (LLD Sec 12)
  - a transparent per-(event, portfolio) rank score            (LLD Sec 8)

The LLM's only job upstream is to turn an article into an `Event` object
(event_type, subject, move, named securities, intrinsic sign). Everything
below is deterministic and unit-testable, which is what makes the numbers
defensible to compliance.

No third-party dependencies. Python 3.9+.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

# --------------------------------------------------------------------------
# Domain types
# --------------------------------------------------------------------------

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "prism_data.json")

# MSCI-style EM classification used for the USD / EM sensitivity rules.
# GCC (SA, AE, QA) is deliberately EXCLUDED here: in this book GCC is its own
# regional dimension, not "broad EM" (matches the dataset's own framing).
EM_COUNTRIES = {
    "IN", "TW", "BR", "KR", "AR", "MX", "CN", "ZA", "ID", "TH",
    "PH", "MY", "PL", "CL", "CO", "TR", "EG",
}

MATERIALITY_FLOOR_PCT = 5.0   # below this, we suppress the "vs a normal book" multiple
ATTENTION_NAV_PCT = 15.0      # "needs attention" exposure threshold (LLD Sec 8)
MULTIPLE_CAP = 10.0           # multiples past this render as "10x+" (no false precision)


class Direction(str, Enum):
    TAILWIND = "tailwind"
    HEADWIND = "headwind"
    MIXED = "mixed"
    NONE = "none"


class Strength(str, Enum):
    STRONG = "strong"
    MILD = "mild"
    NONE = "none"


@dataclass
class Event:
    """Structured event — the LLM's output, the engine's input.

    event_type: one of the keys in the sensitivity matrix below, or
                'company' / 'sector' / 'region' for the targeted cases.
    subject:    free-text subject ('oil', 'rates', 'US semiconductors', ...).
    move:       'up' or 'down' for factor events; None for pure company/sector news.
    intrinsic_sign: +1 / -1 — the event's own sign for its subject
                    (e.g. an export-control crackdown on chips = -1).
    named_security_ids: securities the event directly names (Case A linkage).
    sector / country: for sector- or region-scoped events (Case B linkage).
    magnitude: optional 0..1 relative size of the move (oil +8% -> larger).
    """
    event_type: str
    subject: str
    move: Optional[str] = None
    intrinsic_sign: int = -1
    named_security_ids: list[str] = field(default_factory=list)
    sector: Optional[str] = None
    country: Optional[str] = None
    magnitude: float = 0.5


@dataclass
class HoldingImpact:
    security_id: str
    name: str
    weight_pct: float
    direction: Direction
    strength: Strength


@dataclass
class PortfolioImpact:
    portfolio_id: str
    portfolio_name: str
    exposure_pct: float          # strength-weighted exposure — the PRIMARY figure
    breadth_pct: float           # raw % of NAV with any directional response
    direction: Direction
    direction_strength: Strength
    holdings: list[HoldingImpact]
    # Lens 2 — populated by add_comparison()
    reference_pct: Optional[float] = None
    multiple_label: Optional[str] = None
    rank_score: float = 0.0
    needs_attention: bool = False


# --------------------------------------------------------------------------
# The book
# --------------------------------------------------------------------------

class Book:
    """Loads prism_data.json and indexes it for fast lookup."""

    def __init__(self, path: str = DATA_PATH):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        self.securities = {s["security_id"]: s for s in data["securities"]}
        self.portfolios = {p["portfolio_id"]: p for p in data["portfolios"]}
        self.holdings_by_portfolio: dict[str, list[dict]] = {}
        for h in data["holdings"]:
            self.holdings_by_portfolio.setdefault(h["portfolio_id"], []).append(h)
        self.reference_id = next(
            (pid for pid, p in self.portfolios.items() if p.get("is_reference")),
            None,
        )

    def sec(self, sid: str) -> dict:
        return self.securities[sid]


# --------------------------------------------------------------------------
# Direction engine (LLD Sec 7)
# --------------------------------------------------------------------------

def _is_long_duration(sec: dict) -> bool:
    name = sec.get("name", "").lower()
    return any(k in name for k in ("long", "20+", "30-year", "aggregate", "tips", "muni", "municipal"))


def _is_floating_rate(sec: dict) -> bool:
    name = sec.get("name", "").lower()
    return any(k in name for k in ("floating", "senior loan", "bank loan", "short-term", "1-3"))


def _factor_direction(event: Event, sec: dict) -> tuple[Direction, Strength]:
    """Case B: map a factor move onto one holding via its attributes.

    Returns the direction as if the factor moved in `event.move`. Signs are
    written for the 'up' case and flipped at the end when move == 'down'.
    """
    ac = sec.get("asset_class")
    sector = sec.get("sector")
    beta = sec.get("beta") or 0.0
    country = sec.get("country")
    credit = sec.get("credit_quality")
    et = event.event_type

    pos = Strength.NONE
    sign = 0  # +1 positive, -1 negative under an "up" move

    if et == "rates":
        if ac == "Fixed Income":
            if _is_floating_rate(sec):
                sign, pos = 0, Strength.NONE
            elif _is_long_duration(sec):
                sign, pos = -1, Strength.STRONG
            else:
                sign, pos = -1, Strength.MILD
        elif ac == "Cash":
            sign, pos = +1, Strength.MILD
        elif ac == "Real Estate":
            sign, pos = -1, Strength.STRONG
        elif ac == "Equity":
            if sector == "Financials":
                sign, pos = +1, Strength.MILD
            elif sector == "Utilities":
                sign, pos = -1, Strength.MILD
            elif beta >= 1.1:  # growth / high-beta
                sign, pos = -1, Strength.STRONG if beta >= 1.4 else Strength.MILD
            else:
                sign, pos = -1, Strength.MILD
        elif ac == "Commodity" and "gold" in sec.get("name", "").lower():
            sign, pos = -1, Strength.MILD

    elif et == "credit_spreads":
        if credit == "HY":
            sign, pos = -1, Strength.STRONG
        elif credit == "IG":
            sign, pos = -1, Strength.MILD
        elif ac == "Fixed Income" and credit == "Govt":
            sign, pos = +1, Strength.MILD  # flight to quality
        elif ac == "Equity" and (beta >= 1.2 or sec.get("cap_tier") == "small"):
            sign, pos = -1, Strength.MILD

    elif et == "oil":
        if sector == "Energy":
            sign, pos = +1, Strength.STRONG
        elif ac == "Commodity":
            sign, pos = +1, Strength.MILD
        elif sector in ("Consumer Discretionary", "Industrials"):
            sign, pos = -1, Strength.MILD  # fuel-cost sensitive
        elif ac == "Equity":
            sign, pos = -1, Strength.MILD  # inflationary drag, mild

    elif et == "inflation":
        if "gold" in sec.get("name", "").lower() or ac == "Commodity":
            sign, pos = +1, Strength.STRONG
        elif _is_long_duration(sec) and ac == "Fixed Income":
            sign, pos = -1, Strength.STRONG
        elif ac == "Equity" and beta >= 1.3:
            sign, pos = -1, Strength.MILD

    elif et == "usd":
        if ac in ("Equity", "Fixed Income") and country in EM_COUNTRIES:
            sign, pos = -1, Strength.STRONG
        elif ac == "Commodity":
            sign, pos = -1, Strength.MILD
        elif "gold" in sec.get("name", "").lower():
            sign, pos = -1, Strength.MILD

    elif et == "risk_off":
        if ac == "Digital Assets":
            sign, pos = -1, Strength.STRONG
        elif ac == "Equity":
            if sector in ("Consumer Staples", "Utilities"):
                sign, pos = +1, Strength.MILD
            elif beta >= 1.2 or sec.get("cap_tier") == "small" or country in EM_COUNTRIES:
                sign, pos = -1, Strength.STRONG
            else:
                sign, pos = -1, Strength.MILD
        elif "gold" in sec.get("name", "").lower():
            sign, pos = +1, Strength.MILD
        elif ac == "Fixed Income" and credit == "Govt":
            sign, pos = +1, Strength.MILD

    elif et == "crypto":
        if ac == "Digital Assets":
            sign, pos = +1, Strength.STRONG
        elif sector == "Information Technology" and beta >= 1.3:
            sign, pos = +1, Strength.MILD

    if sign == 0:
        return Direction.NONE, Strength.NONE

    # apply the event's move direction and its intrinsic sign
    move_mult = 1 if (event.move or "up") == "up" else -1
    net = sign * move_mult
    direction = Direction.TAILWIND if net > 0 else Direction.HEADWIND
    return direction, pos


def holding_direction(event: Event, sec: dict) -> tuple[Direction, Strength]:
    """Top-level per-holding direction. Case A (named security) applies the
    event's intrinsic sign directly; Case B uses the sensitivity matrix."""
    if sec["security_id"] in event.named_security_ids:
        direction = Direction.TAILWIND if event.intrinsic_sign > 0 else Direction.HEADWIND
        return direction, Strength.STRONG
    return _factor_direction(event, sec)


# --------------------------------------------------------------------------
# Linkage + roll-up (LLD Sec 11)
# --------------------------------------------------------------------------

def _touches(event: Event, sec: dict) -> bool:
    """v1 'touched' = direct only: named security, or matching sector/region,
    or a factor event whose sensitivity matrix gives this holding a direction."""
    if sec["security_id"] in event.named_security_ids:
        return True
    if event.sector and sec.get("sector") == event.sector:
        return True
    if event.country and sec.get("country") == event.country:
        return True
    if event.event_type in _FACTOR_TYPES:
        d, _ = _factor_direction(event, sec)
        return d != Direction.NONE
    return False


_FACTOR_TYPES = {"rates", "credit_spreads", "oil", "inflation", "usd", "risk_off", "crypto"}

# A mildly-affected holding contributes partially to "exposure"; a strongly
# affected one contributes fully. This keeps narrow events sharp while stopping
# broad macro events (rates, which nudge nearly everything) from saturating to
# ~100% for every book. Weights are documented so the number stays auditable.
_STRENGTH_WEIGHT = {Strength.STRONG: 1.0, Strength.MILD: 0.4, Strength.NONE: 0.0}


def portfolio_impact(book: Book, event: Event, portfolio_id: str) -> PortfolioImpact:
    p = book.portfolios[portfolio_id]
    holdings = book.holdings_by_portfolio.get(portfolio_id, [])

    touched: list[HoldingImpact] = []
    breadth = 0.0          # raw weight of any-direction holdings
    exposure = 0.0         # strength-weighted weight (the primary figure)
    signed_exposure = 0.0  # signed strength-weighted, for net direction
    pos_w = 0.0
    neg_w = 0.0

    for h in holdings:
        sec = book.sec(h["security_id"])
        if not _touches(event, sec):
            continue
        direction, strength = holding_direction(event, sec)
        if direction == Direction.NONE:
            continue
        w = h["weight"] * 100.0
        sw = w * _STRENGTH_WEIGHT[strength]
        breadth += w
        exposure += sw
        touched.append(HoldingImpact(
            security_id=sec["security_id"], name=sec["name"],
            weight_pct=round(w, 2), direction=direction, strength=strength,
        ))
        if direction == Direction.TAILWIND:
            signed_exposure += sw
            pos_w += sw
        elif direction == Direction.HEADWIND:
            signed_exposure -= sw
            neg_w += sw

    net_dir, net_strength = _aggregate_direction(signed_exposure, pos_w, neg_w, exposure)

    return PortfolioImpact(
        portfolio_id=portfolio_id,
        portfolio_name=p["name"],
        exposure_pct=round(exposure, 1),
        breadth_pct=round(breadth, 1),
        direction=net_dir,
        direction_strength=net_strength,
        holdings=sorted(touched, key=lambda x: x.weight_pct, reverse=True),
    )


def _aggregate_direction(signed_exposure, pos_w, neg_w, total_exposure):
    if total_exposure == 0:
        return Direction.NONE, Strength.NONE
    # genuinely two-sided when both directions carry material weight
    if pos_w > 0 and neg_w > 0 and min(pos_w, neg_w) / total_exposure >= 0.25:
        return Direction.MIXED, Strength.MILD
    if signed_exposure == 0:
        return Direction.NONE, Strength.NONE
    direction = Direction.TAILWIND if signed_exposure > 0 else Direction.HEADWIND
    intensity = abs(signed_exposure) / total_exposure  # 0..1
    strength = Strength.STRONG if intensity >= 0.5 else Strength.MILD
    return direction, strength


# --------------------------------------------------------------------------
# Comparison — "you vs a normal book" (LLD Sec 12)
# --------------------------------------------------------------------------

def _reference_exposure(book: Book, event: Event) -> float:
    if not book.reference_id:
        return 0.0
    ref = portfolio_impact(book, event, book.reference_id)
    return ref.exposure_pct


def add_comparison(book: Book, event: Event, impact: PortfolioImpact) -> PortfolioImpact:
    ref_pct = _reference_exposure(book, event)
    impact.reference_pct = round(ref_pct, 1)

    # absolute-first; multiple is secondary and only shown above the floor
    if impact.exposure_pct < MATERIALITY_FLOOR_PCT or ref_pct <= 0.0:
        impact.multiple_label = None
    else:
        mult = impact.exposure_pct / ref_pct
        if mult >= MULTIPLE_CAP:
            impact.multiple_label = f"{int(MULTIPLE_CAP)}x+"
        elif mult >= 1.5:
            impact.multiple_label = f"~{round(mult)}x"
        else:
            impact.multiple_label = None  # not meaningfully different from a normal book
    return impact


# --------------------------------------------------------------------------
# Ranking & materiality (LLD Sec 8)
# --------------------------------------------------------------------------

def score_impact(impact: PortfolioImpact, event: Event) -> PortfolioImpact:
    strength_val = {Strength.STRONG: 1.0, Strength.MILD: 0.5, Strength.NONE: 0.0}[impact.direction_strength]
    concentration = max((h.weight_pct for h in impact.holdings), default=0.0)

    impact.rank_score = round(
        1.0 * impact.exposure_pct
        + 12.0 * strength_val
        + 8.0 * event.magnitude
        + 0.15 * concentration,
        2,
    )
    impact.needs_attention = (
        impact.exposure_pct >= ATTENTION_NAV_PCT
        and impact.direction_strength == Strength.STRONG
        and impact.direction in (Direction.TAILWIND, Direction.HEADWIND)
    )
    return impact


# --------------------------------------------------------------------------
# Top-level convenience
# --------------------------------------------------------------------------

def analyze_event(book: Book, event: Event, include_zero: bool = False) -> list[PortfolioImpact]:
    """Run one event against the whole book. Returns per-portfolio impacts,
    ranked, each with the Lens-2 comparison filled in."""
    results = []
    for pid in book.portfolios:
        imp = portfolio_impact(book, event, pid)
        if imp.exposure_pct == 0 and not include_zero:
            continue
        add_comparison(book, event, imp)
        score_impact(imp, event)
        results.append(imp)
    results.sort(key=lambda x: x.rank_score, reverse=True)
    return results


def cross_desk_contradictions(impacts: list[PortfolioImpact]) -> list[tuple[PortfolioImpact, PortfolioImpact]]:
    """ADVANCED.md #4: pairs of portfolios with opposing direction on the same
    event. Deterministic aggregation over the already-computed directions."""
    tail = [i for i in impacts if i.direction == Direction.TAILWIND]
    head = [i for i in impacts if i.direction == Direction.HEADWIND]
    pairs = []
    for t in tail:
        for h in head:
            pairs.append((t, h))
    pairs.sort(key=lambda p: p[0].exposure_pct + p[1].exposure_pct, reverse=True)
    return pairs
