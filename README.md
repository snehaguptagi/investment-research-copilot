# Investment Research & Portfolio Insight Copilot

**Codename: PRISM** (Portfolio Research & Insight Synthesis)

A portfolio-aware research assistant for buy-side investment teams. It turns the flood of broker reports, earnings transcripts, news, and internal notes into cited, book-specific insight, so analysts stop summarising and start deciding.

The wedge: a generic tool tells you a company was downgraded. PRISM tells you the downgrade touches 4.2% of Fund A's NAV across three held names and lifts your semiconductor factor tilt, with a citation for every claim.

> Decision-support tool. Not investment advice, not a trading system. All surfaced claims are citation-grounded and reproducible to source.

## Documents

| Doc | Contents |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Problem, personas, goals, success metrics, feature scope, requirements, compliance guardrails, risk register, roadmap |
| [`docs/LLD.md`](docs/LLD.md) | System architecture, the market-insight pipeline (data sourcing, signal construction, direction engine, ranking), the you-vs-a-normal-book comparison, API surface, evaluation harness |
| [`docs/ADVANCED.md`](docs/ADVANCED.md) | Beyond-MVP differentiators: second-order read-through, scenario roll-up, thesis-drift detector, cross-desk contradiction flagging |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Visual design system: color, typography, layout, and components for the product surface |

## Code

| Path | What's there |
|---|---|
| [`data/prism_data.json`](data/prism_data.json) | The 19-portfolio synthetic dataset: securities, holdings, computed risk, referenced throughout the docs |
| [`pipeline/`](pipeline/) | The deterministic core in Python — direction engine, roll-up, the you-vs-a-normal-book comparison, ranking, cross-desk contradiction detection. Runs today with zero API keys; see [`pipeline/README.md`](pipeline/README.md) |
| [`web/`](web/) | **v1 MVP** — the same engine ported to vanilla JS, with a real UI implementing `DESIGN.md`. Zero-build static site: run locally or deploy to Vercel in one command; see [`web/README.md`](web/README.md) |

## Status

PRD, LLD, ADVANCED, and DESIGN are drafted (v0.2). The deterministic core is built, tested, and ported to a running web MVP (`web/`) with both the analyst ("My Book") and CIO ("Event Lens") views. Next: the structured-API data layer (Finnhub/Marketaux/GDELT/EDGAR) and the LLM classification/narration layer on top of it.

## Core design principles

- **Portfolio-aware grounding is the moat.** Every insight is linked to actual holdings, not just summarised.
- **Citations are mandatory, not optional.** Claims without a supporting source span are suppressed, never shown as a guess.
- **Decision-support only.** No trade execution, no personalised investment advice, no autonomous action — a human stays in the loop.
- **Deterministic math, LLM narration.** NAV impact and exposure roll-ups are computed with plain arithmetic; the LLM explains them, it doesn't calculate them.

## License

MIT — see [`LICENSE`](LICENSE).
