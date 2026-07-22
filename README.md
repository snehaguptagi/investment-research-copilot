# Investment Research & Portfolio Insight Copilot

**Codename: PRISM** (Portfolio Research & Insight Synthesis)

A portfolio-aware research assistant for buy-side investment teams. It turns the flood of broker reports, earnings transcripts, news, and internal notes into cited, book-specific insight, so analysts stop summarising and start deciding.

The wedge: a generic tool tells you a company was downgraded. PRISM tells you the downgrade touches 4.2% of Fund A's NAV across three held names and lifts your semiconductor factor tilt, with a citation for every claim.

> Decision-support tool. Not investment advice, not a trading system. All surfaced claims are citation-grounded and reproducible to source.

## Documents

| Doc | Contents |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Problem, personas, goals, success metrics, feature scope, requirements, compliance guardrails, risk register, roadmap |
| [`docs/LLD.md`](docs/LLD.md) | System architecture, component design, data model, entity linking, retrieval/RAG, LLM orchestration, API surface, evaluation harness |

## Status

Early-stage scoping. PRD and LLD are drafted (v0.1). Prototype code (synthetic portfolio dataset, entity-linking spike, insight pipeline) lands in follow-up commits.

## Core design principles

- **Portfolio-aware grounding is the moat.** Every insight is linked to actual holdings, not just summarised.
- **Citations are mandatory, not optional.** Claims without a supporting source span are suppressed, never shown as a guess.
- **Decision-support only.** No trade execution, no personalised investment advice, no autonomous action — a human stays in the loop.
- **Deterministic math, LLM narration.** NAV impact and exposure roll-ups are computed with plain arithmetic; the LLM explains them, it doesn't calculate them.

## License

MIT — see [`LICENSE`](LICENSE).
