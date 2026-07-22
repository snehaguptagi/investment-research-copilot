# LLD — Investment Research & Portfolio Insight Copilot

**Codename:** PRISM
**Status:** Draft v0.1
**Companion to:** [`PRD.md`](./PRD.md)

Low-level design for the system described in the PRD: architecture, components, data model, and the engineering plan for the two riskiest pieces (entity linking, grounded retrieval).

---

## Table of contents

1. [System architecture](#1-system-architecture)
2. [Component design](#2-component-design)
3. [Data model](#3-data-model)
4. [Ingestion pipeline](#4-ingestion-pipeline)
5. [Entity linking (the moat)](#5-entity-linking-the-moat)
6. [Retrieval & RAG](#6-retrieval--rag)
7. [LLM orchestration](#7-llm-orchestration)
8. [Portfolio roll-up engine](#8-portfolio-roll-up-engine)
9. [API surface](#9-api-surface)
10. [Evaluation harness](#10-evaluation-harness)
11. [Tech stack & ops](#11-tech-stack--ops)

---

## 1. System architecture

A layered pipeline: sources flow through ingestion into a knowledge layer that is enriched with holdings context at index time, so "what affects my book" is a first-class filter rather than a post-hoc computation.

```
Sources
  ├─ Transcripts (earnings calls)
  ├─ Filings (EDGAR / exchange)
  ├─ News API (market commentary)
  └─ Internal notes (tenant uploads)
        │
        ▼
Ingestion & enrichment
  ├─ Loaders + normaliser        — common doc schema, dedupe
  ├─ Entity linker  ★            — mentions → holdings (the moat)
  └─ Chunk + embed               — finance-tuned chunking
        │
        ▼
Knowledge layer
  ├─ Vector store                — chunks + holding/sector metadata
  └─ Portfolio store             — holdings, weights, exposures, factors
        │
        ▼
Reasoning & orchestration
  ├─ Retriever                   — hybrid + entitlement filter
  ├─ LLM orchestrator  ★         — summarise · link · answer · verify
  └─ Roll-up engine              — NAV impact, sector, risk
        │
        ▼
Experience
  ├─ Analyst dashboard           — events, summaries, Q&A
  ├─ Digest / alerts             — scheduled + push
  └─ CIO oversight               — firm-wide heatmap
```

## 2. Component design

| Component | Responsibility | Key decisions |
|---|---|---|
| Ingestion service | Fetch, parse, normalise, dedupe source documents | Pluggable loaders per source; idempotent; near-dup detection by minhash |
| Entity linker | Resolve mentions to the firm's securities master | Hybrid: symbolic dictionary/gazetteer first, LLM disambiguation on ambiguity; confidence scored |
| Indexer | Chunk, embed, and attach holding/sector metadata | Metadata written at index time so linkage is a filter, not a join at query time |
| Retriever | Fetch relevant chunks under entitlement | Hybrid dense + keyword; entitlement + fund/date filters applied pre-rank |
| Orchestrator | Summarise, link, answer, and verify claims | Tiered models; verifier pass rejects ungrounded claims |
| Roll-up engine | Compute NAV impact, sector and factor exposure | Deterministic, not LLM; reads from portfolio store |
| Digest/alert service | Scheduled digests and threshold alerts | Per-user materiality thresholds |
| Audit service | Immutable log of queries, sources, outputs | Append-only; feeds compliance review |

## 3. Data model

Core entities. Portfolio, desk, and entitlement are first-class from day one to support multi-desk GCC delivery.

```
# Security master (linkage target)
Security { security_id, primary_ticker, name, aliases[], isin,
           parent_id?, adr_of?, sector, industry, country }

# Portfolio holdings, per desk
Holding  { holding_id, portfolio_id, security_id, weight,
           market_value, as_of_date }
Portfolio{ portfolio_id, desk_id, name, base_ccy, mandate }
Desk     { desk_id, tenant_id, name }

# Ingested content
Document { doc_id, source_type, title, published_at, url,
           tenant_scope, raw_text, checksum }
Chunk    { chunk_id, doc_id, span, text, embedding,
           linked_security_ids[], sectors[], link_confidence }

# Derived insight
Insight  { insight_id, event_key, summary, claims[],
           affected_holdings[], nav_impact_pct, created_at }
Claim    { claim_id, text, source_doc_id, source_span,
           faithfulness_score }

# Access & audit
Entitlement{ user_id, desk_id, source_types[], portfolio_ids[] }
AuditEvent { event_id, user_id, action, query, shown_sources[], ts }
```

## 4. Ingestion pipeline

1. **Fetch.** Source-specific loaders pull raw content on schedule or webhook. Idempotent by checksum.
2. **Parse & normalise.** Convert to the common `Document` schema; strip boilerplate; extract publish date and title.
3. **Dedupe.** Near-duplicate detection (minhash/shingling) collapses the same story across wires into one `event_key`.
4. **Entity link.** Run the linker (§5); attach `linked_security_ids` and confidence.
5. **Chunk & embed.** Finance-aware chunking that keeps tables and speaker turns intact; embed; write holding/sector metadata onto each chunk.
6. **Index.** Upsert into the vector store; emit an ingest event for downstream digest/alert.

## 5. Entity linking (the moat)

This is the riskiest and most valuable component. A hybrid design balances precision and cost:

1. **Candidate generation (symbolic).** A gazetteer built from the securities master (names, tickers, aliases, common misspellings) does a high-recall first pass. Cheap and deterministic.
2. **Disambiguation (LLM, only when needed).** When a mention is ambiguous (shared names, ticker collisions, parent vs subsidiary), an LLM resolves it using surrounding context. Reserved for the hard cases to control cost.
3. **Relationship expansion.** Resolve subsidiary-to-parent, ADR-to-ordinary, and supply-chain adjacency so an event on a private supplier can still flag a held customer.
4. **Confidence + fail-closed.** Each link carries a score. Below threshold, the insight is shown without the holding link and the uncertainty is surfaced, never a confident guess.

> **Phase-0 gate:** Prove this on 20 hand-labelled documents before building any UI. Target > 90% precision. If it fails here, the value proposition shifts and the roadmap must adapt.

## 6. Retrieval & RAG

- **Hybrid retrieval.** Dense (embeddings) + sparse (keyword/BM25) to catch both semantic and exact-ticker matches.
- **Pre-rank filtering.** Entitlement, fund, entity, and date filters applied before ranking, so results are always in-scope and permitted.
- **Portfolio-scoped retrieval.** Because chunks carry `linked_security_ids`, "insights about my holdings" is a metadata filter, cheap and exact.
- **Re-ranking.** Cross-encoder or LLM re-rank on the shortlist for precision on the final context window.
- **Citation binding.** Every retrieved chunk keeps its `doc_id` + `span` so the generator can cite exactly.

## 7. LLM orchestration

Tiered model routing keeps cost sane without sacrificing the reasoning that matters.

| Task | Model tier | Why |
|---|---|---|
| Bulk document summarisation | Fast / cheaper tier | High volume, low reasoning depth |
| Entity disambiguation | Mid tier | Context reasoning on hard cases only |
| Book-linked reasoning & Q&A | Top tier (Opus-class) | The judgement step users trust |
| Claim verification | Mid / top tier | Checks each claim against its source span |

**Grounding & verification loop**
1. Generate answer with inline citations bound to retrieved spans.
2. Verifier pass checks each claim is supported by its cited span; unsupported claims are dropped.
3. If coverage drops below threshold, respond with what is supported and flag the gap rather than filling it.

## 8. Portfolio roll-up engine

Deliberately **deterministic, not LLM-driven**. Given an event with linked securities, it computes, from the portfolio store:

- **Affected holdings** and each position's weight.
- **NAV impact** = sum of weights of touched held names, per fund.
- **Sector / geography breakdown** of the exposure.
- **Risk shifts** (Should tier): concentration and factor-tilt deltas implied by the event.

Keeping this arithmetic outside the LLM makes the numbers exact, reproducible, and auditable. The LLM narrates them; it does not compute them.

## 9. API surface

```
POST /ingest                    # queue a document or source pull
GET  /events?fund=&since=       # material events, ranked by NAV impact
GET  /events/{id}               # cited summary + affected holdings
POST /ask                       # grounded Q&A; body: query + filters
GET  /holdings/{fund}/insights  # book-scoped feed
GET  /digest/{user_id}          # personalised digest
POST /alerts/rules              # set materiality thresholds
GET  /oversight/heatmap         # CIO firm-wide exposure view
GET  /audit?user=&range=        # compliance audit trail
```

Every response that carries a claim also carries its citations (`doc_id`, `span`, `url`) and, where relevant, a `link_confidence`.

## 10. Evaluation harness

Trust is measurable, so measure it continuously. The eval set is versioned and grows with each pilot finding.

| Eval | Method | Gate |
|---|---|---|
| Linkage precision/recall | Hand-labelled mention→holding set | Precision > 92% |
| Citation faithfulness | Claim vs cited span, LLM-judge + spot human audit | > 98% |
| Summary quality | Rubric scoring on a fixed doc set | Human-acceptable > 90% |
| Hallucination rate | Injected unanswerable questions | Refusal > 95% |
| Latency & cost | Load test on representative corpus | Meets PRD non-functional requirements |

## 11. Tech stack & ops

**Prototype stack**
- Language: Python
- UI: Streamlit (fast to a demo)
- LLM: Claude, tiered (Opus-class for reasoning)
- Vector store: Chroma / FAISS
- Portfolio store: SQLite/Postgres
- Orchestration: lightweight Python services

**Production evolution**
- UI: React/typed web app for entitlements & scale
- Vector store: managed, multi-tenant
- Data: Postgres + object storage, tenant-isolated
- Ingestion: queue-based workers, independent scaling
- Observability: eval dashboards, cost + latency tracing
- Deploy: tenant-isolated, configurable residency

---

*Decision-support tool. Not investment advice, not a trading system. All surfaced claims are citation-grounded and reproducible to source.*
