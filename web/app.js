'use strict';

// NOTE: deliberately not destructured — engine.js declares top-level
// `class Book`, `const Direction`, etc. in the shared classic-script global
// scope, and destructuring the same names here throws "already declared".
// Namespacing avoids that collision entirely.
const book = new window.PrismEngine.Book(PRISM_DATA);

const AC_COLOR = {
  'Equity': '#4CC4C0', 'Fixed Income': '#6E86B8', 'Cash': '#3A4658', 'Commodity': '#E6B93E',
  'Real Estate': '#C77DBB', 'Multi-Asset': '#8891E6', 'Digital Assets': '#E5823F', 'Alternatives': '#7FA654',
};
const TIER_COLOR = { 'Low': '#19A89C', 'Moderate': '#5BAE5E', 'Elevated': '#E6B93E', 'High': '#E5823F', 'Very High': '#D64B45' };
const DIR_LABEL = { tailwind: 'TAILWIND', headwind: 'HEADWIND', mixed: 'MIXED', none: '—' };
const DIR_CLASS = { tailwind: 'dir-tailwind', headwind: 'dir-headwind', mixed: 'dir-mixed', none: '' };

document.getElementById('asof').textContent = `as of ${PRISM_DATA.meta?.date || new Date().toISOString().slice(0, 10)}`;

// ---------------------------------------------------------------- tabs
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const which = btn.dataset.tab;
    document.getElementById('tab-mybook').style.display = which === 'mybook' ? '' : 'none';
    document.getElementById('tab-eventlens').style.display = which === 'eventlens' ? '' : 'none';
  });
});

// ---------------------------------------------------------------- portfolio selector
const portfolioSelect = document.getElementById('portfolioSelect');
const sortedPortfolios = Object.values(book.portfolios).sort((a, b) => a.name.localeCompare(b.name));
for (const p of sortedPortfolios) {
  const opt = document.createElement('option');
  opt.value = p.portfolio_id;
  opt.textContent = p.name;
  portfolioSelect.appendChild(opt);
}
portfolioSelect.value = 'pf_us_tech';
portfolioSelect.addEventListener('change', () => renderMyBook(portfolioSelect.value));

// ---------------------------------------------------------------- event picker
const eventPicker = document.getElementById('eventPicker');
let activeScenario = 'oil-spike';
for (const key of Object.keys(PRISM_SCENARIOS)) {
  const btn = document.createElement('button');
  btn.className = 'ev-btn' + (key === activeScenario ? ' active' : '');
  btn.textContent = PRISM_SCENARIOS[key].subject;
  btn.dataset.key = key;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ev-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeScenario = key;
    renderEventLens(activeScenario);
  });
  eventPicker.appendChild(btn);
}

// ---------------------------------------------------------------- shared: asset mix bar
function assetMixHtml(riskEntry) {
  const mix = riskEntry.asset_mix || {};
  const segs = Object.entries(mix).map(([cls, pct]) =>
    `<i style="width:${pct}%;background:${AC_COLOR[cls] || '#666'}" title="${cls}: ${pct}%"></i>`
  ).join('');
  const key = Object.entries(mix).map(([cls, pct]) =>
    `<b><span class="sw" style="background:${AC_COLOR[cls] || '#666'}"></span>${cls} ${pct}%</b>`
  ).join('');
  return `<div class="expo">${segs}</div><div class="expo-key">${key}</div>`;
}

function compareBarsHtml(impact) {
  const maxScale = Math.max(impact.exposure_pct, impact.reference_pct, 10);
  const youW = (impact.exposure_pct / maxScale) * 100;
  const refW = (impact.reference_pct / maxScale) * 100;
  const multipleHtml = impact.multiple_label ? `<span class="compare-multiple">${impact.multiple_label} a balanced book</span>` : '';
  return `
    <div class="compare-wrap">
      <div class="compare-bar-row">
        <span class="compare-label">You</span>
        <div class="compare-track"><div class="compare-fill you" style="width:${youW}%"></div></div>
        <span class="compare-pct">${impact.exposure_pct}%</span>
      </div>
      <div class="compare-bar-row">
        <span class="compare-label">Balanced</span>
        <div class="compare-track"><div class="compare-fill ref" style="width:${refW}%"></div></div>
        <span class="compare-pct">${impact.reference_pct}%</span>
      </div>
      ${multipleHtml}
    </div>`;
}

function holdingsPreviewHtml(impact) {
  const top = impact.holdings.slice(0, 4)
    .map(h => `<b>${h.name.replace(/\s*\(.*?\)\s*/g, ' ').trim()}</b> ${h.weight_pct}%`)
    .join(', ');
  return top ? `<div class="holdings-preview">Holdings: ${top}</div>` : '';
}

function signalCardHtml(scenarioKey, event, impact) {
  const tierColor = impact.direction === 'headwind' ? 'var(--headwind)'
    : impact.direction === 'tailwind' ? 'var(--tailwind)' : 'var(--mixed)';
  const attn = impact.needs_attention ? '<span class="attn-badge">Needs attention</span>' : '';
  return `
    <div class="signal" style="--tier:${tierColor}">
      <div class="signal-top">
        <h3 class="signal-subject">${event.subject}</h3>
        <span class="dir-badge ${DIR_CLASS[impact.direction]}">${DIR_LABEL[impact.direction]}</span>
        ${attn}
      </div>
      <div class="exposure-row">
        <span class="exposure-value">${impact.exposure_pct}%</span>
        <span class="exposure-label">of your NAV (strength-weighted exposure)</span>
      </div>
      ${compareBarsHtml(impact)}
      ${holdingsPreviewHtml(impact)}
    </div>`;
}

// ---------------------------------------------------------------- My Book tab
function verdictHtml(touched) {
  if (touched.length === 0) {
    return `<span class="k">Verdict</span>None of today's tracked signals touch this book. Quiet week.`;
  }
  const attnCount = touched.filter(t => t.impact.needs_attention).length;
  const tail = touched.filter(t => t.impact.direction === 'tailwind').length;
  const head = touched.filter(t => t.impact.direction === 'headwind').length;
  let net = 'mixed';
  if (tail > head) net = 'net tailwind';
  else if (head > tail) net = 'net headwind';
  const attnText = attnCount > 0 ? ` ${attnCount} need${attnCount === 1 ? 's' : ''} attention.` : '';
  return `<span class="k">Verdict</span>${touched.length} signal${touched.length === 1 ? '' : 's'} touch your book this week. ${net}.${attnText}`;
}

function renderMyBook(portfolioId) {
  const p = book.portfolios[portfolioId];
  const risk = PRISM_DATA.risk[portfolioId];

  const rows = Object.keys(PRISM_SCENARIOS).map(key => {
    const event = PRISM_SCENARIOS[key];
    const impacts = window.PrismEngine.analyzeEvent(book, event, true);
    const impact = impacts.find(i => i.portfolio_id === portfolioId);
    return { key, event, impact };
  });
  const touched = rows.filter(r => r.impact.exposure_pct > 0).sort((a, b) => b.impact.rank_score - a.impact.rank_score);
  const untouched = rows.filter(r => r.impact.exposure_pct === 0);

  const header = `
    <div class="pf-header">
      <h2>${p.name}<span class="risk-chip" style="background:color-mix(in srgb, ${TIER_COLOR[risk.risk_tier]} 20%, transparent); color:${TIER_COLOR[risk.risk_tier]}">${risk.risk_tier}</span></h2>
      <div class="pf-meta">${p.risk_driver} &middot; risk score ${risk.risk_score} &middot; est. vol ${risk.est_vol}% &middot; ${risk.num_holdings} holdings</div>
      <p class="pf-mandate">${p.mandate}</p>
      ${assetMixHtml(risk)}
    </div>`;

  const verdict = `<div class="verdict">${verdictHtml(touched)}</div>`;

  const cardsHeading = touched.length ? `<div class="shead">Signals touching your book</div>` : '';
  const cards = touched.map(r => signalCardHtml(r.key, r.event, r.impact)).join('');

  const noiseList = untouched.map(r => `<div>${r.event.subject}</div>`).join('');
  const noise = untouched.length
    ? `<div class="noise-bucket" id="noiseBucket">
         <span id="noiseToggleLabel">&#9656; ${untouched.length} other signal${untouched.length === 1 ? '' : 's'}, none touching your book</span>
         <div class="noise-list">${noiseList}</div>
       </div>`
    : '';

  document.getElementById('myBookContent').innerHTML = header + verdict + cardsHeading + cards + noise;

  const bucket = document.getElementById('noiseBucket');
  if (bucket) {
    bucket.addEventListener('click', () => {
      bucket.classList.toggle('open');
      const label = document.getElementById('noiseToggleLabel');
      label.innerHTML = label.innerHTML.replace(bucket.classList.contains('open') ? '▶' : '▼', bucket.classList.contains('open') ? '▼' : '▶');
    });
  }
}

// ---------------------------------------------------------------- Event Lens tab
function renderEventLens(scenarioKey) {
  const event = PRISM_SCENARIOS[scenarioKey];
  const impacts = window.PrismEngine.analyzeEvent(book, event);
  const maxScore = Math.max(...impacts.map(i => i.rank_score), 1);

  const ladder = impacts.map(i => {
    const color = i.direction === 'headwind' ? 'var(--headwind)' : i.direction === 'tailwind' ? 'var(--tailwind)' : 'var(--mixed)';
    const w = (i.rank_score / maxScore) * 100;
    return `
      <div class="ladder-row">
        <div class="ladder-name">${i.portfolio_name}</div>
        <div class="ladder-rail"><div class="ladder-fill" style="width:${w}%;background:${color}"></div></div>
        <div class="ladder-score" style="color:${color}">${DIR_LABEL[i.direction]} ${i.exposure_pct}%</div>
      </div>`;
  }).join('');

  const pairs = window.PrismEngine.crossDeskContradictions(impacts);
  const contraHtml = pairs.slice(0, 5).map(([t, h]) => `
    <div class="contra-pair">
      <div class="contra-side" style="color:var(--tailwind)">+ ${t.portfolio_name}: TAILWIND ${t.exposure_pct}%</div>
      <div class="contra-side" style="color:var(--headwind); text-align:right">${h.portfolio_name}: HEADWIND ${h.exposure_pct}% -</div>
    </div>`).join('');

  document.getElementById('eventLensContent').innerHTML = `
    <div class="verdict"><span class="k">Event</span>${event.subject} &middot; ${impacts.length} of ${Object.keys(book.portfolios).length} portfolios touched &middot; reference: ${book.portfolios[book.referenceId].name}</div>
    <div class="shead">Ranked by exposure, across the whole book</div>
    <div class="pf-header">${ladder}</div>
    ${pairs.length ? `<div class="shead">Cross-desk contradictions (${pairs.length}) — CIO oversight, ADVANCED.md #4</div><div class="pf-header">${contraHtml}</div>` : ''}
  `;
}

// ---------------------------------------------------------------- init
renderMyBook(portfolioSelect.value);
renderEventLens(activeScenario);
