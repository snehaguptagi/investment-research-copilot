# Advanced features — beyond the MVP

**Codename:** PRISM
**Companion to:** [`PRD.md`](./PRD.md) · [`LLD.md`](./LLD.md)

These are differentiators that go past "summarize + link to holdings." Each one hangs off a component already specified in the core design, so none of them is a rewrite. They are deliberately kept out of the MVP scope and out of the core docs: the MVP has to nail the basics (grounded insight linked to holdings, the you-vs-a-normal-book comparison) and be demoably uncluttered first. These layer on top.

**Design rule for everything here:** each feature enters as a *progressive-disclosure layer*, never as new top-level noise. The insight view stays calm; depth is opt-in.

---

## Readiness at a glance

| # | Feature | Value | Buildable with current data | Compliance fit | Demoable now | Main dependency |
|---|---|---|---|---|---|---|
| 1 | Second-order read-through | Very high (the moat) | Partial | Needs "exposure flag, not prediction" framing | Partial | Licensed supply-chain data + historical notes |
| 2 | Scenario / counterfactual roll-up | High | Yes | OK as "what-if," not "forecast" | Yes | Severity assumptions |
| 3 | Thesis-drift detector | Very high (most unique) | Yes, with a notes corpus | Cleanest (self-consistency) | Yes | Internal-notes corpus |
| 4 | Cross-desk contradiction | High + strategic | Yes (reuses direction logic) | Clean (oversight) | Yes, with the 19 books | None new |

**Recommended sequence:** 4 → 3 → 2 → 1. Build outward from what is cheapest and most demoable toward what is most data-gated.

---

## 1. Second-order read-through

**What it does.** Surfaces a held name *before* any news mentions it, because news broke on something it depends on. If unheld Company X gets bad news and X supplies a large share of held Company Y's inputs, flag Y proactively.

**Why it is hard to fake.** A plain summarizer is reactive: it needs Y in the text. This is anticipatory: it walks a dependency graph from the named entity to a held one.

**How it works.** Extends the entity linker's relationship expansion ([LLD §5](./LLD.md#5-entity-linking-the-moat)) one hop further along a directed dependency graph:
- **Corporate-structure hop (ready now):** subsidiary → parent, ADR → ordinary. Our dataset already carries these test cases, so bad news on a subsidiary can flag the held parent today.
- **Supply-chain hop (gated):** X supplies N% of Y → flag Y. Requires a supply-chain relationship dataset.
- **Historical read-through lag:** from the firm's own past notes and price history, estimate how many days similar past events at X took to show up in Y. Turns "Y is exposed" into "Y is exposed, and historically this took ~5 trading days to register."

**Data dependencies.** Corporate-structure hop: none beyond the securities master. Supply-chain hop: **licensed supply-chain relationship data** (e.g. Bloomberg SPLC, FactSet). Historical lag: the firm's own historical notes + price series.

**Compliance framing.** This is the feature most at risk of sounding like prediction. It must be framed strictly as an **exposure flag** ("Y has a supply relationship to X, which just had news"), never "Y will move." The historical lag is stated as an observed past pattern, not a forecast.

**UI placement.** A distinct "anticipatory / second-order" flag on the signal, visually separated from direct hits and marked lower-confidence, so it is never confused with a first-order, in-the-news exposure.

**Status.** Corporate-structure hop: buildable now as a limited version. Supply-chain hop: roadmap, gated on licensed data. Do not promise the full version in a demo without the data behind it.

---

## 2. Scenario / counterfactual roll-up

**What it does.** Lets an analyst ask "what if this escalates" and runs the same NAV/sector math against 2–3 severity bands (e.g. downgrade → mild / moderate / severe), turning a static "here is what happened" into "here is the range of what could happen to my book."

**Why it is feasible and cheap.** The roll-up engine ([LLD §8](./LLD.md#8-portfolio-roll-up-engine)) is already deterministic, so running it three times with different severity inputs costs almost nothing and stays fully auditable.

**How it works.** Each severity band is a labeled set of assumed moves applied to the affected holdings; the deterministic engine recomputes NAV impact per band. Where the firm's historical notes contain similar past events, the bands can be anchored to how those actually resolved, stated as observed precedent.

**Data dependencies.** Severity assumptions (can start as simple labeled haircuts). Optional: historical event outcomes for grounding the bands.

**Compliance framing.** The entire feature lives or dies on framing: it is a **deterministic what-if / stress test** ("*if* these names fell X%, your NAV impact would be Y"), with **no probabilities and no "likely."** Scenario analysis framed this way is standard risk-management practice, not advice or forecasting. Every band is labeled as an assumption, not a prediction.

**UI placement.** A control *inside* an existing signal card ("what if this escalates"), expanding to the band comparison. Not a new zone.

**Status.** Buildable now. Least differentiated of the four (stress analysis exists in risk tools), but safe, cheap, and useful.

---

## 3. Thesis-drift detector

**What it does.** Tracks what an analyst has previously written about a name (their stated thesis) and flags when a new event contradicts their own prior reasoning. Example: *"You wrote this name's moat was pricing power; this earnings call shows margin compression from a price war."*

**Why it is unique.** No generic summarizer does this, because it requires the firm's own historical notes as ground truth. It is a personal consistency and accountability tool, not a news filter, which makes it sticky.

**How it works.** Internal notes are already ingested ([PRD FR-01](./PRD.md#8-functional-requirements)) and entity-linked. Per held name, the LLM extracts the analyst's stated thesis claims from their notes; when a new entity-linked event arrives, a contradiction-detection pass compares the event against those prior claims. Both the prior claim and the contradicting evidence are surfaced with citations. The verifier pattern ([LLD §7](./LLD.md#7-llm-orchestration)) guards against hallucinated contradictions.

**Data dependencies.** An **internal-notes corpus** (for the pilot, authored synthetically). No external licensed data.

**Compliance framing.** The cleanest of all four. It makes no market claim and gives no advice; it reflects the analyst's own reasoning back at them. Every flag cites both the prior note and the new source.

**UI placement.** A badge on the affected name that expands to show the prior-thesis quote vs the contradicting evidence. Not a separate feed.

**Status.** Buildable now once a notes corpus exists. The flagship differentiator; contradiction detection needs the verifier pass to control false positives.

---

## 4. Cross-desk contradiction flagging (CIO-level)

**What it does.** Flags when two desks at the same firm hold opposing exposure to the same underlying event, one positioned to benefit, one to be hurt, off the same piece of news.

**Why it is strategic.** It only exists because the system sees across the whole firm, not one book. That makes it the concrete argument for why the **CIO office (the actual buyer)** should sponsor this over a single desk, which directly answers an open question in the PRD.

**How it works.** The multi-desk model is already first-class ([LLD §3](./LLD.md#3-data-model): `Desk`, `Portfolio`). Once a signal's per-portfolio direction is computed (the direction logic in the Market Insight Pipeline), cross-desk contradiction is an aggregation: group by event, detect sign-opposition across desks, rank by combined exposure. It reuses machinery that already exists, no new models.

**Demoable today with the 19 books.** Rates-down signal: *US Tech & Semis* reads tailwind (beta 1.17, growth reprices up), *Financials/banks* reads headwind (net-interest-margin compression). Same firm, same news, opposite exposure. Oil-up signal: *GCC & MENA* (Aramco-heavy) reads tailwind while a consumer/travel-tilted book reads headwind. Real contradictions from existing data, nothing fabricated.

**Data dependencies.** None beyond what the core pipeline already produces.

**Compliance framing.** Clean, it is oversight, not advice. It reports opposing exposure; it does not tell either desk what to do.

**UI placement.** Lives in the CIO oversight view only ([PRD J4](./PRD.md#7-key-user-journeys)); invisible to a single-desk PM, so it adds zero clutter to the analyst experience.

**Status.** Buildable now, reusing the direction logic. Recommended first advanced feature to implement.

---

## Sequencing summary

1. **#4 Cross-desk contradiction** — first. Cheapest, reuses direction logic, demoable now, and it is the buyer argument.
2. **#3 Thesis-drift** — the flagship differentiator; needs a synthetic notes corpus.
3. **#2 Scenario roll-up** — easy, safe, deterministic; a natural add to the roll-up.
4. **#1 Second-order read-through** — the north star; corporate-structure hop now, supply-chain hop when licensed data is in place.

All four are held to the same non-negotiables as the core: computed not guessed, cited, no buy/sell/hold, and progressive-disclosure so the insight view never clutters.
