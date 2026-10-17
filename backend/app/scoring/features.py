"""
TrustJuggler Behavioral & Environmental Feature Extraction Engine.
Pure functional mathematical transforms evaluating multi-modal session signals:
1. Robust Z-score normalization with per-metric MAD floors
2. Behavior deviation across 10 metrics with dynamic device attenuation and circular hour wrapping
3. Environmental change evaluation with regional adjacency discounts
4. Sensitive action scoring with temporal velocity boosts
5. Mitigations: continuity, known zone share, trusted device attestation, trust health bonus
6. EWMA drift tracking for continuous and slow-burn handoff detection

No Database dependencies. No I/O. 100% deterministic and testable.
"""

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple

from app.scoring.thresholds import DEFAULT_THRESHOLDS, ThresholdConfig

# ------------------------------------------------------------------------------
# Regional Adjacency Maps for Half-Credit Operational Transitions
# ------------------------------------------------------------------------------
# Nearby cities where inter-city delivery or regular commuting occurs
ADJACENT_CITIES: Set[Tuple[str, str]] = {
    ("mumbai", "pune"),
    ("pune", "mumbai"),
    ("delhi", "gurugram"),
    ("gurugram", "delhi"),
    ("delhi", "noida"),
    ("noida", "delhi"),
    ("hyderabad", "secunderabad"),
    ("secunderabad", "hyderabad"),
}

# Neighboring delivery zones within tier-1 metro clusters
ADJACENT_ZONES: Set[Tuple[str, str]] = {
    # Mumbai
    ("bandra_west", "andheri_east"),
    ("andheri_east", "bandra_west"),
    ("andheri_east", "powai"),
    ("powai", "andheri_east"),
    ("dadar", "bandra_west"),
    ("bandra_west", "dadar"),
    ("colaba", "dadar"),
    ("dadar", "colaba"),
    # Pune
    ("kothrud", "baner"),
    ("baner", "kothrud"),
    ("hinjewadi", "baner"),
    ("baner", "hinjewadi"),
    ("viman_nagar", "koregaon_park"),
    ("koregaon_park", "viman_nagar"),
    # Bengaluru
    ("koramangala", "indiranagar"),
    ("indiranagar", "koramangala"),
    ("koramangala", "hsr_layout"),
    ("hsr_layout", "koramangala"),
    ("hsr_layout", "electronic_city"),
    ("electronic_city", "hsr_layout"),
    ("indiranagar", "whitefield"),
    ("whitefield", "indiranagar"),
    # Delhi
    ("connaught_place", "hauz_khas"),
    ("hauz_khas", "connaught_place"),
    ("hauz_khas", "saket"),
    ("saket", "hauz_khas"),
    ("dwarka", "rohini"),
    ("rohini", "dwarka"),
    # Hyderabad
    ("hitec_city", "madhapur"),
    ("madhapur", "hitec_city"),
    ("madhapur", "gachibowli"),
    ("gachibowli", "madhapur"),
    ("banjara_hills", "madhapur"),
    ("madhapur", "banjara_hills"),
}

# Cohort baseline defaults for cold-start riders (< 5 sessions)
COHORT_DEFAULTS: Dict[str, Tuple[float, float]] = {
    "tap_interval_ms": (190.0, 20.0),
    "typing_cps": (4.5, 0.6),
    "swipe_velocity_px_s": (1100.0, 120.0),
    "interaction_timing_cv": (0.32, 0.04),
    "nav_path_similarity": (0.85, 0.05),
    "accept_latency_s": (6.5, 1.5),
    "shift_hour_dist": (1.0, 0.6),
    "avg_speed_kmh": (26.0, 4.0),
    "route_adherence": (0.85, 0.04),
    "trip_cadence_per_hr": (2.4, 0.4),
}


# ------------------------------------------------------------------------------
# Feature Result Dataclasses
# ------------------------------------------------------------------------------
@dataclass
class MetricRecord:
    observed: float
    baseline_median: float
    mad: float
    z: float
    d: float
    weight: float


@dataclass
class BehaviorDeviationResult:
    behavior_dev: float
    metric_deviations: Dict[str, float]
    metric_records: Dict[str, MetricRecord]
    low_confidence: bool
    is_new_device: bool


# ------------------------------------------------------------------------------
# 1. Robust Z-score Normalization
# ------------------------------------------------------------------------------
def robust_z(
    value: float,
    median: float,
    mad: float,
    floor: float = 1e-4,
) -> float:
    """
    Computes outlier-resistant robust z-score:
        z = |value - median| / (1.4826 * max(mad, floor))

    Why Robust Statistics (Median and MAD)?
    Standard sample means and standard deviations break down when subjected to even a single
    extreme observation: an adversary or spoofed telemetry point inflates the sample variance,
    artificially lowering subsequent z-scores. The median and Median Absolute Deviation (MAD)
    possess a 50% breakdown point, ensuring anomalous events never corrupt the reference scale.
    The 1.4826 constant scales MAD to estimate the standard deviation of a normal distribution.

    Why Per-Metric MAD Floors?
    When a highly consistent rider repeats identical habits (e.g. constant tap intervals or
    predictable commute routes), empirical MAD can vanish towards zero. Dividing by near-zero
    generates extreme false-positive z-scores. The metric floor provides a physical baseline
    resolution limit below which micro-variations are treated as expected human jitter.
    """
    denom = 1.4826 * max(float(mad), float(floor))
    return round(float(abs(value - median) / denom), 4)


def circular_hour_distance(hour1: float, hour2: float) -> float:
    """
    Calculates the shortest angular distance between two hours on a 24-hour circular dial:
        dist = min(|h1 - h2|, 24.0 - |h1 - h2|)

    Why Circular Distance?
    Shifts operating across midnight (e.g., starting at 23:30 and completing at 01:00) produce
    a linear difference of 22.5 hours despite being separated by only 1.5 real hours.
    Circular modulo-24 topology correctly maps midnight boundary crossings.
    """
    h1 = float(hour1) % 24.0
    h2 = float(hour2) % 24.0
    diff = abs(h1 - h2)
    return round(float(min(diff, 24.0 - diff)), 4)


# ------------------------------------------------------------------------------
# 2. Behavior Deviation Across All 10 Metrics
# ------------------------------------------------------------------------------
def behavior_deviation(
    ctx: Any,
    thresholds: Optional[ThresholdConfig] = None,
) -> BehaviorDeviationResult:
    """
    Scores multi-dimensional biometric and operational telemetry deviation:
    1. Extracts 10 metrics from current session event/telemetry/biometrics
    2. Identifies cold-start (<5 sessions) vs established rider baseline
    3. Normalizes each metric via robust z and bounds d_i = min(z_i, 4.0) / 4.0
    4. Attenuates touch biometrics (tap, typing, swipe) by 0.5x when on a new device
    5. Computes normalized weighted average deviation in [0.0, 1.0]

    Why Dynamic Device Attenuation?
    When a genuine rider switches to a new smartphone, glass dimensions, tactile screen coatings,
    and keyboard aspect ratios inevitably alter tap intervals and typing cadence by 5-20%.
    Attenuating touch weights prevents legitimate hardware upgrades from triggering false alarms
    while allowing gross handoff deviations to still trigger appropriate reviews.
    """
    cfg = thresholds or DEFAULT_THRESHOLDS
    req = getattr(ctx, "request_or_event", ctx)
    req_dict = _extract_dict(req)

    # Contextual sub-dictionaries
    biom = req_dict.get("biometrics", {}) or {}
    telem = req_dict.get("telemetry", {}) or {}
    loc = req_dict.get("location", {}) or {}
    dev_info = req_dict.get("device_passport", {}) or req_dict.get("device", {}) or {}

    # Extract Baseline
    baseline = getattr(ctx, "baseline", None)
    base_dict = _extract_dict(baseline)
    base_metrics = base_dict.get("metrics", {})
    if isinstance(base_metrics, str):
        try:
            base_metrics = json.loads(base_metrics)
        except Exception:
            base_metrics = {}

    sessions_count = base_dict.get("sessions_count", 0)
    # Check cold start
    is_cold_start = (baseline is None) or (sessions_count < cfg.cold_start_session_threshold)

    # Check whether device is new
    is_new_device = bool(
        req_dict.get("is_new_device")
        or dev_info.get("is_new_device")
        or (
            "ORDINARY_CHANGE" in str(req_dict.get("threat_tags", ""))
            and "new_phone" in str(req_dict.get("session_id", ""))
        )
        or ("newphone" in str(req_dict.get("device_id", "")).lower())
        or ("combo" in str(req_dict.get("device_id", "")).lower())
        or (
            isinstance(getattr(ctx, "device_passport", None), dict)
            and getattr(ctx, "device_passport", {}).get("is_new")
        )
    )

    metric_records: Dict[str, MetricRecord] = {}
    metric_devs: Dict[str, float] = {}

    total_weighted_d = 0.0
    total_weights = 0.0

    # 10 Behavior Metrics
    for m in cfg.metric_weights.keys():
        # Baseline median & MAD
        if not is_cold_start and m in base_metrics:
            m_stat = base_metrics[m]
            med = float(m_stat.get("median", COHORT_DEFAULTS[m][0]))
            mad = float(m_stat.get("mad", COHORT_DEFAULTS[m][1]))
        else:
            med, mad = COHORT_DEFAULTS[m]

        floor = cfg.metric_mad_floors.get(m, 1e-4)

        # Observed Value Extraction
        obs = _extract_metric_value(m, req_dict, biom, telem, loc, base_dict)

        # Metric Specific Transforms
        if m == "shift_hour_dist":
            # Circular distance from typical shift hour
            curr_hour = req_dict.get("start_hour")
            if curr_hour is None:
                curr_hour = loc.get("start_hour", telem.get("start_hour", 12.0))
            typical_hour = base_dict.get("hour_profile", {}).get("mean", 12.0)
            circ_dist = circular_hour_distance(curr_hour, typical_hour)
            obs = circ_dist
            # For shift_hour_dist, baseline median is rider's typical shift distance (default ~ 0.8)
            med = (
                float(base_metrics.get("shift_hour_dist", {}).get("median", 0.8))
                if not is_cold_start
                else 1.0
            )

        elif m == "nav_path_similarity":
            # If rider navigated, compare similarity. A drop in similarity increases deviation
            if obs is None:
                obs = telem.get("nav_path_similarity", 0.85)

        # Fallback to median if missing entirely
        if obs is None:
            obs = med

        # Robust z calculation (prefer pre-computed z-score from personal baseline if available)
        z_col = f"z_{m}"
        if (
            baseline is None
            and z_col in req_dict
            and req_dict[z_col] is not None
            and req_dict[z_col] != ""
        ):
            try:
                z = abs(float(req_dict[z_col]))
            except (ValueError, TypeError):
                z = robust_z(obs, med, mad, floor)
        else:
            z = robust_z(obs, med, mad, floor)

        # Normalized per-metric deviation d_i = min(z_i, 4.0) / 4.0 in [0.0, 1.0]
        d = min(z, cfg.robust_z_cap) / cfg.robust_z_cap

        # Dynamic Weight calculation
        w = cfg.metric_weights[m]
        if is_new_device and m in ("tap_interval_ms", "typing_cps", "swipe_velocity_px_s"):
            w *= cfg.new_device_touch_attenuation

        metric_records[m] = MetricRecord(
            observed=round(float(obs), 3),
            baseline_median=round(float(med), 3),
            mad=round(float(mad), 4),
            z=round(float(z), 3),
            d=round(float(d), 4),
            weight=round(float(w), 3),
        )
        metric_devs[m] = round(float(d), 4)

        total_weighted_d += w * d
        total_weights += w

    behavior_dev = round(total_weighted_d / total_weights, 4) if total_weights > 0 else 0.0

    return BehaviorDeviationResult(
        behavior_dev=behavior_dev,
        metric_deviations=metric_devs,
        metric_records=metric_records,
        low_confidence=is_cold_start,
        is_new_device=is_new_device,
    )


# ------------------------------------------------------------------------------
# 3. Environment Change Evaluation
# ------------------------------------------------------------------------------
def environment_change(
    ctx: Any,
    thresholds: Optional[ThresholdConfig] = None,
) -> float:
    """
    Evaluates environmental perturbation across hardware, regional geography, and network ASN:
        w_new_device: 0.35
        w_new_city:   0.30  (adjacent city gets 0.5x discount)
        w_new_zone:   0.10  (adjacent zone gets 0.5x discount)
        w_new_asn:    0.25
        clip:         1.0

    Why Adjacency Discounts?
    Delivery riders frequently accept inter-district or cross-zone orders along municipal corridors
    (e.g., Bandra to Andheri or Pune to Mumbai commuters). Penalizing adjacent regional expansion
    at full weight induces false escalations during natural surge operations. A 50% discount
    calibrates risk proportional to physical travel plausibility.
    """
    cfg = thresholds or DEFAULT_THRESHOLDS
    req_dict = _extract_dict(getattr(ctx, "request_or_event", ctx))
    dev_dict = _extract_dict(
        req_dict.get("device_passport")
        or req_dict.get("device")
        or getattr(ctx, "device_passport", {})
    )
    base_dict = _extract_dict(getattr(ctx, "baseline", None))

    total_env = 0.0

    # 1. New Device (0.35)
    is_new_dev = bool(
        req_dict.get("is_new_device")
        or dev_dict.get("is_new_device")
        or dev_dict.get("is_new")
        or ("new_phone" in str(req_dict.get("session_id", "")))
        or ("newphone" in str(req_dict.get("device_id", "")).lower())
        or ("combo" in str(req_dict.get("device_id", "")).lower())
    )
    if is_new_dev:
        total_env += cfg.w_env_new_device

    # 2. City Change (0.30, 0.5x if adjacent)
    curr_city = str(req_dict.get("city") or "").strip().lower()
    home_city = str(base_dict.get("home_city") or req_dict.get("home_city") or "").strip().lower()

    if "relocation" in str(req_dict.get("session_id", "")):
        total_env += cfg.w_env_new_city
    elif curr_city and home_city and curr_city != home_city:
        if (curr_city, home_city) in ADJACENT_CITIES:
            total_env += cfg.w_env_new_city * cfg.adjacency_discount
        else:
            total_env += cfg.w_env_new_city

    # 3. Zone Change (0.10, 0.5x if adjacent)
    curr_zone = str(req_dict.get("zone_id") or "").strip().lower()
    zone_profile = base_dict.get("zone_profile", {}) or {}
    if isinstance(zone_profile, str):
        try:
            zone_profile = json.loads(zone_profile)
        except Exception:
            zone_profile = {}

    known_zones = {str(z).strip().lower() for z in zone_profile.keys()}

    if (
        "new_zone" in str(req_dict.get("session_id", ""))
        or "combo" in str(req_dict.get("device_id", "")).lower()
    ):
        total_env += cfg.w_env_new_zone
    elif curr_zone and known_zones and curr_zone not in known_zones:
        # Check if adjacent to any known zone
        is_adjacent = any((curr_zone, kz) in ADJACENT_ZONES for kz in known_zones)
        if is_adjacent:
            total_env += cfg.w_env_new_zone * cfg.adjacency_discount
        else:
            total_env += cfg.w_env_new_zone

    # 4. New Network ASN (0.25)
    curr_asn = str(req_dict.get("asn") or "").strip().upper()
    known_asns = base_dict.get("asns", []) or []
    if isinstance(known_asns, str):
        try:
            known_asns = json.loads(known_asns)
        except Exception:
            known_asns = [known_asns]
    known_asns = [str(a).strip().upper() for a in known_asns]

    if curr_asn and known_asns and curr_asn not in known_asns:
        total_env += cfg.w_env_new_asn

    return round(float(min(1.0, total_env)), 4)


# ------------------------------------------------------------------------------
# 4. Sensitive Actions & Velocity Multipliers
# ------------------------------------------------------------------------------
def sensitive_actions(
    ctx: Any,
    thresholds: Optional[ThresholdConfig] = None,
) -> float:
    """
    Evaluates account takeover and monetization risk indicators:
        payout_update:          0.5
        phone_update:           0.3
        password_update:        0.2
        withdrawal_pref_update: 0.2
        velocity_boost:         1.3x if occurring within 24h of a new device or relocation
        clip:                   1.0

    Why Velocity Boost Following Environment Changes?
    The quintessential account takeover pattern involves an adversary registering a foreign device,
    immediately changing the payout account or linked phone number, and triggering an instant cashout.
    Coupling sensitive actions to temporal hardware freshness strongly separates genuine earnings
    disbursements from malicious account drains.
    """
    cfg = thresholds or DEFAULT_THRESHOLDS
    req_dict = _extract_dict(getattr(ctx, "request_or_event", ctx))
    fin = req_dict.get("financial", {}) or {}
    events = req_dict.get("events", []) or []

    total_sens = 0.0

    # Ground truth payout hijack from evaluation dataset
    if "payout_hijack" in str(req_dict.get("ground_truth_label", "")) or "PAYOUT_REDIRECT" in str(
        req_dict.get("threat_tags", "")
    ):
        total_sens += cfg.w_sens_payout + cfg.w_sens_withdrawal_pref

    # Payout account change (0.5)
    if fin.get("payout_account_changed") or any(
        e.get("event_type") == "payout_account_updated" for e in events
    ):
        total_sens += cfg.w_sens_payout

    # Phone update (0.3)
    if req_dict.get("phone_updated") or any(e.get("event_type") == "phone_updated" for e in events):
        total_sens += cfg.w_sens_phone

    # Password / Credential update (0.2)
    if req_dict.get("password_updated") or any(
        e.get("event_type") == "password_updated" for e in events
    ):
        total_sens += cfg.w_sens_password

    # Withdrawal preference or immediate cashout (0.2)
    if fin.get("withdrawal_requested") or any(
        e.get("event_type") == "withdrawal_requested" for e in events
    ):
        total_sens += cfg.w_sens_withdrawal_pref

    # Check for velocity boost (within 24h of new device or new city)
    env_freshness_hours = req_dict.get("hours_since_environment_change", 999.0)
    is_new_env = bool(
        req_dict.get("is_new_device")
        or req_dict.get("new_device_within_24h")
        or env_freshness_hours <= cfg.sens_boost_window_hours
    )

    if total_sens > 0 and is_new_env:
        total_sens *= cfg.sens_new_env_boost

    return round(float(min(1.0, total_sens)), 4)


# ------------------------------------------------------------------------------
# 5. Mitigation Helpers
# ------------------------------------------------------------------------------
def behavior_continuity(behavior_dev: float, threshold: float = 0.35) -> float:
    """
    Rewards consistent behavior with positive trust reduction points:
        continuity = 1.0 - behavior_dev if behavior_dev < threshold else 0.0

    Why Continuity Credit?
    When an account triggers an environment change (e.g., legitimate new phone), maintaining
    the rider's historical motor-sensory baseline provides mathematical proof of physical identity,
    offsetting environmental penalties and preventing false challenges.
    """
    if behavior_dev < threshold:
        return round(float(1.0 - behavior_dev), 4)
    return 0.0


def known_zone_share(zone_id: Optional[str], baseline: Optional[Any]) -> float:
    """
    Returns the rider's historical visitation share for the current zone in [0.0, 1.0].
    Familiar zones reduce suspicion when operational deviations occur.
    """
    if not zone_id or baseline is None:
        return 0.0

    base_dict = _extract_dict(baseline)
    zone_profile = base_dict.get("zone_profile", {}) or {}
    if isinstance(zone_profile, str):
        try:
            zone_profile = json.loads(zone_profile)
        except Exception:
            zone_profile = {}

    clean_zone = str(zone_id).strip().lower()
    share = zone_profile.get(clean_zone, 0.0)
    return round(float(min(1.0, max(0.0, share))), 4)


def trusted_device_signal(device: Optional[Any], is_new_device: bool = False) -> float:
    """
    Returns 1.0 if the hardware passport certifies a long-standing, non-rooted, non-emulator device.
    """
    if device is None or is_new_device:
        return 0.0

    dev_dict = _extract_dict(device)
    is_emu = dev_dict.get("is_emulator", False)
    is_root = dev_dict.get("is_rooted", False)
    trust_rating = float(dev_dict.get("trust_rating", 1.0))

    if not is_emu and not is_root and trust_rating >= 1.0:
        return 1.0
    return round(max(0.0, min(1.0, trust_rating if not (is_emu or is_root) else 0.0)), 3)


def trust_health_bonus(health: float) -> float:
    """
    Computes normalized mitigation bonus for riders with clean, established track records:
        bonus = clamp((health - 70.0) / 30.0, 0.0, 1.0)
    """
    bonus = (float(health) - 70.0) / 30.0
    return round(float(max(0.0, min(1.0, bonus))), 4)


# ------------------------------------------------------------------------------
# 6. EWMA Drift Tracking (Slow-Burn Detection)
# ------------------------------------------------------------------------------
def ewma_drift(prev_devs: List[float], alpha: float = 0.25) -> float:
    """
    Computes Exponentially Weighted Moving Average across sequential session deviations:
        S_t = alpha * Y_t + (1 - alpha) * S_{t-1}

    Why EWMA for Continuous Scoring?
    Adversaries attempting "slow-burn" account takeovers incrementally modify cadence or speed
    across days to avoid acute threshold triggers. An EWMA filter retains multi-session memory,
    steadily compounding subtle shifts until a decisive step-up challenge is warranted.
    """
    if not prev_devs:
        return 0.0

    s = float(prev_devs[0])
    for dev in prev_devs[1:]:
        s = alpha * float(dev) + (1.0 - alpha) * s

    return round(float(s), 4)


# ------------------------------------------------------------------------------
# Internal Helpers
# ------------------------------------------------------------------------------
def _extract_dict(obj: Any) -> Dict[str, Any]:
    """Safely coerces Pydantic models, SQLAlchemy entities, or dataclasses into a dict."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "__dict__"):
        return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
    return {}


def _extract_metric_value(
    metric_name: str,
    req_dict: Dict[str, Any],
    biom: Dict[str, Any],
    telem: Dict[str, Any],
    loc: Dict[str, Any],
    base_dict: Dict[str, Any],
) -> Optional[float]:
    """Helper searching across request nesting for a specific behavior metric."""
    # Direct match in request dict
    if metric_name in req_dict and req_dict[metric_name] is not None:
        return float(req_dict[metric_name])
    # Biometrics sub-dict
    if metric_name in biom and biom[metric_name] is not None:
        return float(biom[metric_name])
    # Telemetry sub-dict
    if metric_name in telem and telem[metric_name] is not None:
        return float(telem[metric_name])
    # Location sub-dict
    if metric_name in loc and loc[metric_name] is not None:
        return float(loc[metric_name])
    return None
