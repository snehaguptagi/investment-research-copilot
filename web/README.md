# PRISM web — v1 MVP

A static, zero-build web app implementing the analyst "My Book" view and the CIO "Event Lens" view from [`../docs/LLD.md`](../docs/LLD.md) and [`../docs/DESIGN.md`](../docs/DESIGN.md), running entirely client-side against the real 19-portfolio dataset. No server, no API keys, no build step — plain HTML/CSS/JS.

This is a direct JavaScript port of [`../pipeline/engine.py`](../pipeline/engine.py) (same sensitivity matrix, same strength-weighted exposure, same Lens-2 comparison, same ranking), so the web app and the Python CLI will never silently disagree on what a number means.

## Run it locally

No install needed, just a static file server (opening `index.html` directly via `file://` will hit browser CORS restrictions on the script tags in some browsers, so serve it):

```
cd web
python3 -m http.server 8420
```

Then open `http://localhost:8420`.

## Two views

- **My Book** — pick a portfolio, see its verdict, ranked signal cards (each with the you-vs-a-balanced-book comparison), and a collapsed bucket for signals that don't touch that book.
- **Event Lens (CIO view)** — pick a market signal, see every portfolio ranked by exposure, plus the cross-desk contradiction detector ([`../docs/ADVANCED.md`](../docs/ADVANCED.md) #4).

## Deploy

Zero-config static site — Vercel (or any static host) serves this directory directly:

```
cd web
vercel --prod
```

## Files

| File | Port of | What it does |
|---|---|---|
| `data.js` | `data/prism_data.json` | The dataset, embedded as a JS const (not fetched, so it works from `file://` too, and avoids a CORS round-trip) |
| `engine.js` | `pipeline/engine.py` | Direction engine, roll-up, Lens-2 comparison, ranking, contradiction detection |
| `scenarios.js` | `pipeline/scenarios.py` | The 7 hand-authored events |
| `app.js` | — | DOM rendering: the two tabs, signal cards, comparison bars, verdict text |
| `styles.css` | `docs/DESIGN.md` | The color tokens, type scale, and component patterns from the design system |

## A note on a real bug caught while wiring this up

`app.js` originally destructured `const { Book, Direction, analyzeEvent, crossDeskContradictions } = window.PrismEngine;` at its top level. Classic `<script>` tags in one document share a single global lexical scope for `let`/`const`/`class` declarations (even though they don't attach those to `window`) — so this collided with `engine.js`'s own top-level `class Book`, `const Direction`, etc., throwing `Identifier 'Book' has already been declared` and silently killing the entire script (nothing after that line ran, including the portfolio-selector population). Fixed by namespacing (`window.PrismEngine.Book`, etc.) instead of destructuring, which sidesteps the shared-scope collision entirely.
