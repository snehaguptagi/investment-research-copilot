# PRISM deterministic core

The direction engine, roll-up, "you vs a normal book" comparison, and ranking from [`../docs/LLD.md`](../docs/LLD.md) (§§7–8, 11–12), running against the real 19-portfolio dataset. No API keys, no network calls, no dependencies beyond the Python standard library.

This is deliberately built and tested **before** the structured-API layer (Finnhub/Marketaux/GDELT), because it's the highest-risk logic in the whole design and it doesn't need to wait on anything external to prove out.

## Run it

```
cd pipeline
python run.py                    # list available scenarios
python run.py chip-controls      # ranked impact across all 19 portfolios
python run.py rate-cuts --top 6
python run.py oil-spike --contradictions   # + cross-desk opposing exposure (ADVANCED.md #4)
```

## Test it

```
python tests/test_engine.py
```

14 tests lock in the hand-verified worked examples from the design conversation — e.g. chip export controls stay sharp and concentrated in the US Tech book, a rate-cut signal produces a real ranked spread rather than saturating every portfolio to ~100%, an oil spike puts Gold & Inflation Hedge and US Tech in genuine opposition (a real cross-desk contradiction), and every comparison respects the materiality floor and the capped multiple.

## Files

| File | What it does |
|---|---|
| `engine.py` | `Event`, `Book`, the sensitivity-matrix direction engine, roll-up, Lens-2 comparison, ranking, cross-desk contradiction detection |
| `scenarios.py` | Hand-authored structured events standing in for the LLM event-classifier's output, until the API layer is wired in |
| `run.py` | CLI to run a scenario against the book |
| `tests/test_engine.py` | Regression tests against the hand-verified numbers |

## What's deliberately not here yet

Per the agreed build order: structured-API fetching (Finnhub/Marketaux/GDELT/EDGAR), signal clustering/dedup, and the LLM classification + narration + cross-check layer. Those slot in on top of this engine without changing it — the API layer's only job is to produce `Event` objects and citations; this engine already knows what to do with an `Event` once it has one.

## A known limitation, stated plainly

`_touches()` currently defines "touched" as direct linkage only (named security, matching sector, matching country, or a factor-sensitivity hit) — per the LLD's v1 scope. Supply-chain and parent/subsidiary second-order read-through ([`ADVANCED.md`](../docs/ADVANCED.md) #1) is not implemented here; it's gated on licensed relationship data as documented.
