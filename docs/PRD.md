# PRD — Investment Research & Portfolio Insight Copilot

**Codename:** PRISM (Portfolio Research & Insight Synthesis)
**Status:** Draft v0.2
**Segment:** Asset management — AMCs, CIO office, research GCCs
**Date:** 2026-07-22

A portfolio-aware research assistant that turns the flood of broker reports, earnings transcripts, news, and internal notes into cited, book-specific insight, so analysts stop summarising and start deciding.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Problem & context](#2-problem--context)
3. [Goals & non-goals](#3-goals--non-goals)
4. [Personas & jobs to be done](#4-personas--jobs-to-be-done)
5. [Success metrics](#5-success-metrics)
6. [Feature scope (MoSCoW)](#6-feature-scope-moscow)
7. [Key user journeys](#7-key-user-journeys)
8. [Functional requirements](#8-functional-requirements)
9. [Non-functional requirements](#9-non-functional-requirements)
10. [Data sources & licensing](#10-data-sources--licensing)
11. [Compliance & guardrails](#11-compliance--guardrails)
12. [Risk register](#12-risk-register)
13. [Roadmap](#13-roadmap)
14. [Open questions](#14-open-questions)

See [`LLD.md`](./LLD.md) for system architecture, the market-insight pipeline, and the low-level engineering plan. See [`ADVANCED.md`](./ADVANCED.md) for beyond-MVP differentiators. See [`DESIGN.md`](./DESIGN.md) for the visual design system.

---

## 1. Executive summary

Investment teams spend disproportionate effort reading and re-summarising the same universe of market content, then manually translating it into portfolio implications. The reading is not the bottleneck; the **translation from event to "what it means for our book"** is. Existing summarisation tools stop at the summary. This product goes one step further and links every insight to the fund's actual holdings, sector exposures, and risk positions.

The wedge, and the moat, is **portfolio-aware grounding**. A generic tool tells you a company was downgraded. This tells you the downgrade touches 4.2% of Fund A's NAV across three held names and lifts your semiconductor factor tilt. Because it operates in a regulated context, every claim is citation-grounded and traceable to a source, and the system stays firmly in decision-support territory rather than issuing advice or executing trades.

| | |
|---|---|
| **Core wedge** | Event-to-held-position linkage |
| **MVP source types** | 4, all public at launch |
| **Time to friendly-desk pilot** | 8 weeks |
| **Citation coverage** | 100% of surfaced claims |

> **Thesis in one line:** Everyone can summarise. Almost no one connects the summary to your book with a citation you can defend to compliance. That connection is the product.

## 2. Problem & context

Buy-side research analysts and portfolio managers face a continuous, high-volume inbound stream: sell-side broker notes, earnings-call transcripts, regulatory filings, real-time news, market commentary, and their own firm's internal research. The manual workflow is expensive on three fronts:

- **Volume triage.** Deciding what, out of hundreds of daily items, is even relevant to the positions they hold.
- **Synthesis.** Compressing long documents into the few sentences that matter, repeatedly, across overlapping sources.
- **Translation to the book.** Connecting an external event to specific holdings, sector exposures, and risk positions. This is the step that carries the real cognitive load and is the least supported by existing tooling.

The consequence is slower decision support, uneven coverage (well-followed names get attention; the long tail is neglected), and senior analyst time spent on low-leverage reading rather than judgement. The CIO office, meanwhile, lacks a consolidated, timely view of how unfolding events map onto the firm's aggregate exposures.

**Why now:** Long-context LLMs make document synthesis reliable and cheap; grounded retrieval makes citations enforceable; and firms are actively standing up research GCCs and AI functions, creating both the demand and the delivery capacity for exactly this class of tool.

## 3. Goals & non-goals

**Goals**
- Cut time-to-insight per material event by a target of 60% or more.
- Link surfaced insights to specific held positions with high precision.
- Raise coverage of the held universe, especially long-tail names.
- Give the CIO office a firm-wide event-to-exposure oversight view.
- Make every insight defensible: cited, traceable, reproducible.

**Non-goals (for v1)**
- No trade execution, order routing, or portfolio rebalancing.
- No personalised investment advice to end investors.
- No price prediction, alpha signals, or quant factor models.
- No replacement of the OMS, EMS, or system of record.
- No fully autonomous action; a human stays in the loop.

> **Positioning guardrail:** PRISM is a research productivity and oversight tool, not an advisory or trading system. This boundary is a product decision, not just a compliance one, and it keeps the surface area shippable.

## 4. Personas & jobs to be done

The user and the buyer are different people. Design must satisfy both or the product dies in the gap between them.

**Research analyst** — *primary user*
> "When a name I cover reports or moves, help me understand the read-through to our positions fast, with sources I can cite in my note."
Cares about: speed and coverage, trustworthy citations, not missing material events.

**Portfolio manager** — *primary user*
> "Tell me which of my holdings are affected by what's happening today, and how much of my book is exposed."
Cares about: book-level relevance, risk and exposure context, a fast morning digest.

**CIO office** — *buyer / sponsor*
> "Give me firm-wide oversight of how events map to our aggregate exposures, and evidence the desks are covered."
Cares about: oversight and consistency, auditability and control, demonstrable productivity.

**Research GCC lead** — *delivery / scale*
> "Let my offshore team support many global desks at once without re-learning each book's context by hand."
Cares about: multi-desk/multi-portfolio support, entitlements and access, repeatable workflows.

## 5. Success metrics

| Tier | Metric | Definition | Target (pilot) |
|---|---|---|---|
| North star | Time-to-insight | Median minutes from a material event to a cited, book-linked summary in front of the analyst | < 5 min |
| Value | Held-universe coverage | % of held names with at least one fresh, linked insight per week | > 90% |
| Quality | Linkage precision | % of holding links judged correct on audit | > 92% |
| Trust | Citation accuracy | % of claims whose cited source actually supports them | > 98% |
| Adoption | Weekly active analysts | Distinct users running ≥ 3 sessions/week on the pilot desk | > 70% |
| Outcome | Self-reported time saved | Hours/week per analyst, survey-based | ≥ 5 hrs |

> **Metric philosophy:** Raw summary quality is table stakes and hard to move a buyer with. Time-to-insight and coverage are what leadership feels. Citation accuracy is the metric that, if it slips, ends the pilot regardless of the others.

## 6. Feature scope (MoSCoW)

| Priority | Capability | Notes |
|---|---|---|
| Must | Multi-source ingestion & normalisation | Transcripts, filings, news, internal notes into one schema |
| Must | Grounded summarisation | Per-document and per-event, every claim cited |
| Must | Holdings linkage | Insight to specific positions. The wedge. |
| Must | Sector / exposure roll-up | "3 held names touched, 4.2% of NAV" |
| Must | You-vs-a-normal-book comparison | The centerpiece lens: your exposure vs a reference 60/40 book, see [`LLD.md` §12](./LLD.md#12-portfolio-comparison--the-you-vs-a-normal-book-lens) |
| Must | Direction (tailwind/headwind), not just linkage | Computed per holding via the sensitivity matrix, not article sentiment |
| Must | Grounded analyst Q&A | Chat over the corpus with citations and filters |
| Should | Personalised daily digest | Per-PM, scoped to their book |
| Should | Material-event alerting | Push when news hits a held name above a threshold |
| Should | Risk-position flagging | Concentration and factor-tilt shifts from an event |
| Could | Thematic clustering | Auto-surface emerging cross-source themes |
| Could | CIO oversight dashboard | Firm-wide event-to-exposure heatmap |
| Could | Cross-desk contradiction flagging | CIO-level; see [`ADVANCED.md`](./ADVANCED.md) #4 |
| Could | Scenario / counterfactual roll-up | Deterministic what-if; see [`ADVANCED.md`](./ADVANCED.md) #2 |
| Could | Thesis-drift detector | Flags events contradicting an analyst's own prior notes; see [`ADVANCED.md`](./ADVANCED.md) #3 |
| Won't (v1) | Trade execution / rebalancing | Explicit non-goal |
| Won't (v1) | Alpha / price prediction | Out of scope and out of positioning |
| Won't (v1) | Second-order supply-chain read-through | Gated on licensed data; see [`ADVANCED.md`](./ADVANCED.md) #1 |

## 7. Key user journeys

**J1. Morning book scan (PM)**
PM opens PRISM. Dashboard shows overnight material events touching held names, ranked by NAV impact. Each row expands to a cited summary and the affected positions. Two minutes replaces a half-hour scan.

**J2. Earnings read-through (analyst)**
A covered name reports. PRISM ingests the transcript, produces a cited summary, and highlights which of the firm's holdings share supply-chain, sector, or factor exposure. Analyst asks follow-ups in chat, then lifts cited lines straight into their internal note.

**J3. Ad-hoc question (analyst)**
"What did brokers say about our semiconductor holdings this quarter, and what's the risk read-through?" PRISM retrieves across the corpus, answers with inline citations, and lists the positions in scope, filterable by fund, sector, and date.

**J4. Oversight review (CIO office)**
CIO office views the firm-wide heatmap of events against aggregate exposures, confirms coverage of the held universe, and drills into any desk. Audit log records who saw what.

## 8. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Ingest documents from transcripts, filings, news feeds, and uploaded internal notes; deduplicate near-identical items. | Must |
| FR-02 | Resolve company and instrument mentions in text to the firm's holdings, including aliases, tickers, ADRs, and subsidiary-to-parent. | Must |
| FR-03 | Generate document- and event-level summaries where every claim carries an inline citation to a source span. | Must |
| FR-04 | For any event, compute affected holdings, % of NAV exposed, and sector breakdown. | Must |
| FR-05 | Answer natural-language questions over the corpus with citations; support filters by fund, sector, entity, and date. | Must |
| FR-06 | Enforce per-user, per-desk entitlements on both documents and portfolios. | Must |
| FR-07 | Produce a personalised digest per PM on a schedule, scoped to their holdings. | Should |
| FR-08 | Alert users when a material event hits a held name above a configurable threshold. | Should |
| FR-09 | Flag concentration and factor-tilt changes implied by an event. | Should |
| FR-10 | Maintain an immutable audit log of queries, sources shown, and outputs. | Must |

## 9. Non-functional requirements

| Category | Requirement |
|---|---|
| Latency | Interactive Q&A first token < 3s; full grounded answer < 12s. New-document ingest-to-searchable < 5 min. |
| Accuracy | Linkage precision > 92%; citation faithfulness > 98% on the eval set (see LLD §Evaluation harness). |
| Security | Encryption in transit and at rest; row-level entitlement enforcement; no training on client data; tenant isolation. |
| Auditability | Every surfaced claim reproducible to its source span; full query and access logging retained per policy. |
| Reliability | Graceful degradation: if linkage confidence is low, show the summary and flag the uncertainty rather than guessing. |
| Scalability | Multi-tenant, multi-desk, multi-portfolio from day one; ingest volume scalable independent of query load. |
| Privacy | Internal research never leaves the tenant boundary; configurable data residency. |

## 10. Data sources & licensing

Data licensing, not the model, is the true commercial critical path. The MVP is deliberately built on structured, free-tier APIs, not scraping and not LLM-search-alone; licensed sources are a parallel workstream, not a blocker. Full architecture in [`LLD.md` §4](./LLD.md#4-market-data--news-architecture).

| Source | Provider(s) | MVP status | Notes |
|---|---|---|---|
| Ticker-tagged financial news | Finnhub (spine), Marketaux | Free tier | Finnhub ~60 calls/min; Marketaux 100/day, sentiment included |
| Macro / political / global events | GDELT | Free | Covers the non-financial domains (policy, geopolitics) |
| Regulatory filings | SEC EDGAR | Free, official | 10-K/8-K/13F/Form 4; primary-source depth |
| Earnings-call transcripts | Public subset | Public | Publicly posted transcripts for the pilot; licensed feed for production |
| Internal research notes | Tenant-supplied | — | Uploaded by the firm; never leaves the tenant; also the thesis-drift ground truth ([`ADVANCED.md`](./ADVANCED.md) #3) |
| Sell-side broker reports | — | Deferred | Paywalled/licensed. Production only, with entitlement checks. Do not use in MVP. |
| Supply-chain relationship data | e.g. Bloomberg SPLC, FactSet | Deferred | Gates the full second-order read-through ([`ADVANCED.md`](./ADVANCED.md) #1) |
| Holdings & exposures | Tenant-supplied | — | From the firm's system of record; the linkage target |

## 11. Compliance & guardrails

- **Human in the loop, always.** Output is decision-support; no automated action is taken on the book.
- **No advice generation.** The system does not issue buy/sell recommendations or personalised investment advice.
- **Grounding is mandatory.** Claims without a supporting source span are suppressed, not shown with a guess.
- **Entitlement-aware.** Users only see documents and portfolios they are cleared for; licensed content respects its terms.
- **Full audit trail.** Every query, source shown, and output is logged and reproducible.
- **MNPI hygiene.** Clear handling boundary for any material non-public information; internal notes stay inside the tenant.

## 12. Risk register

| ID | Risk | Sev. | Mitigation |
|---|---|---|---|
| R-01 | Entity linking too inaccurate to trust; wrong holdings surfaced | Med ↓ | Was High; downgraded because ticker-tagged news APIs (Finnhub/Marketaux) provide linkage as a structured field, not an LLM guess. Hybrid resolver + confidence + fail-closed remains for untagged sources. |
| R-02 | Hallucinated or unsupported implications in a regulated setting | High | Mandatory citation grounding; claim-level verification; cross-check verifier pass; suppress ungrounded output |
| R-03 | Broker-report licensing blocks production value | High | MVP on free structured APIs (Finnhub/Marketaux/GDELT/EDGAR); broker-report licensing as a parallel commercial workstream |
| R-04 | Buyer sees it as "just another summariser" | Med | Lead every demo with the holdings-linkage and you-vs-a-normal-book comparison, not the summary |
| R-05 | Adoption stalls; analysts distrust and revert | Med | Citations on every claim; pilot with a friendly desk; measure time saved |
| R-06 | Data residency / security objections from IT | Med | Tenant isolation, no training on client data, configurable residency |
| R-07 | Cost per query scales badly with corpus size | Low | Tiered models: cheap for bulk summarisation, top-tier for reasoning; caching; free-tier APIs before paid |
| R-08 | Direction inferred from article sentiment gives wrong read-through (e.g. oil-up read as bad for an oil producer) | High | Direction is never sentiment; it's computed by the deterministic sensitivity matrix over security attributes ([`LLD.md` §7](./LLD.md#7-direction-engine)) |

## 13. Roadmap

**Phase 0 — Foundation & de-risking** (Week 1)
Pick a realistic model portfolio; triage data sources; run the entity-linking spike; wire up the LLM and citation pattern.
*Exit:* linking > 90% on the test set; clean holdings table + ~30 documents in hand.

**Phase 1 — Core pipeline, no UI** (Weeks 2–3)
End-to-end ingest → link → embed → retrieve → grounded answer; deterministic portfolio roll-up.
*Exit:* from a terminal, "what happened to my tech holdings this quarter?" returns a cited answer listing affected positions.

**Phase 2 — Analyst UI** (Weeks 4–5)
Streamlit dashboard, document view, grounded chat, and the trust features (citations, confidence, "decision support" framing).
*Exit:* an analyst runs the full demo flow unaided and trusts the citations.

**Phase 3 — Hardening for pilot** (Weeks 6–8)
Digests, alerting, eval harness, entitlements + audit log, production-grade vector store.
*Exit:* one friendly desk uses it for a week and reports time saved.

## 14. Open questions

- Which asset class and region for the pilot book (US equities, India equities, multi-asset)? It shapes the securities master and news sources.
- What is the firm's system of record for holdings, and how do we get a daily feed?
- What is the acceptable latency/cost envelope per analyst per day?
- ~~Which licensed news provider has redistribution terms compatible with the product?~~ Resolved for MVP: Finnhub + Marketaux + GDELT + SEC EDGAR, all free-tier and attribution-compatible ([`LLD.md` §4](./LLD.md#4-market-data--news-architecture)). Still open for scale: which paid tier to move to, and whether a licensed broker-report feed is added.
- What is the compliance line on surfacing internal research alongside external content?
- Is the first buyer a single desk or the CIO office? The cross-desk contradiction feature ([`ADVANCED.md`](./ADVANCED.md) #4) is a concrete argument for CIO sponsorship, but the decision is still open.
- Should the cross-check verifier (§10 of the LLD) use a second LLM provider, or is a single-provider verifier pass sufficient for the pilot?

---

*Decision-support tool. Not investment advice, not a trading system. All surfaced claims are citation-grounded and reproducible to source.*
