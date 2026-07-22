"""
CLI for the deterministic core. No API keys, no network — runs entirely
against data/prism_data.json.

Examples:
    python run.py                       # list scenarios
    python run.py chip-controls         # full book, ranked, for one event
    python run.py rate-cuts --top 6
    python run.py oil-spike --contradictions
"""

import argparse
import sys

from engine import Book, analyze_event, cross_desk_contradictions, Direction
from scenarios import SCENARIOS

DIR_MARK = {
    Direction.TAILWIND: "TAILWIND",
    Direction.HEADWIND: "HEADWIND",
    Direction.MIXED: "MIXED",
    Direction.NONE: "-",
}


def fmt_impact(imp) -> str:
    attn = "  [NEEDS ATTENTION]" if imp.needs_attention else ""
    head = (f"{imp.portfolio_name}\n"
            f"  {DIR_MARK[imp.direction]} ({imp.direction_strength.value})  "
            f"{imp.exposure_pct}% exposure (strength-weighted, {imp.breadth_pct}% of NAV touched at all)")
    if imp.reference_pct is not None:
        head += f"\n  vs {imp.reference_pct}% for a balanced book"
        if imp.multiple_label:
            head += f"  ({imp.multiple_label})"
    head += attn
    names = ", ".join(f"{h.name.split('(')[0].strip()} {h.weight_pct}%" for h in imp.holdings[:4])
    if names:
        head += f"\n  holdings: {names}"
    return head


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scenario", nargs="?", help="scenario key (omit to list)")
    ap.add_argument("--top", type=int, default=8)
    ap.add_argument("--contradictions", action="store_true",
                    help="show cross-desk opposing-exposure pairs")
    args = ap.parse_args()

    if not args.scenario:
        print("Available scenarios:")
        for k, ev in SCENARIOS.items():
            print(f"  {k:18s} {ev.subject}")
        return

    if args.scenario not in SCENARIOS:
        print(f"Unknown scenario '{args.scenario}'. Options: {', '.join(SCENARIOS)}")
        sys.exit(1)

    book = Book()
    event = SCENARIOS[args.scenario]
    impacts = analyze_event(book, event)

    print("=" * 72)
    print(f"EVENT: {event.subject}")
    print(f"       type={event.event_type} move={event.move} magnitude={event.magnitude}")
    print(f"       {len(impacts)} of {len(book.portfolios)} portfolios touched; "
          f"reference = {book.portfolios[book.reference_id]['name']}")
    print("=" * 72)

    for imp in impacts[:args.top]:
        print(fmt_impact(imp))
        print()

    if args.contradictions:
        pairs = cross_desk_contradictions(impacts)
        print("-" * 72)
        print(f"CROSS-DESK CONTRADICTIONS ({len(pairs)}): opposing exposure, same event")
        print("-" * 72)
        for t, h in pairs[:5]:
            print(f"  + {t.portfolio_name}: TAILWIND {t.pct_nav_touched}%")
            print(f"  - {h.portfolio_name}: HEADWIND {h.pct_nav_touched}%")
            print()


if __name__ == "__main__":
    main()
