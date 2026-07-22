// PRISM deterministic core — JS port of pipeline/engine.py.
// Same algorithm, same constants, same tests-worth of behavior. Kept as a
// faithful port (not a rewrite) so the web UI and the Python CLI never
// silently diverge on what a number means.
'use strict';

const EM_COUNTRIES = new Set([
  'IN', 'TW', 'BR', 'KR', 'AR', 'MX', 'CN', 'ZA', 'ID', 'TH',
  'PH', 'MY', 'PL', 'CL', 'CO', 'TR', 'EG',
]);

const MATERIALITY_FLOOR_PCT = 5.0;
const ATTENTION_NAV_PCT = 15.0;
const MULTIPLE_CAP = 10.0;

const Direction = { TAILWIND: 'tailwind', HEADWIND: 'headwind', MIXED: 'mixed', NONE: 'none' };
const Strength = { STRONG: 'strong', MILD: 'mild', NONE: 'none' };
const STRENGTH_WEIGHT = { strong: 1.0, mild: 0.4, none: 0.0 };
const FACTOR_TYPES = new Set(['rates', 'credit_spreads', 'oil', 'inflation', 'usd', 'risk_off', 'crypto']);

function isLongDuration(sec) {
  const name = (sec.name || '').toLowerCase();
  return ['long', '20+', '30-year', 'aggregate', 'tips', 'muni', 'municipal'].some(k => name.includes(k));
}

function isFloatingRate(sec) {
  const name = (sec.name || '').toLowerCase();
  return ['floating', 'senior loan', 'bank loan', 'short-term', '1-3'].some(k => name.includes(k));
}

// --------------------------------------------------------------------
// Direction engine (LLD Sec 7) — sensitivity matrix over real security fields
// --------------------------------------------------------------------

function factorDirection(event, sec) {
  const ac = sec.asset_class;
  const sector = sec.sector;
  const beta = sec.beta || 0.0;
  const country = sec.country;
  const credit = sec.credit_quality;
  const et = event.event_type;
  const nameLower = (sec.name || '').toLowerCase();

  let sign = 0;
  let strength = Strength.NONE;

  if (et === 'rates') {
    if (ac === 'Fixed Income') {
      if (isFloatingRate(sec)) { sign = 0; strength = Strength.NONE; }
      else if (isLongDuration(sec)) { sign = -1; strength = Strength.STRONG; }
      else { sign = -1; strength = Strength.MILD; }
    } else if (ac === 'Cash') { sign = 1; strength = Strength.MILD; }
    else if (ac === 'Real Estate') { sign = -1; strength = Strength.STRONG; }
    else if (ac === 'Equity') {
      if (sector === 'Financials') { sign = 1; strength = Strength.MILD; }
      else if (sector === 'Utilities') { sign = -1; strength = Strength.MILD; }
      else if (beta >= 1.1) { sign = -1; strength = beta >= 1.4 ? Strength.STRONG : Strength.MILD; }
      else { sign = -1; strength = Strength.MILD; }
    } else if (ac === 'Commodity' && nameLower.includes('gold')) { sign = -1; strength = Strength.MILD; }

  } else if (et === 'credit_spreads') {
    if (credit === 'HY') { sign = -1; strength = Strength.STRONG; }
    else if (credit === 'IG') { sign = -1; strength = Strength.MILD; }
    else if (ac === 'Fixed Income' && credit === 'Govt') { sign = 1; strength = Strength.MILD; }
    else if (ac === 'Equity' && (beta >= 1.2 || sec.cap_tier === 'small')) { sign = -1; strength = Strength.MILD; }

  } else if (et === 'oil') {
    if (sector === 'Energy') { sign = 1; strength = Strength.STRONG; }
    else if (ac === 'Commodity') { sign = 1; strength = Strength.MILD; }
    else if (sector === 'Consumer Discretionary' || sector === 'Industrials') { sign = -1; strength = Strength.MILD; }
    else if (ac === 'Equity') { sign = -1; strength = Strength.MILD; }

  } else if (et === 'inflation') {
    if (nameLower.includes('gold') || ac === 'Commodity') { sign = 1; strength = Strength.STRONG; }
    else if (isLongDuration(sec) && ac === 'Fixed Income') { sign = -1; strength = Strength.STRONG; }
    else if (ac === 'Equity' && beta >= 1.3) { sign = -1; strength = Strength.MILD; }

  } else if (et === 'usd') {
    if ((ac === 'Equity' || ac === 'Fixed Income') && EM_COUNTRIES.has(country)) { sign = -1; strength = Strength.STRONG; }
    else if (ac === 'Commodity') { sign = -1; strength = Strength.MILD; }
    else if (nameLower.includes('gold')) { sign = -1; strength = Strength.MILD; }

  } else if (et === 'risk_off') {
    if (ac === 'Digital Assets') { sign = -1; strength = Strength.STRONG; }
    else if (ac === 'Equity') {
      if (sector === 'Consumer Staples' || sector === 'Utilities') { sign = 1; strength = Strength.MILD; }
      else if (beta >= 1.2 || sec.cap_tier === 'small' || EM_COUNTRIES.has(country)) { sign = -1; strength = Strength.STRONG; }
      else { sign = -1; strength = Strength.MILD; }
    } else if (nameLower.includes('gold')) { sign = 1; strength = Strength.MILD; }
    else if (ac === 'Fixed Income' && credit === 'Govt') { sign = 1; strength = Strength.MILD; }

  } else if (et === 'crypto') {
    if (ac === 'Digital Assets') { sign = 1; strength = Strength.STRONG; }
    else if (sector === 'Information Technology' && beta >= 1.3) { sign = 1; strength = Strength.MILD; }
  }

  if (sign === 0) return { direction: Direction.NONE, strength: Strength.NONE };

  const moveMult = (event.move || 'up') === 'up' ? 1 : -1;
  const net = sign * moveMult;
  return { direction: net > 0 ? Direction.TAILWIND : Direction.HEADWIND, strength };
}

function holdingDirection(event, sec) {
  if (event.named_security_ids && event.named_security_ids.includes(sec.security_id)) {
    const direction = event.intrinsic_sign > 0 ? Direction.TAILWIND : Direction.HEADWIND;
    return { direction, strength: Strength.STRONG };
  }
  return factorDirection(event, sec);
}

function touches(event, sec) {
  if (event.named_security_ids && event.named_security_ids.includes(sec.security_id)) return true;
  if (event.sector && sec.sector === event.sector) return true;
  if (event.country && sec.country === event.country) return true;
  if (FACTOR_TYPES.has(event.event_type)) {
    return factorDirection(event, sec).direction !== Direction.NONE;
  }
  return false;
}

// --------------------------------------------------------------------
// The book — loads PRISM_DATA and indexes it
// --------------------------------------------------------------------

class Book {
  constructor(data) {
    this.securities = {};
    for (const s of data.securities) this.securities[s.security_id] = s;
    this.portfolios = {};
    for (const p of data.portfolios) this.portfolios[p.portfolio_id] = p;
    this.holdingsByPortfolio = {};
    for (const h of data.holdings) {
      (this.holdingsByPortfolio[h.portfolio_id] ||= []).push(h);
    }
    this.referenceId = data.portfolios.find(p => p.is_reference)?.portfolio_id || null;
  }
  sec(sid) { return this.securities[sid]; }
}

// --------------------------------------------------------------------
// Roll-up (LLD Sec 11) + aggregation
// --------------------------------------------------------------------

function aggregateDirection(signedExposure, posW, negW, totalExposure) {
  if (totalExposure === 0) return { direction: Direction.NONE, strength: Strength.NONE };
  if (posW > 0 && negW > 0 && Math.min(posW, negW) / totalExposure >= 0.25) {
    return { direction: Direction.MIXED, strength: Strength.MILD };
  }
  if (signedExposure === 0) return { direction: Direction.NONE, strength: Strength.NONE };
  const direction = signedExposure > 0 ? Direction.TAILWIND : Direction.HEADWIND;
  const intensity = Math.abs(signedExposure) / totalExposure;
  return { direction, strength: intensity >= 0.5 ? Strength.STRONG : Strength.MILD };
}

function portfolioImpact(book, event, portfolioId) {
  const p = book.portfolios[portfolioId];
  const holdings = book.holdingsByPortfolio[portfolioId] || [];

  const touched = [];
  let breadth = 0, exposure = 0, signedExposure = 0, posW = 0, negW = 0;

  for (const h of holdings) {
    const sec = book.sec(h.security_id);
    if (!touches(event, sec)) continue;
    const { direction, strength } = holdingDirection(event, sec);
    if (direction === Direction.NONE) continue;
    const w = h.weight * 100.0;
    const sw = w * STRENGTH_WEIGHT[strength];
    breadth += w;
    exposure += sw;
    touched.push({ security_id: sec.security_id, name: sec.name, weight_pct: round1(w), direction, strength });
    if (direction === Direction.TAILWIND) { signedExposure += sw; posW += sw; }
    else if (direction === Direction.HEADWIND) { signedExposure -= sw; negW += sw; }
  }

  const { direction: netDir, strength: netStrength } = aggregateDirection(signedExposure, posW, negW, exposure);
  touched.sort((a, b) => b.weight_pct - a.weight_pct);

  return {
    portfolio_id: portfolioId,
    portfolio_name: p.name,
    exposure_pct: round1(exposure),
    breadth_pct: round1(breadth),
    direction: netDir,
    direction_strength: netStrength,
    holdings: touched,
    reference_pct: null,
    multiple_label: null,
    rank_score: 0,
    needs_attention: false,
  };
}

function round1(x) { return Math.round(x * 10) / 10; }

// --------------------------------------------------------------------
// Comparison — "you vs a normal book" (LLD Sec 12)
// --------------------------------------------------------------------

function referenceExposure(book, event) {
  if (!book.referenceId) return 0.0;
  return portfolioImpact(book, event, book.referenceId).exposure_pct;
}

function addComparison(book, event, impact) {
  const refPct = referenceExposure(book, event);
  impact.reference_pct = round1(refPct);

  if (impact.exposure_pct < MATERIALITY_FLOOR_PCT || refPct <= 0.0) {
    impact.multiple_label = null;
  } else {
    const mult = impact.exposure_pct / refPct;
    if (mult >= MULTIPLE_CAP) impact.multiple_label = `${MULTIPLE_CAP}x+`;
    else if (mult >= 1.5) impact.multiple_label = `~${Math.round(mult)}x`;
    else impact.multiple_label = null;
  }
  return impact;
}

// --------------------------------------------------------------------
// Ranking & materiality (LLD Sec 8)
// --------------------------------------------------------------------

function scoreImpact(impact, event) {
  const strengthVal = { strong: 1.0, mild: 0.5, none: 0.0 }[impact.direction_strength];
  const concentration = impact.holdings.length ? Math.max(...impact.holdings.map(h => h.weight_pct)) : 0.0;

  impact.rank_score = round1(
    1.0 * impact.exposure_pct + 12.0 * strengthVal + 8.0 * event.magnitude + 0.15 * concentration
  );
  impact.needs_attention = (
    impact.exposure_pct >= ATTENTION_NAV_PCT &&
    impact.direction_strength === Strength.STRONG &&
    (impact.direction === Direction.TAILWIND || impact.direction === Direction.HEADWIND)
  );
  return impact;
}

// --------------------------------------------------------------------
// Top-level
// --------------------------------------------------------------------

function analyzeEvent(book, event, includeZero = false) {
  const results = [];
  for (const pid of Object.keys(book.portfolios)) {
    const imp = portfolioImpact(book, event, pid);
    if (imp.exposure_pct === 0 && !includeZero) continue;
    addComparison(book, event, imp);
    scoreImpact(imp, event);
    results.push(imp);
  }
  results.sort((a, b) => b.rank_score - a.rank_score);
  return results;
}

function crossDeskContradictions(impacts) {
  const tail = impacts.filter(i => i.direction === Direction.TAILWIND);
  const head = impacts.filter(i => i.direction === Direction.HEADWIND);
  const pairs = [];
  for (const t of tail) for (const h of head) pairs.push([t, h]);
  pairs.sort((a, b) => (b[0].exposure_pct + b[1].exposure_pct) - (a[0].exposure_pct + a[1].exposure_pct));
  return pairs;
}

// exported to the global scope for app.js (no bundler, no module system)
window.PrismEngine = {
  Book, Direction, Strength, analyzeEvent, crossDeskContradictions,
  portfolioImpact, holdingDirection,
};
