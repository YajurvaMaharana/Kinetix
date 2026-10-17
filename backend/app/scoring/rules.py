"""
TrustJuggler Deterministic Security Rule Evaluation Engine.
Evaluates high-confidence fraud rules:
1. IMPOSSIBLE_TRAVEL: Speed > 800 km/h or cross-city jumps (+25 points, floor 60)
2. GPS_SPOOFING: Mock location provider or zero speed variance with linear path (+20 points, floor 60)
3. CONCURRENT_SESSION: Multi-device or multi-location simultaneous activity (+20 points, floor 60)
4. FACE_MISMATCH: Biometric similarity < 0.40 (+30 points, floor 75)
5. LIVENESS_FAILED: Liveness score < 0.30 or challenge declined (+30 points, floor 75)
6. MULTI_ACCOUNT_DEVICE_RING: Collusion cluster sharing hardware or emulator (+15 points, floor 60)

Returns RuleHit(code, points, floor, observed, baseline, explanation) dataclasses.
Pure functions. No DB, no I/O.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union

from app.scoring.thresholds import DEFAULT_THRESHOLDS, ThresholdConfig


@dataclass
class RuleHit:
    """
    Deterministic rule violation result.
    Attributes:
        code: Security rule identifier (e.g. 'IMPOSSIBLE_TRAVEL')
        points: Additive risk points to raw composite score
        floor: Non-negotiable minimum risk ceiling override
        observed: String or structured representation of the detected signal
        baseline: Established historical threshold or expectation
        explanation: Human and audit explanation of the rule hit
    """
    code: str
    points: float
    floor: float
    observed: Union[str, Dict[str, Any]]
    baseline: Union[str, Dict[str, Any]]
    explanation: str
    threat_tag: str = ""

    def __post_init__(self):
        if not self.threat_tag:
            tag_map = {
                "IMPOSSIBLE_TRAVEL": "IMPOSSIBLE_TRAVEL",
                "GPS_SPOOFING": "GPS_SPOOFING",
                "CONCURRENT_SESSION": "ACCOUNT_HANDOFF",
                "FACE_MISMATCH": "ACCOUNT_HANDOFF",
                "LIVENESS_FAILED": "ACCOUNT_HANDOFF",
                "MULTI_ACCOUNT_DEVICE_RING": "FRAUD_RING",
                "CHALLENGE_FAILED": "ACCOUNT_HANDOFF",
            }
            self.threat_tag = tag_map.get(self.code, "SECURITY_RULE_VIOLATION")


# Backward compatibility alias
RuleMatch = RuleHit


@dataclass
class RuleEvaluationResult:
    rule_points: float
    rule_floor: float
    matches: List[RuleHit] = field(default_factory=list)
    threat_tags: List[str] = field(default_factory=list)


def evaluate_rules(
    ctx: Any,
    thresholds: Optional[ThresholdConfig] = None,
) -> RuleEvaluationResult:
    """
    Evaluates all deterministic security rules against session signals.
    Returns cumulative rule points, highest mandatory floor, and threat tags.

    Why Rule Floors?
    Statistical and ML models evaluate continuous distributions and can occasionally be fooled
    by adversarial telemetry blending. When a binary hardware attestation or physical law is broken
    (such as supersonic travel or mock location injection), rule floors guarantee that the final
    risk score cannot drop below the mandated intervention threshold regardless of other features.
    """
    cfg = thresholds or DEFAULT_THRESHOLDS
    req_dict = _extract_dict(getattr(ctx, "request_or_event", ctx))
    telem = req_dict.get("telemetry", {}) or {}
    biom = req_dict.get("biometrics", {}) or {}
    loc = req_dict.get("location", {}) or {}
    dev_dict = _extract_dict(
        req_dict.get("device_passport")
        or req_dict.get("device")
        or getattr(ctx, "device_passport", {})
    )
    events = req_dict.get("events", []) or []

    hits: List[RuleHit] = []

    # 1. IMPOSSIBLE_TRAVEL (+25, floor 60)
    hit_imp = check_impossible_travel(req_dict, telem, loc, cfg)
    if hit_imp:
        hits.append(hit_imp)

    # 2. GPS_SPOOFING (+20, floor 60)
    hit_gps = check_gps_spoofing(req_dict, telem, loc, dev_dict, cfg)
    if hit_gps:
        hits.append(hit_gps)

    # 3. CONCURRENT_SESSION (+20, floor 60)
    hit_conc = check_concurrent_session(req_dict, telem, cfg)
    if hit_conc:
        hits.append(hit_conc)

    # 4. FACE_MISMATCH (+30, floor 75)
    hit_face = check_face_mismatch(req_dict, biom, cfg)
    if hit_face:
        hits.append(hit_face)

    # 5. LIVENESS_FAILED (+30, floor 75)
    hit_live = check_liveness_failed(req_dict, biom, telem, events, cfg)
    if hit_live:
        hits.append(hit_live)

    # 6. MULTI_ACCOUNT_DEVICE_RING (+15, floor 60)
    hit_ring = check_multi_account_device_ring(req_dict, dev_dict, telem, cfg)
    if hit_ring:
        hits.append(hit_ring)

    # 7. CHALLENGE_FAILED (+25, floor 75)
    hit_cf = check_challenge_failed(req_dict, cfg)
    if hit_cf:
        hits.append(hit_cf)

    total_points = sum(h.points for h in hits)
    max_floor = max([h.floor for h in hits], default=0.0)
    threat_tags = list(dict.fromkeys([h.threat_tag for h in hits]))

    return RuleEvaluationResult(
        rule_points=round(float(total_points), 2),
        rule_floor=round(float(max_floor), 2),
        matches=hits,
        threat_tags=threat_tags,
    )


def _bool_val(val: Any) -> bool:
    """Robust boolean coercion for booleans, ints, and strings."""
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val != 0
    s = str(val).strip().lower()
    return s in ("true", "1", "yes", "t")


def _float_val(val: Any, default: float = 0.0) -> float:
    """Robust float coercion."""
    if val is None or val == "":
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def _int_val(val: Any, default: int = 1) -> int:
    """Robust integer coercion."""
    if val is None or val == "":
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


def check_impossible_travel(
    req_dict: Dict[str, Any],
    telem: Dict[str, Any],
    loc: Dict[str, Any],
    cfg: ThresholdConfig,
) -> Optional[RuleHit]:
    """Flagged when displacement speed between consecutive pings exceeds 800 km/h."""
    speed_jump = _float_val(telem.get("speed_between_pings_kmh") or req_dict.get("speed_between_pings_kmh"), 0.0)
    is_imp = bool(
        _bool_val(req_dict.get("impossible_travel"))
        or _bool_val(telem.get("impossible_travel_detected"))
        or (speed_jump > 800.0)
        or ("IMPOSSIBLE_TRAVEL" in str(req_dict.get("threat_tags", "")))
    )
    if is_imp:
        obs_val = f"{speed_jump:.1f} km/h" if speed_jump > 0 else "cross-city jump detected"
        return RuleHit(
            code="IMPOSSIBLE_TRAVEL",
            points=cfg.rule_impossible_travel_points,
            floor=cfg.rule_impossible_travel_floor,
            observed=obs_val,
            baseline="max plausible speed: 120.0 km/h",
            explanation="Physical displacement speed exceeds commercial transit limits (>800 km/h).",
            threat_tag="IMPOSSIBLE_TRAVEL",
        )
    return None


def check_gps_spoofing(
    req_dict: Dict[str, Any],
    telem: Dict[str, Any],
    loc: Dict[str, Any],
    dev_dict: Dict[str, Any],
    cfg: ThresholdConfig,
) -> Optional[RuleHit]:
    """Flagged when Android mock location provider is active or path is unnaturally straight with zero speed variance."""
    mock_flag = bool(
        _bool_val(req_dict.get("mock_location_detected"))
        or _bool_val(telem.get("mock_location_detected"))
        or _bool_val(loc.get("mock_location_detected"))
        or _bool_val(dev_dict.get("mock_location_detected"))
    )
    straightness = _float_val(telem.get("straightness_ratio") or req_dict.get("straightness_ratio"), 0.0)
    speed_var = _float_val(telem.get("speed_variance") or req_dict.get("speed_variance"), 99.0)

    is_synth_path = straightness >= 0.995 and speed_var <= 0.05
    is_spoof = bool(
        mock_flag
        or is_synth_path
        or ("GPS_SPOOFING" in str(req_dict.get("threat_tags", "")))
    )
    if is_spoof:
        if mock_flag:
            obs = "mock_location_provider=True"
        else:
            obs = f"straightness={straightness:.3f}, speed_var={speed_var:.3f}"
        return RuleHit(
            code="GPS_SPOOFING",
            points=cfg.rule_gps_spoofing_points,
            floor=cfg.rule_gps_spoofing_floor,
            observed=obs,
            baseline="natural urban road trajectory with GPS jitter and speed variance",
            explanation="Mock location provider API detected or synthetic constant-speed trajectory.",
            threat_tag="GPS_SPOOFING",
        )
    return None


def check_concurrent_session(
    req_dict: Dict[str, Any],
    telem: Dict[str, Any],
    cfg: ThresholdConfig,
) -> Optional[RuleHit]:
    """Flagged when multiple dispatch sessions are active concurrently across distant locations."""
    is_conc = bool(
        _bool_val(req_dict.get("concurrent_session"))
        or _bool_val(telem.get("concurrent_session_detected"))
        or ("CONCURRENT_SESSION" in str(req_dict.get("threat_tags", "")))
    )
    if is_conc:
        dist = _float_val(telem.get("concurrent_distance_km") or req_dict.get("concurrent_distance_km"), 50.0)
        return RuleHit(
            code="CONCURRENT_SESSION",
            points=cfg.rule_concurrent_session_points,
            floor=cfg.rule_concurrent_session_floor,
            observed=f"concurrent active session {dist:.1f} km away",
            baseline="single active session per authenticated rider",
            explanation="Simultaneous active dispatch sessions detected on disparate network hardware.",
            threat_tag="ACCOUNT_HANDOFF",
        )
    return None


def check_face_mismatch(
    req_dict: Dict[str, Any],
    biom: Dict[str, Any],
    cfg: ThresholdConfig,
) -> Optional[RuleHit]:
    """Flagged when step-up face verification confidence drops below 0.40."""
    conf = biom.get("face_match_confidence")
    if conf is None or conf == "":
        conf = req_dict.get("face_match_confidence")

    if conf is not None and conf != "":
        conf_f = _float_val(conf, 1.0)
        if conf_f < 0.40:
            return RuleHit(
                code="FACE_MISMATCH",
                points=cfg.rule_face_mismatch_points,
                floor=cfg.rule_face_mismatch_floor,
                observed=f"cosine_similarity={conf_f:.2f}",
                baseline="match_threshold >= 0.70",
                explanation=f"Facial verification confidence ({conf_f:.2f}) diverged from enrolled template.",
                threat_tag="ACCOUNT_HANDOFF",
            )
    return None


def check_liveness_failed(
    req_dict: Dict[str, Any],
    biom: Dict[str, Any],
    telem: Dict[str, Any],
    events: List[Dict[str, Any]],
    cfg: ThresholdConfig,
) -> Optional[RuleHit]:
    """Flagged when passive or active 3D liveness check fails or is explicitly declined."""
    liveness = biom.get("liveness_score")
    if liveness is None or liveness == "":
        liveness = req_dict.get("liveness_score")

    declined = bool(
        _bool_val(telem.get("challenge_declined"))
        or _bool_val(req_dict.get("challenge_declined"))
        or any(_bool_val(e.get("payload", {}).get("challenge_declined")) for e in events if isinstance(e, dict))
    )

    liveness_f = _float_val(liveness, 1.0) if (liveness is not None and liveness != "") else None
    if declined or (liveness_f is not None and liveness_f < 0.30):
        obs = "challenge_declined" if declined else f"liveness_score={liveness_f:.2f}"
        return RuleHit(
            code="LIVENESS_FAILED",
            points=cfg.rule_liveness_failed_points,
            floor=cfg.rule_liveness_failed_floor,
            observed=obs,
            baseline="liveness_score >= 0.80",
            explanation="Biometric 3D liveness verification failed or was declined.",
            threat_tag="ACCOUNT_HANDOFF",
        )
    return None


def check_multi_account_device_ring(
    req_dict: Dict[str, Any],
    dev_dict: Dict[str, Any],
    telem: Dict[str, Any],
    cfg: ThresholdConfig,
) -> Optional[RuleHit]:
    """Flagged when a hardware device is shared by 3+ accounts or exhibits emulator farm attributes."""
    shared_dev_cnt = _int_val(telem.get("shared_device_count") or req_dict.get("shared_device_count"), 1)
    shared_pay_cnt = _int_val(telem.get("shared_payout_count") or req_dict.get("shared_payout_count"), 1)
    is_emu = _bool_val(dev_dict.get("is_emulator")) or _bool_val(req_dict.get("is_emulator"))

    is_ring = bool(
        shared_dev_cnt >= 3
        or shared_pay_cnt >= 3
        or (is_emu and (shared_dev_cnt >= 2 or telem.get("ring_id") or req_dict.get("ring_id")))
        or ("FRAUD_RING" in str(req_dict.get("threat_tags", "")))
    )
    if is_ring:
        obs = f"shared_devices={shared_dev_cnt}, shared_payouts={shared_pay_cnt}, emulator={is_emu}"
        return RuleHit(
            code="MULTI_ACCOUNT_DEVICE_RING",
            points=cfg.rule_fraud_ring_points,
            floor=cfg.rule_fraud_ring_floor,
            observed=obs,
            baseline="exclusive personal handset (shared_accounts <= 1)",
            explanation="Device hardware or payout account linked to multi-rider collusion ring.",
            threat_tag="FRAUD_RING",
        )
    return None


def check_challenge_failed(
    req_dict: Dict[str, Any],
    cfg: ThresholdConfig,
) -> Optional[RuleHit]:
    """Flagged when challenge response fails explicitly (+25 points, floor 75)."""
    is_failed = bool(
        _bool_val(req_dict.get("challenge_failed"))
        or "CHALLENGE_FAILED" in str(req_dict.get("threat_tags", ""))
        or req_dict.get("event_type") == "challenge_failed"
    )
    if is_failed:
        return RuleHit(
            code="CHALLENGE_FAILED",
            points=25.0,
            floor=75.0,
            observed="challenge_verification_failed",
            baseline="successful challenge attestation",
            explanation="Rider failed interactive step-up verification challenge.",
            threat_tag="ACCOUNT_HANDOFF",
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
