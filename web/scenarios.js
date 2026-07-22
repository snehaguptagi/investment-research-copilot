// JS port of pipeline/scenarios.py — same 7 hand-authored events, standing
// in for the LLM event-classifier's output until the API layer is wired in.
'use strict';

const PRISM_SCENARIOS = {
  'chip-controls': {
    event_type: 'sector',
    subject: 'US tightens semiconductor export controls',
    intrinsic_sign: -1,
    sector: 'Information Technology',
    named_security_ids: ['sec_nvda', 'sec_amd', 'sec_avgo', 'sec_qcom', 'sec_tsm_adr', 'sec_asml'],
    magnitude: 0.7,
  },
  'rate-cuts': {
    event_type: 'rates',
    subject: 'Central bank signals rate cuts',
    move: 'down',
    intrinsic_sign: -1,
    named_security_ids: [],
    magnitude: 0.6,
  },
  'oil-spike': {
    event_type: 'oil',
    subject: 'Oil price spikes on supply shock',
    move: 'up',
    intrinsic_sign: -1,
    named_security_ids: [],
    magnitude: 0.8,
  },
  'credit-stress': {
    event_type: 'credit_spreads',
    subject: 'Credit spreads widen on default fears',
    move: 'up',
    intrinsic_sign: -1,
    named_security_ids: [],
    magnitude: 0.7,
  },
  'risk-off': {
    event_type: 'risk_off',
    subject: 'Broad risk-off on growth scare',
    move: 'up',
    intrinsic_sign: -1,
    named_security_ids: [],
    magnitude: 0.7,
  },
  'inflation-shock': {
    event_type: 'inflation',
    subject: 'Hot CPI print surprises to the upside',
    move: 'up',
    intrinsic_sign: -1,
    named_security_ids: [],
    magnitude: 0.6,
  },
  'dollar-strength': {
    event_type: 'usd',
    subject: 'Dollar rallies on hawkish Fed',
    move: 'up',
    intrinsic_sign: -1,
    named_security_ids: [],
    magnitude: 0.5,
  },
};

window.PRISM_SCENARIOS = PRISM_SCENARIOS;
