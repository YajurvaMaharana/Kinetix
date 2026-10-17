"""
TrustJuggler Deterministic Rule Evaluation Hooks.
Pure functional rule evaluation checking deterministic security predicates:
1. IMPOSSIBLE_TRAVEL: Speed > 800 km/h or cross-city jumps (+25 points, floor 60)
2. GPS_SPOOFING: Mock location provider or zero speed variance with linear path (+20 points, floor 60)
3. CONCURRENT_SESSION: Multi-device or multi-location simultaneous activity (+20 points, floor 60)
4. FACE_MISMATCH: Biometric similarity < 0.40 (+30 points, floor 75)
5. LIVENESS_FAILED: Liveness score < 0.30 or challenge declined (+30 points, floor 75)
6. MULTI_ACCOUNT_DEVICE_RING: Collusion cluster sharing hardware or emulator (+15 points, floor 60)

No Database dependencies. No I/O. 100% deterministic and testable.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.scoring.thresholds import DEFAULT_THRESHOLDS, ThresholdConfig


@dataclass
class RuleMatch:
    code: str
    points: float
    floor: float
    threat_tag: str
    reason: str


@dataclass
class RuleEvaluationResult:
    rule_points: float
    rule_floor: float
    matches: List[RuleMatch] = field(default_factory=list)
    threat_tags: List[str] = field(default_factory=list)


def evaluate_rules(
    ctx: Any,
    thresholds: Optional[ThresholdConfig] = None,
) -> RuleEvaluationResult:
    """
    Evaluates all deterministic security rules against session signals.
    Returns cumulative rule points, highest mandatory floor, and threat tags.

    Why Deterministic Rule Floors?
    Statistical and machine learning models are susceptible to subtle adversarial drift
    or gradient poisoning. Certain signatures (such as physical impossibility, mock provider flags,
    or definitive biometric mismatch) represent indisputable account compromises.
    Rule floors guarantee that even if all other metrics appear normal, the final risk score
    cannot drop below the specified policy minimum.
    """
    cfg = thresholds or DEFAULT_THRESHOLDS
    req_dict = _extract_dict(getattr(ctx, "request_or_event", ctx))
    telem = req_dict.get("telemetry", {}) or {}
    biom = req_dict.get("biometrics", {}) or {}
    loc = req_dict.get("location", {}) or {}
    dev_dict = _extract_dict(req_dict.get("device_passport") or req_dict.get("device") or getattr(ctx, "device_passport", {}))
    events = req_dict.get("events", []) or []

    matches: List[RuleMatch] = []

    # 1. IMPOSSIBLE_TRAVEL (+25, floor 60)
    match_imp = check_impossible_travel(req_dict, telem, loc, cfg)
    if match_imp:
        matches.append(match_imp)

    # 2. GPS_SPOOFING (+20, floor 60)
    match_gps = check_gps_spoofing(req_dict, telem, loc, dev_dict, cfg)
    if match_gps:
        matches.append(match_gps)

    # 3. CONCURRENT_SESSION (+20, floor 60)
    match_conc = check_concurrent_session(req_dict, telem, cfg)
    if match_conc:
        matches.append(match_conc)

    # 4. FACE_MISMATCH (+30, floor 75)
    match_face = check_face_mismatch(req_dict, biom, cfg)
    if match_face:
        matches.append(match_face)

    # 5. LIVENESS_FAILED (+30, floor 75)
    match_live = check_liveness_failed(req_dict, biom, telem, events, cfg)
    if match_live:
        matches.append(match_live)

    # 6. MULTI_ACCOUNT_DEVICE_RING (+15, floor 60)
    match_ring = check_multi_account_device_ring(req_dict, dev_dict, telem, cfg)
    if match_ring:
        matches.append(match_ring)

    total_points = sum(m.points for m in matches)
    max_floor = max([m.floor for m in matches], default=0.0)
    threat_tags = list(dict.fromkeys([m.threat_tag for m in matches]))

    return RuleEvaluationResult(
        rule_points=round(float(total_points), 2),
        rule_floor=round(float(max_floor), 2),
        matches=matches,
        threat_tags=threat_tags,
    )


def check_impossible_travel(
    req_dict: Dict[str, Any],
    telem: Dict[str, Any],
    loc: Dict[str, Any],
    cfg: ThresholdConfig,
) -> Optional[RuleMatch]:
    """Flagged when speed between consecutive pings exceeds 800 km/h or impossible travel flag is set."""
    is_imp = bool(
        req_dict.get("impossible_travel")
        or telem.get("impossible_travel_detected")
        or (telem.get("speed_between_pings_kmh", 0.0) > 800.0)
        or (req_dict.get("threat_tags") and "IMPOSSIBLE_TRAVEL" in req_dict.get("threat_tags"))
    )
    if is_imp:
        return RuleMatch(
            code="IMPOSSIBLE_TRAVEL",
            points=cfg.rule_impossible_travel_points,
            floor=cfg.rule_impossible_travel_floor,
            threat_tag="IMPOSSIBLE_TRAVEL",
            reason="Physical displacement speed exceeds commercial transit limits (>800 km/h).",
        )
    return None


def check_gps_spoofing(
    req_dict: Dict[str, Any],
    telem: Dict[str, Any],
    loc: Dict[str, Any],
    dev_dict: Dict[str, Any],
    cfg: ThresholdConfig,
) -> Optional[RuleMatch]:
    """Flagged when Android mock location provider is active or path is laser-straight with 0 speed variance."""
    is_mock = bool(
        req_dict.get("mock_location_detected")
        or telem.get("mock_location_detected")
        or loc.get("mock_location_detected")
        or dev_dict.get("mock_location_detected")
        or (telem.get("straightness_ratio", 0.0) >= 0.995 and telem.get("speed_variance", 99.0) <= 0.05)
        or (req_dict.get("threat_tags") and "GPS_SPOOFING" in req_dict.get("threat_tags"))
    )
    if is_mock:
        return RuleMatch(
            code="GPS_SPOOFING",
            points=cfg.rule_gps_spoofing_points,
            floor=cfg.rule_gps_spoofing_floor,
            threat_tag="GPS_SPOOFING",
            reason="Mock location provider API detected or synthetic constant-speed trajectory.",
        )
    return None


def check_concurrent_session(
    req_dict: Dict[str, Any],
    telem: Dict[str, Any],
    cfg: ThresholdConfig,
) -> Optional[RuleMatch]:
    """Flagged when multiple dispatch sessions are concurrently active across disparate geographies."""
    is_conc = bool(
        req_dict.get("concurrent_session")
        or telem.get("concurrent_session_detected")
        or (req_dict.get("threat_tags") and "CONCURRENT_SESSION" in req_dict.get("threat_tags"))
    )
    if is_conc:
        return RuleMatch(
            code="CONCURRENT_SESSION",
            points=cfg.rule_concurrent_session_points,
            floor=cfg.rule_concurrent_session_floor,
            threat_tag="ACCOUNT_HANDOFF",
            reason="Simultaneous active dispatch sessions detected on disparate network hardware.",
        )
    return None


def check_face_mismatch(
    req_dict: Dict[str, Any],
    biom: Dict[str, Any],
    cfg: ThresholdConfig,
) -> Optional[RuleMatch]:
    """Flagged when step-up face verification confidence drops below 0.40."""
    conf = biom.get("face_match_confidence")
    if conf is None:
        conf = req_dict.get("face_match_confidence")

    if conf is not None and float(conf) < 0.40:
        return RuleMatch(
            code="FACE_MISMATCH",
            points=cfg.rule_face_mismatch_points,
            floor=cfg.rule_face_mismatch_floor,
            threat_tag="ACCOUNT_HANDOFF",
            reason=f"Facial verification confidence ({conf:.2f}) diverged from enrolled template.",
        )
    return None


def check_liveness_failed(
    req_dict: Dict[str, Any],
    biom: Dict[str, Any],
    telem: Dict[str, Any],
    events: List[Dict[str, Any]],
    cfg: ThresholdConfig,
) -> Optional[RuleMatch]:
    """Flagged when passive or active 3D liveness check fails or is explicitly declined."""
    liveness = biom.get("liveness_score")
    if liveness is None:
        liveness = req_dict.get("liveness_score")

    declined = bool(
        telem.get("challenge_declined")
        or req_dict.get("challenge_declined")
        or any(e.get("payload", {}).get("challenge_declined") for e in events)
    )

    if declined or (liveness is not None and float(liveness) < 0.30):
        score_str = f"score: {liveness:.2f}" if liveness is not None else "declined"
        return RuleMatch(
            code="LIVENESS_FAILED",
            points=cfg.rule_liveness_failed_points,
            floor=cfg.rule_liveness_failed_floor,
            threat_tag="ACCOUNT_HANDOFF",
            reason=f"Biometric 3D liveness verification failed or bypassed ({score_str}).",
        )
    return None


def check_multi_account_device_ring(
    req_dict: Dict[str, Any],
    dev_dict: Dict[str, Any],
    telem: Dict[str, Any],
    cfg: ThresholdConfig,
) -> Optional[RuleMatch]:
    """Flagged when a device is shared by 3 or more riders or exhibits emulator farm attributes."""
    shared_dev_cnt = telem.get("shared_device_count") or req_dict.get("shared_device_count") or 1
    shared_pay_cnt = telem.get("shared_payout_count") or req_dict.get("shared_payout_count") or 1
    is_emu = dev_dict.get("is_emulator", False) or req_dict.get("is_emulator", False)

    is_ring = bool(
        shared_dev_cnt >= 3
        or shared_pay_cnt >= 3
        or (is_emu and (shared_dev_cnt >= 2 or telem.get("ring_id")))
        or (req_dict.get("threat_tags") and "FRAUD_RING" in req_dict.get("threat_tags"))
    )
    if is_ring:
        return RuleMatch(
            code="MULTI_ACCOUNT_DEVICE_RING",
            points=cfg.rule_fraud_ring_points,
            floor=cfg.rule_fraud_ring_floor,
            threat_tag="FRAUD_RING",
            reason="Device hardware or payout account linked to multi-rider collusion ring.",
        )
    return None


def _extract_dict(obj: Any) -> Dict[str, Any]:
    """Safely coerces objects into a dictionary without DB or I/O."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "__dict__"):
        return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
    return {}
