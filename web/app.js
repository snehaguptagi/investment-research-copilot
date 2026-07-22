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
function dirColor(direction) {
  return direction === 'headwind' ? 'var(--headwind)' : direction === 'tailwind' ? 'var(--tailwind)' : 'var(--mixed)';
}

function rungHtml(impact) {
  const color = dirColor(impact.direction);
  const w = Math.max(impact.exposure_pct, 1);
  const driver = book.portfolios[impact.portfolio_id].risk_driver;
  return `
    <button class="rung" data-pid="${impact.portfolio_id}" aria-expanded="false">
      <div>
        <div class="rung-name">${impact.portfolio_name}</div>
        <div class="rung-driver">${driver}</div>
      </div>
      <div class="rail">
        <i class="guide" style="left:25%"></i><i class="guide" style="left:50%"></i><i class="guide" style="left:75%"></i>
        <div class="rail-fill" style="width:${w}%;background:${color}"></div>
      </div>
      <div class="rung-score">
        <div class="v" style="color:${color}">${impact.exposure_pct}%</div>
        <div class="chip" style="background:${color}">${DIR_LABEL[impact.direction]}</div>
      </div>
      <div class="rung-caret">&#9662;</div>
    </button>
    <div class="rung-detail" id="detail-${impact.portfolio_id}">
      ${compareBarsHtml(impact)}
      ${holdingsPreviewHtml(impact)}
    </div>`;
}

function contraCardHtml(tail, head) {
  return `
    <div class="contra-card">
      <div class="contra-side">
        <span class="contra-tag tailwind">Tailwind</span>
        <span class="contra-name">${tail.portfolio_name}</span>
        <span class="contra-value tailwind">${tail.exposure_pct}%</span>
      </div>
      <div class="contra-vs">VS</div>
      <div class="contra-side right">
        <span class="contra-tag headwind">Headwind</span>
        <span class="contra-name">${head.portfolio_name}</span>
        <span class="contra-value headwind">${head.exposure_pct}%</span>
      </div>
    </div>`;
}

function renderEventLens(scenarioKey) {
  const event = PRISM_SCENARIOS[scenarioKey];
  const impacts = window.PrismEngine.analyzeEvent(book, event);
  const pairs = window.PrismEngine.crossDeskContradictions(impacts);
  const attnCount = impacts.filter(i => i.needs_attention).length;

  const summary = `
    <div class="lens-summary">
      <div class="lens-stat"><div class="v">${impacts.length} / ${Object.keys(book.portfolios).length}</div><div class="l">Portfolios touched</div></div>
      <div class="lens-stat"><div class="v" style="color:var(--vhigh)">${attnCount}</div><div class="l">Need attention</div></div>
      <div class="lens-stat"><div class="v">${pairs.length}</div><div class="l">Cross-desk contradictions</div></div>
      <div class="lens-stat"><div class="v" style="font-size:13px">${book.portfolios[book.referenceId].name}</div><div class="l">Reference book</div></div>
    </div>`;

  const ladderHtml = impacts.length
    ? `<div class="shead">Ranked by exposure, across the whole book</div><div class="ladder">${impacts.map(rungHtml).join('')}</div>`
    : `<div class="verdict">No portfolios are touched by this signal.</div>`;

  const contraHtml = pairs.length
    ? `<div class="shead">Cross-desk contradictions (${pairs.length}) &mdash; CIO oversight, ADVANCED.md #4</div>
       <div class="contra-grid">${pairs.slice(0, 5).map(([t, h]) => contraCardHtml(t, h)).join('')}</div>`
    : '';

  document.getElementById('eventLensContent').innerHTML = `
    <div class="verdict"><span class="k">Event</span>${event.subject}</div>
    ${summary}
    ${ladderHtml}
    ${contraHtml}
  `;

  document.querySelectorAll('.rung').forEach(btn => {
    btn.addEventListener('click', () => {
      const detail = document.getElementById(`detail-${btn.dataset.pid}`);
      const isOpen = detail.classList.toggle('open');
      btn.classList.toggle('open', isOpen);
      btn.setAttribute('aria-expanded', String(isOpen));
    });
  });
}

// ---------------------------------------------------------------- init
renderMyBook(portfolioSelect.value);
renderEventLens(activeScenario);
