# Design system — PRISM

**Companion to:** [`PRD.md`](./PRD.md) · [`LLD.md`](./LLD.md) · [`ADVANCED.md`](./ADVANCED.md)

This is the visual identity for the PRISM product surface: the analyst view, the portfolio store, and the insight cards described in the LLD. It is codified from the working prototype already built for this project, not invented separately, so what's here is proven in the browser, not theoretical.

---

## Table of contents

1. [Principles](#1-principles)
2. [Color system](#2-color-system)
3. [Typography](#3-typography)
4. [Layout & spacing](#4-layout--spacing)
5. [Components](#5-components)
6. [Two surfaces, one family](#6-two-surfaces-one-family)
7. [Accessibility](#7-accessibility)
8. [Do / don't](#8-do--dont)

---

## 1. Principles

PRISM is a research instrument, not a marketing page. The design has one job: let a portfolio manager read a severity, a direction, and an exposure number correctly, in under two seconds, without the page shouting at them. Three commitments follow from that:

- **Deep canvas, not slide-deck white.** A near-black working surface reads as an instrument (a terminal, a cockpit) rather than a brochure. It also makes the risk-severity color ramp legible in a way white backgrounds wash out.
- **One accent, spent carefully.** Teal is the only "voice" color in the interface. Severity uses its own separate ramp (§2). If everything is colored, nothing is signal.
- **No traffic lights.** Red/amber/green is the default everyone reaches for and it reads as generic and slightly alarmist. PRISM uses a **teal → gold → crimson thermal ramp** instead: same job (low to high), a genuinely different, calmer read.

## 2. Color system

### Canvas & text

| Token | Swatch | Hex | Usage |
|---|---|---|---|
| `--bg` | ![](https://dummyimage.com/40x20/0C121C/0C121C.png) | `#0C121C` | Page background. Deep navy-black, not pure black — warmer, less clinical. |
| `--panel` | ![](https://dummyimage.com/40x20/141D2B/141D2B.png) | `#141D2B` | Card / panel surface, one step up from canvas. |
| `--panel2` | ![](https://dummyimage.com/40x20/0F1826/0F1826.png) | `#0F1826` | Recessed surface (table headers, hover states, nested rows). |
| `--line` | ![](https://dummyimage.com/40x20/26344A/26344A.png) | `#26344A` | Primary borders, dividers. |
| `--line2` | ![](https://dummyimage.com/40x20/1B2636/1B2636.png) | `#1B2636` | Quiet borders inside panels. |
| `--text` | ![](https://dummyimage.com/40x20/EAEFF6/EAEFF6.png) | `#EAEFF6` | Primary text. Off-white, not pure white — softer on a dark canvas. |
| `--muted` | ![](https://dummyimage.com/40x20/93A2B6/93A2B6.png) | `#93A2B6` | Secondary text (metadata, labels). |
| `--faint` | ![](https://dummyimage.com/40x20/63748A/63748A.png) | `#63748A` | Tertiary text (timestamps, captions). |

### Accent

| Token | Swatch | Hex | Usage |
|---|---|---|---|
| `--accent` | ![](https://dummyimage.com/40x20/4CC4C0/4CC4C0.png) | `#4CC4C0` | The one brand color. Links, focus states, the primary CTA, the "PRISM" wordmark. Used sparingly — it should feel considered, not decorative. |

### Severity ramp — deliberately not red/amber/green

A five-step **thermal** progression, teal (calm, low) through gold (elevated) to crimson (very high). It reads as temperature, which is a more honest metaphor for portfolio risk than a stoplight, and it doesn't carry the "something is broken" alarm that red/green does at the low end.

| Tier | Swatch | Hex | Reads as |
|---|---|---|---|
| Low | ![](https://dummyimage.com/40x20/19A89C/19A89C.png) | `#19A89C` | Cool, settled |
| Moderate | ![](https://dummyimage.com/40x20/5BAE5E/5BAE5E.png) | `#5BAE5E` | Steady |
| Elevated | ![](https://dummyimage.com/40x20/E6B93E/E6B93E.png) | `#E6B93E` | Warming up |
| High | ![](https://dummyimage.com/40x20/E5823F/E5823F.png) | `#E5823F` | Hot |
| Very High | ![](https://dummyimage.com/40x20/D64B45/D64B45.png) | `#D64B45` | Alarm |

**Rule:** this ramp is reserved *exclusively* for portfolio risk tier and signal severity. It never doubles as a decorative color elsewhere, or it stops meaning anything.

### Asset-class palette

A distinct hue per asset class, used in the exposure stacked-bar and the legend. Chosen to be distinguishable from the severity ramp (no overlap with teal-gold-crimson) and from each other at a glance:

| Class | Swatch | Hex |
|---|---|---|
| Equity | ![](https://dummyimage.com/40x20/4CC4C0/4CC4C0.png) | `#4CC4C0` |
| Fixed Income | ![](https://dummyimage.com/40x20/6E86B8/6E86B8.png) | `#6E86B8` |
| Cash | ![](https://dummyimage.com/40x20/3A4658/3A4658.png) | `#3A4658` |
| Commodity | ![](https://dummyimage.com/40x20/E6B93E/E6B93E.png) | `#E6B93E` |
| Real Estate | ![](https://dummyimage.com/40x20/C77DBB/C77DBB.png) | `#C77DBB` |
| Multi-Asset | ![](https://dummyimage.com/40x20/8891E6/8891E6.png) | `#8891E6` |
| Digital Assets | ![](https://dummyimage.com/40x20/E5823F/E5823F.png) | `#E5823F` |
| Alternatives | ![](https://dummyimage.com/40x20/7FA654/7FA654.png) | `#7FA654` |

**Note:** Commodity and Digital Assets intentionally reuse gold/orange from the severity ramp's mid-range. That's acceptable because the two systems never appear side by side describing the same thing (an asset-class legend is never shown next to a severity badge in the same glance), but if that ever changes, shift one palette rather than let the two visually collide.

### Direction (tailwind / headwind)

A separate, minimal pair, distinct from both ramps above so direction is never confused with severity:

| Direction | Swatch | Hex | Usage |
|---|---|---|---|
| Tailwind | ![](https://dummyimage.com/40x20/5BAE5E/5BAE5E.png) | `#5BAE5E` | Shares the "moderate" green — direction is calmer news than a severity alarm |
| Headwind | ![](https://dummyimage.com/40x20/E5823F/E5823F.png) | `#E5823F` | Shares "high" orange, not crimson — a headwind is a flag, not a crisis |
| Mixed | ![](https://dummyimage.com/40x20/93A2B6/93A2B6.png) | `#93A2B6` | Neutral muted gray — genuinely ambiguous, shown as such |

## 3. Typography

Three faces, each with one job. None of them is Inter, Roboto, or system-default — a deliberate choice so the product doesn't read as an unstyled dashboard template.

| Role | Face | Why |
|---|---|---|
| **Display** | [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) | Geometric, slightly technical, confident at large sizes without feeling corporate. Used for the wordmark, page headlines, portfolio names. |
| **Body** | [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) | Humanist, highly legible at small sizes, quietly professional. Used for all reading text: mandates, narratives, labels. |
| **Data / mono** | [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) | Tabular figures, timestamps, tickers, scores, API paths. Anywhere numbers need to align in a column, or where "this is data, not prose" should be visually obvious. |

**Type scale (representative):**

| Use | Face | Size | Weight |
|---|---|---|---|
| Page H1 | Space Grotesk | 28–44px (clamp) | 600 |
| Portfolio name (card) | Space Grotesk | 19px | 600 |
| Body / mandate text | IBM Plex Sans | 15–15.5px | 400 |
| Eyebrow / section label | IBM Plex Mono | 11–12px, +0.2em tracking | 500, uppercase |
| Score / metric value | IBM Plex Mono | 15–30px depending on prominence | 500–600 |
| Caption / timestamp | IBM Plex Mono | 9–11px | 400–500 |

**Rule:** if it's a number a PM will compare against another number (NAV %, risk score, weight), it is IBM Plex Mono with `font-variant-numeric: tabular-nums`. If it's a label describing what kind of number it is, it's small-caps mono with wide tracking. If it's prose, it's Plex Sans. Never mix a display face into a data context.

## 4. Layout & spacing

- **Single column, generous max-width (~1080px).** This is a reading-and-scanning instrument, not a multi-pane dashboard. One column keeps the eye's path top-to-bottom predictable.
- **Progressive disclosure over density.** The insight view (per the LLD's Market Insight Pipeline) is three zones: verdict → ranked signal cards → expandable positioning detail → a collapsed noise bucket. Never flatten all four into one dense screen.
- **Panels, not lines.** Each portfolio, each signal, is a bordered panel with its own padding, not a table row. Rows are for data *within* a panel (holdings, sources); portfolios and signals themselves get breathing room.
- **A left accent bar carries severity.** A 4px left border in the tier color is the primary way a panel communicates "how hot is this," so severity is legible even scanning quickly down a page of collapsed panels.
- **Spacing scale:** 4 / 8 / 12 / 16 / 18 / 22 / 24 / 38px, roughly a 1.3–1.5× progression. Section breaks (`shead`) get the largest gap (38px); related elements inside a panel get the smallest (4–8px).

## 5. Components

**The ladder (risk overview list).** A compact, repeated row: portfolio name + risk driver on the left, a horizontal severity rail filling proportionally to score in the middle, the numeric score + tier chip on the right. This is the "everything at a glance" view — 19 portfolios should be scannable in one scroll without opening a single one.

**The panel (expandable portfolio/signal detail).** Collapsed state: name, one-line driver/mandate, the asset-mix stacked bar, four key metrics (vol, largest class, top position, EM/HY as relevant), the big severity score. Expanded state: the holdings table. The caret rotates 180° on open — a small, honest affordance, not a novelty animation.

**Chips / badges.** Small, uppercase, mono, high letter-spacing, colored background at ~15% opacity with full-opacity text in the same hue. Used for risk tier, direction, and MoSCoW-style priority labels. Never more than one badge competing for attention per line.

**The stacked exposure bar.** A single 8–9px-tall horizontal bar, segments colored by the asset-class palette (§2), each segment's width proportional to weight. Paired with a text legend below showing class name + %. This is the fastest way to convey a portfolio's shape without a pie chart (pie charts are avoided deliberately — angular comparison is harder to read than a linear bar).

**The Lens-2 comparison bar (you vs a normal book).** Two short horizontal bars stacked tightly, same scale: "you" on top in the accent color, "reference book" below in muted gray. The absolute % is the primary label on each; the multiple ("~7x", capped at "10x+") sits as a smaller annotation to the right, never as the headline figure (see [`LLD.md` §12](./LLD.md#12-portfolio-comparison--the-you-vs-a-normal-book-lens)).

**Tables.** Reserved for genuinely tabular data (holdings, sources). Mono for numeric columns, right-aligned, `tabular-nums`. Sans for name/description columns, left-aligned. Header row uses `--panel2` background and muted mono uppercase labels.

## 6. Two surfaces, one family

Two documents in this repo were themselves rendered as styled pages during scoping ([`PRD.md`](./PRD.md)/[`LLD.md`](./LLD.md) originated as an HTML scoping doc; the portfolio demo is `prism-portfolios-extended.html`). They intentionally use **two related but distinct treatments**:

- **Product surface** (this document, the analyst/portfolio UI): dark canvas, teal accent, thermal severity ramp — described above. This is what ships to end users.
- **Documentation surface** (scoping decks, internal reports): a lighter, editorial treatment — warm off-white/cool-slate neutrals, a serif display paired with a sans body, teal/bronze accents, full light-and-dark theming. This is for artifacts read outside the product (pitch decks, internal scoping).

Both share the same discipline (one accent, a real type pairing, no generic red/green/amber, structural color with meaning), they simply serve different rooms. If a future doc needs one look or the other, default to **product surface** for anything resembling the actual application, and **documentation surface** for anything that is fundamentally a report.

## 7. Accessibility

- Primary text `#EAEFF6` on canvas `#0C121C`: contrast ratio ≈ 15.6:1 (AAA).
- Muted text `#93A2B6` on canvas: ≈ 7.9:1 (AAA for normal text).
- Accent `#4CC4C0` on canvas: ≈ 9.9:1 — safe for text, not just decoration.
- Severity colors are never the *only* signal: every tier also carries a text label ("Low"/"Elevated"/etc.), so the system doesn't rely on color perception alone.
- Focus states use a visible 2px accent outline on all interactive elements (rows, buttons, links) — never suppressed.
- Respect `prefers-reduced-motion`: transitions (rail fill, caret rotation) disable to instant when set.

## 8. Do / don't

| Do | Don't |
|---|---|
| Use the thermal ramp for severity only | Reuse thermal colors as generic decoration |
| Keep the accent to one hue, spent on the few things that matter | Add a second "brand" color to compete with teal |
| Show the absolute exposure number as primary, the multiple as secondary | Lead with a bare multiple ("7x!") with no absolute anchor |
| Let panels breathe with real padding | Compress everything into dense table rows to fit more on screen |
| Pair every severity color with a text label | Rely on color alone to convey tier |
| Use mono for anything tabular or numeric | Set numbers in the display or body face and let columns drift out of alignment |
