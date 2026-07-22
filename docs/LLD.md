# LLD — Investment Research & Portfolio Insight Copilot

**Codename:** PRISM
**Status:** Draft v0.2
**Companion to:** [`PRD.md`](./PRD.md) · [`ADVANCED.md`](./ADVANCED.md) · [`DESIGN.md`](./DESIGN.md)

Low-level design: architecture, components, data model, the market-insight pipeline (data sourcing, signal construction, direction, ranking), and the you-vs-a-normal-book comparison.

---

## Table of contents

1. [System architecture](#1-system-architecture)
2. [Component design](#2-component-design)
3. [Data model](#3-data-model)
4. [Market data & news architecture](#4-market-data--news-architecture)
5. [Ingestion & signal construction](#5-ingestion--signal-construction)
6. [Entity linking](#6-entity-linking)
7. [Direction engine](#7-direction-engine)
8. [Ranking & materiality](#8-ranking--materiality)
9. [Retrieval & RAG](#9-retrieval--rag)
10. [LLM orchestration](#10-llm-orchestration)
11. [Portfolio roll-up engine](#11-portfolio-roll-up-engine)
12. [Portfolio comparison — the "you vs a normal book" lens](#12-portfolio-comparison--the-you-vs-a-normal-book-lens)
13. [API surface](#13-api-surface)
14. [Evaluation harness](#14-evaluation-harness)
15. [Tech stack & ops](#15-tech-stack--ops)

---

## 1. System architecture

A layered pipeline. Structured market-data and news APIs form the spine; the LLM sits on top for classification, narration, and cross-checking, never for fetching. The knowledge layer is enriched with holdings context at index time, so "what affects my book" is a first-class filter.

```
Sources (structured APIs — not scraping)
  ├─ Finnhub          — company news (ticker-tagged) + fundamentals
  ├─ Marketaux        — news + sentiment (independent second source)
  ├─ GDELT            — global political / macro / event coverage
  ├─ SEC EDGAR        — filings (primary source, official)
  └─ Internal notes   — tenant uploads (thesis ground truth)
        │
        ▼
Ingestion & signal construction
  ├─ Fetch + cache (rate-limit aware)     — local store, no re-scrape
  ├─ Dedup (minhash) → cluster            — many articles → one signal
  ├─ Entity linker  ★                     — API ticker tags + LLM for hard cases
  └─ Event classifier (LLM)               — {type, subject, move, sign}
        │
        ▼
Knowledge layer
  ├─ Vector store        — chunks + holding/sector metadata
  ├─ Signal store        — clustered signals + citations
  └─ Portfolio store     — holdings, weights, exposures, factors
        │
        ▼
Reasoning & orchestration (deterministic core, LLM narration)
  ├─ Direction engine    — sensitivity matrix (code, auditable)
  ├─ Roll-up engine      — NAV impact, sector, risk (code)
  ├─ Comparison engine   — you vs a reference book (code)
  ├─ Ranking             — exposure-primary score (code)
  └─ LLM: classify · narrate · cross-check verify
        │
        ▼
Experience
  ├─ Analyst view        — verdict → signal cards → positioning
  ├─ Digest / alerts     — scheduled + push
  └─ CIO oversight       — firm-wide heatmap + cross-desk contradiction
```

## 2. Component design

| Component | Responsibility | Key decisions |
|---|---|---|
| Source connectors | Pull news/fundamentals/filings from structured APIs | One adapter per provider; API keys via env; never a scraper |
| Cache / dedup store | Hold fetched content, respect rate limits, collapse wire copies | Local SQLite; minhash near-dup detection; idempotent by checksum |
| Signal builder | Cluster articles into signals | Key = event-type + primary entity + rolling time window |
| Entity linker | Resolve mentions to the securities master | **API ticker tags first (deterministic)**, LLM only for ambiguity; confidence scored |
| Event classifier | Turn an article into a structured event | LLM → `{event_type, subject, move, named_entities, intrinsic_sign}` |
| Direction engine | Per-holding + per-portfolio direction | Deterministic sensitivity matrix over security fields; no LLM in the math |
| Roll-up engine | NAV impact, sector, factor exposure | Deterministic; reads portfolio store |
| Comparison engine | Exposure vs a reference book | Deterministic; absolute-first, capped multiple |
| Ranking | Order signals by relevance to the book | Transparent weighted score, exposure-primary |
| Orchestrator | Classify, narrate, verify | Tiered models; cross-check verifier before display |
| Audit service | Immutable log of queries, sources, outputs | Append-only; feeds compliance |

## 3. Data model

Core entities. Portfolio, desk, and entitlement are first-class from day one to support multi-desk GCC delivery. `Signal` and the direction/exposure fields are added for the insight pipeline.

```
# Security master (linkage target)
Security { security_id, primary_ticker, name, aliases[], isin,
           parent_id?, adr_of?, sector, industry, country,
           asset_class, instrument_type, beta, credit_quality }

# Portfolio holdings, per desk
Holding  { holding_id, portfolio_id, security_id, weight,
           market_value, as_of_date }
Portfolio{ portfolio_id, desk_id, name, base_ccy, mandate, is_reference? }
Desk     { desk_id, tenant_id, name }

# Ingested content and clustered signals
Document { doc_id, source, source_url, title, published_at,
           tenant_scope, raw_snippet, checksum }
Signal   { signal_id, event_type, subject, move, intrinsic_sign,
           member_doc_ids[], distinct_sources, first_seen, last_seen,
           linked_security_ids[], link_confidence }

# Derived, per (signal, portfolio)
Impact   { signal_id, portfolio_id, pct_nav_touched, direction,
           direction_strength, matched_holdings[], rank_score,
           vs_reference_pct, vs_reference_multiple }

# Access & audit
Entitlement{ user_id, desk_id, source_types[], portfolio_ids[] }
AuditEvent { event_id, user_id, action, query, shown_sources[], ts }
```

## 4. Market data & news architecture

The data spine is **structured APIs, not LLM web search and not scraping.** LLM search alone is non-deterministic, unsortable, gives no structured fields, and cannot reliably diversify sources. Structured APIs return ticker tags, timestamps, sentiment, and source metadata that the rest of the pipeline depends on.

**Layered, provider-diverse, free-tier-first:**

| Layer | Purpose | Provider(s) | Free tier |
|---|---|---|---|
| Securities master + fundamentals | Ground-truth ticker/company/sector universe | Finnhub; SEC EDGAR | Finnhub ~60/min; EDGAR free |
| Financial news (ticker-tagged) | Core signal feed, pre-linked to tickers, with sentiment | Finnhub company-news; Marketaux; Alpha Vantage | Finnhub 60/min; Marketaux 100/day; AV 25/day |
| Macro / political / global events | Non-financial domains (policy, geopolitics) | GDELT; NewsData / GNews | GDELT effectively free; small daily tiers |
| Official filings | Primary-source depth (10-K, 8-K, 13F, Form 4) | SEC EDGAR | Free, official |
| Synthesis | Narration, dedup reasoning, comparison wording | Claude (optionally a second provider for cross-check) | Metered |

**Why this beats LLM-only sourcing:**
- **Ticker-tagged news gives entity linking a deterministic backbone** (see §6). The primary linkage signal is a structured field, not an LLM guess.
- **Diversity is structural.** We query by ticker, by category, and by source independently, then dedupe by story, rather than prompting an LLM to "vary its sources."
- **Rate limits are handled by caching** (§5), so free tiers are pilot-grade sufficient. Production scales onto paid tiers with no architecture change.

**Licensing note:** news APIs permit headline + snippet + link with attribution; full-article storage generally is not permitted, which matches the "cite, don't reproduce" rule already in the design.

## 5. Ingestion & signal construction

1. **Fetch + cache.** Source adapters pull on schedule; results are cached in the local store to respect rate limits and avoid re-fetching. Idempotent by checksum.
2. **Pre-dedup.** Collapse near-identical wire copies (same AP story across sites) by title/text minhash into one `Document`.
3. **Cluster into signals.** Group documents into a `Signal` by key = `(event_type, primary_subject/entity, rolling_window)` (window ~48–72h), using the API ticker tags + the event classifier output as the structured clustering key. A document touching multiple entities can join multiple signals (multi-label).
4. **Attach provenance.** Each signal carries its member documents (the citation list), distinct-source count (powers the diversity check), and first/last-seen timestamps (freshness).
5. **Link + classify.** Run entity linking (§6) and event classification; attach `linked_security_ids`, confidence, and `{event_type, subject, move, intrinsic_sign}`.
6. **Index.** Upsert chunks + holding/sector metadata into the vector store; write the signal to the signal store; emit an event for downstream digest/alert.

## 6. Entity linking

Hybrid, and now anchored by structured data:

1. **API ticker tags (primary, deterministic).** Ticker-tagged news APIs (Finnhub, Marketaux, Alpha Vantage) already return the securities a story is about. This is the primary linkage signal and it is not a guess.
2. **Gazetteer candidate generation.** For sources without tags (GDELT, filings, internal notes), a gazetteer built from the securities master (names, tickers, aliases) does a high-recall pass.
3. **LLM disambiguation (hard cases only).** Ticker collisions, shared names, parent vs subsidiary. Reserved for ambiguity, to control cost.
4. **Relationship expansion.** Subsidiary → parent, ADR → ordinary. (Supply-chain adjacency is a roadmap extension; see [`ADVANCED.md`](./ADVANCED.md) #1.)
5. **Confidence + fail-closed.** Each link is scored; below threshold, the signal shows without the holding link and the uncertainty is surfaced, never a confident guess.

> **Phase-0 gate:** validate linking on a hand-labelled set before building UI. Target > 90% precision. Ticker tags materially de-risk this vs an LLM-only approach.

## 7. Direction engine

Direction (tailwind / headwind) is **relational**: a property of the *(event, holding)* pair, computed from the holding's attributes, never read off article sentiment. Two cases:

- **Event names a held security:** the event's own sign applies to that name (article sentiment is valid here).
- **Event is a factor/theme:** a **sensitivity matrix** maps the factor move to each holding via its attributes.

**Sensitivity matrix (over real security fields):**

| Event | Positive for | Negative for | Driving field |
|---|---|---|---|
| Rates ↑ | Financials; cash; floating-rate | Long-duration bonds; REITs; growth/high-beta; utilities; gold | `beta`, `credit_quality`, `asset_class`, duration |
| Rates ↓ | Long-duration bonds; REITs; growth | Financials (margin) | same, flipped |
| Credit spreads widen | Govt bonds | HY credit; leveraged/small-cap equity | `credit_quality`, `hy_credit_pct` |
| Oil ↑ | Energy; commodities; inflation-linked | Airlines/consumer disc; broad equity (mild) | `sector`, industry |
| Inflation ↑ | Gold; commodities; TIPS; value | Long nominal bonds; growth | `asset_class`, `sector`, `beta` |
| USD ↑ | US domestic | EM equity/debt; commodities; non-USD | `country`, `em_pct` |
| Risk-off | Staples; utilities; gold; govt bonds | High-beta; small-cap; crypto; EM | `beta`, `asset_class`, `cap_tier` |
| Regional shock (country X) | context-dependent | Holdings with `country=X` | `country` |
| Sector event (sector S) | / | Holdings with `sector=S` (per intrinsic sign) | `sector` |
| Crypto cycle | Digital Assets (same sign) | (spillover to high-beta tech) | `asset_class` |

**Aggregation.** Per holding: sign + coarse strength (strong/mild), scaled by e.g. `beta` or duration. Per portfolio: weight-sum. When both signs carry material weight → **mixed**, surfaced as such rather than a forced arrow.

**Division of labor.** LLM classifies the event and narrates; **code** computes every direction. Deterministic and auditable.

## 8. Ranking & materiality

Rank is computed **per (signal, portfolio)**, so the same signal ranks differently across books. The score is transparent, not a black box:

```
rank = w1·(% NAV exposed)        ← primary driver
     + w2·(direction strength)
     + w3·(event magnitude)       ← e.g. oil +8% > +1%, when available
     + w4·(concentration bump)    ← exposure in one large name
     + w5·(freshness decay)
     + w6·(source corroboration)  ← more independent outlets
```

- **"Needs attention"** = `% NAV exposed > 15%` AND direction strength strong AND confidence ≥ medium.
- Ranking is the clutter filter: only signals above a per-portfolio relevance floor appear as cards; the rest collapse into a "N other signals, none material to your book" bucket.

## 9. Retrieval & RAG

- **Hybrid retrieval.** Dense (embeddings) + sparse (keyword/BM25) for both semantic and exact-ticker matches.
- **Pre-rank filtering.** Entitlement, fund, entity, and date filters applied before ranking.
- **Portfolio-scoped retrieval.** Chunks carry `linked_security_ids`, so "insights about my holdings" is a metadata filter, cheap and exact.
- **Re-ranking.** Cross-encoder or LLM re-rank on the shortlist.
- **Citation binding.** Every chunk keeps `doc_id` + source URL so the generator cites exactly.

## 10. LLM orchestration

Tiered routing keeps cost sane. The LLM classifies and narrates; it never computes exposure or direction.

| Task | Model tier | Why |
|---|---|---|
| Bulk summarisation | Fast / cheaper tier | High volume, low reasoning depth |
| Event classification | Mid tier | Article → structured event object |
| Entity disambiguation | Mid tier | Hard cases only |
| Book-linked narration & Q&A | Top tier (Opus-class) | The judgement-adjacent wording users read |
| Cross-check verification | Second model / top tier | Independent check before display |

**Grounding & cross-check loop:**
1. Generate the narrative with inline citations bound to source snippets.
2. **Cross-check verifier** (optionally a *different* provider) confirms every claim is grounded in its cited source and contains no buy/sell/hold language, before the user sees it. Using a second provider here turns "two LLMs" from needless complexity into a real guardrail.
3. If grounding coverage drops below threshold, show what is supported and flag the gap rather than filling it.

## 11. Portfolio roll-up engine

Deliberately **deterministic, not LLM-driven**. Given a signal with linked securities, it computes from the portfolio store:

- **Affected holdings** and each position's weight.
- **NAV impact** = sum of weights of touched held names, per fund.
- **Sector / geography breakdown** of the exposure.
- **Risk shifts** (Should tier): concentration and factor-tilt deltas.

Keeping this arithmetic outside the LLM makes the numbers exact, reproducible, and auditable. The LLM narrates them; it does not compute them.

## 12. Portfolio comparison — the "you vs a normal book" lens

The centerpiece comparison. A signal is meaningless in the abstract; it only matters relative to what you hold. Three lenses, capped at three to avoid a number-wall:

- **Lens 1 — Signal → your holdings.** Which of your names, at what weight, and % NAV touched (the roll-up, §11).
- **Lens 2 — You vs a normal book (centerpiece).** % of *your* NAV in the affected names vs % of a **reference book's** NAV in the same names, both computed by the identical engine.
- **Lens 3 — Across your other books.** One signal, every portfolio it touches, ranked (CIO / multi-book only).

**The reference book.** Default: a fixed, named **balanced 60/40** computed on a real reference portfolio (`is_reference` flag on `Portfolio`). Switchable later; the default must be one line a PM instantly trusts.

**We compare exposure, not returns.** "You hold more of what this touches," never "you will lose more." This keeps the lens out of advice and out of return-prediction.

**Presentation rules:**
- **Absolute-first.** Primary number is the absolute exposure ("38% of your NAV"). The multiple ("~7x a balanced book") rides underneath.
- **Cap the multiple.** Past 10x it reads as "10x+", never a false-precise "12x".
- **Materiality floor.** Below 5% of NAV, drop the multiple; keep the fact.
- **Cuts both ways.** Under-exposure is narrated as confidently as over-exposure ("insulated: 0% where a balanced book carries 4%").
- **Direction always paired with magnitude.** Never a bare multiple.

## 13. API surface

```
POST /ingest                    # queue a source pull
GET  /signals?fund=&since=      # ranked signals for a portfolio
GET  /signals/{id}             # cited signal + affected holdings + direction
GET  /signals/{id}/compare?fund=   # Lens-2 you-vs-reference for a book
POST /ask                       # grounded Q&A; body: query + filters
GET  /holdings/{fund}/insights  # book-scoped feed
GET  /digest/{user_id}          # personalised digest
POST /alerts/rules              # set materiality thresholds
GET  /oversight/heatmap         # CIO firm-wide exposure view
GET  /oversight/contradictions  # cross-desk opposing exposure (see ADVANCED.md #4)
GET  /audit?user=&range=         # compliance audit trail
```

Every response carrying a claim also carries its citations (`source_url`, snippet) and, where relevant, `link_confidence`.

## 14. Evaluation harness

Trust is measurable, so measure it continuously. The eval set is versioned and grows with each pilot finding.

| Eval | Method | Gate |
|---|---|---|
| Linkage precision/recall | Hand-labelled mention→holding set | Precision > 92% |
| Direction correctness | Hand-labelled (event, holding) → direction | > 90% |
| Citation faithfulness | Claim vs cited source, LLM-judge + spot human audit | > 98% |
| Signal dedup quality | Are distinct signals actually distinct? | Human-acceptable > 90% |
| No-advice compliance | Scan outputs for buy/sell/hold language | 100% clean |
| Hallucination rate | Injected unanswerable questions | Refusal > 95% |
| Latency & cost | Load test on representative corpus | Meets PRD non-functional requirements |

## 15. Tech stack & ops

**Prototype stack**
- Language: Python
- UI: Streamlit (fast to a demo)
- Data providers: Finnhub (spine), Marketaux, GDELT, SEC EDGAR
- LLM: Claude, tiered (Opus-class for reasoning); optional second provider for the cross-check verifier
- Cache / signal / portfolio store: SQLite
- Vector store: Chroma / FAISS
- Secrets: API keys via environment / local `.env`, never committed

**Production evolution**
- UI: React/typed web app for entitlements & scale
- Data: paid API tiers as volume grows (no architecture change); Postgres + object storage, tenant-isolated
- Vector store: managed, multi-tenant
- Ingestion: queue-based workers, independent scaling
- Observability: eval dashboards, cost + latency tracing
- Deploy: tenant-isolated, configurable residency

---

*Decision-support tool. Not investment advice, not a trading system. Every number is computed, not guessed; every claim is cited and reproducible to source.*
