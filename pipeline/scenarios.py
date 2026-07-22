"""
Hand-authored demo events, standing in for what the LLM event-classifier
will produce from real articles once the API layer is wired in. Each one
is a structured `Event` the deterministic engine can run today.
"""

from engine import Event

SCENARIOS: dict[str, Event] = {
    "chip-controls": Event(
        event_type="sector",
        subject="US tightens semiconductor export controls",
        intrinsic_sign=-1,
        sector="Information Technology",
        named_security_ids=["sec_nvda", "sec_amd", "sec_avgo", "sec_qcom",
                            "sec_tsm_adr", "sec_asml"],
        magnitude=0.7,
    ),
    "rate-cuts": Event(
        event_type="rates",
        subject="Central bank signals rate cuts",
        move="down",
        magnitude=0.6,
    ),
    "oil-spike": Event(
        event_type="oil",
        subject="Oil price spikes on supply shock",
        move="up",
        magnitude=0.8,
    ),
    "credit-stress": Event(
        event_type="credit_spreads",
        subject="Credit spreads widen on default fears",
        move="up",
        magnitude=0.7,
    ),
    "risk-off": Event(
        event_type="risk_off",
        subject="Broad risk-off on growth scare",
        move="up",
        magnitude=0.7,
    ),
    "inflation-shock": Event(
        event_type="inflation",
        subject="Hot CPI print surprises to the upside",
        move="up",
        magnitude=0.6,
    ),
    "dollar-strength": Event(
        event_type="usd",
        subject="Dollar rallies on hawkish Fed",
        move="up",
        magnitude=0.5,
    ),
}
