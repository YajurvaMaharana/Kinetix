"""
Unit Tests for TrustJuggler Feature Extraction and Thresholds Engine.
Pure functional testing with NO Database dependencies and NO I/O.

Verifies:
1. Robust Z-scores with per-metric MAD floors and outlier resistance
2. Circular hour distance wrapping midnight
3. Dynamic device weight attenuation on tap, typing, and swipe
4. Cold-start handling (<5 sessions gives low_confidence=True and cohort defaults)
5. Nav similarity drop raises behavioral deviation
6. Ordinary change (new device, same behavior) gives env >= 0.3 and behavior_dev < 0.35
7. Account handoff gives behavior_dev >= 0.55
8. Environmental change scoring and regional adjacency half-credit discounts
9. Sensitive action scoring with temporal velocity boost (x1.3 within 24h of new environment)
10. Mitigations: continuity, known zone share, trusted device signal, trust health bonus
11. EWMA drift tracking for slow-burn handoff detection
12. Deterministic rule evaluation hooks and mandatory floors
"""

from app.scoring.features import (
    behavior_continuity,
    behavior_deviation,
    circular_hour_distance,
    environment_change,
    ewma_drift,
    known_zone_share,
    robust_z,
    sensitive_actions,
    trust_health_bonus,
    trusted_device_signal,
)
from app.scoring.risk import ScoringContext
from app.scoring.rules import evaluate_rules
from app.scoring.thresholds import DEFAULT_THRESHOLDS, ThresholdConfig


def test_robust_z_and_floors():
    """
    Verifies robust z-score calculation and safeguarding against zero-variance baselines.
    Why: Prevents division by zero and false alerts when a rider has identical historical values.
    """
    # 1. Exact median gives z = 0.0
    assert robust_z(value=180.0, median=180.0, mad=15.0) == 0.0

    # 2. Known deviation: |195 - 180| / (1.4826 * 10) = 15 / 14.826 ~= 1.0117
    z = robust_z(value=195.0, median=180.0, mad=10.0)
    assert 1.01 <= z <= 1.02

    # 3. Vanishing MAD uses metric floor, preventing ZeroDivisionError
    z_floor = robust_z(value=182.0, median=180.0, mad=0.0, floor=1.5)
    # 2.0 / (1.4826 * 1.5) = 2.0 / 2.2239 ~= 0.8993
    assert 0.89 <= z_floor <= 0.91


def test_circular_hour_distance_midnight_wrap():
    """
    Verifies that circular hour distance wraps midnight correctly on a 24-hour dial.
    Why: A shift spanning 23:00 to 01:00 has a true elapsed distance of 2 hours, not 22 hours.
    """
    # 23:00 to 01:00 -> 2 hours
    assert circular_hour_distance(23.0, 1.0) == 2.0
    assert circular_hour_distance(1.0, 23.0) == 2.0

    # 23.5 (11:30 PM) to 0.5 (12:30 AM) -> 1 hour
    assert circular_hour_distance(23.5, 0.5) == 1.0

    # Same hour -> 0 distance
    assert circular_hour_distance(14.0, 14.0) == 0.0

    # Diametric opposite -> 12 hours
    assert circular_hour_distance(6.0, 18.0) == 12.0


def test_nav_similarity_drop_raises_deviation():
    """
    Verifies that a drop in screen navigation path similarity increases behavioral deviation.
    Why: Navigating the app in an atypical sequence indicates an unfamiliar user or attacker.
    """
    baseline = {
        "sessions_count": 20,
        "metrics": {
            "nav_path_similarity": {"median": 0.88, "mad": 0.04},
            "tap_interval_ms": {"median": 180.0, "mad": 15.0},
            "typing_cps": {"median": 4.5, "mad": 0.3},
            "swipe_velocity_px_s": {"median": 1000.0, "mad": 80.0},
            "interaction_timing_cv": {"median": 0.30, "mad": 0.03},
            "accept_latency_s": {"median": 5.0, "mad": 1.0},
            "shift_hour_dist": {"median": 0.8, "mad": 0.4},
            "avg_speed_kmh": {"median": 25.0, "mad": 2.5},
            "route_adherence": {"median": 0.90, "mad": 0.03},
            "trip_cadence_per_hr": {"median": 2.5, "mad": 0.3},
        },
        "hour_profile": {"mean": 10.0},
    }

    # Session with normal high nav similarity
    req_normal = {
        "nav_path_similarity": 0.87,
        "tap_interval_ms": 180.0,
        "typing_cps": 4.5,
        "swipe_velocity_px_s": 1000.0,
        "interaction_timing_cv": 0.30,
        "accept_latency_s": 5.0,
        "start_hour": 10.0,
        "avg_speed_kmh": 25.0,
        "route_adherence": 0.90,
        "trip_cadence_per_hr": 2.5,
    }
    ctx_normal = ScoringContext(request_or_event=req_normal, baseline=baseline)
    res_normal = behavior_deviation(ctx_normal)

    # Session with collapsed nav similarity
    req_dropped = dict(req_normal, nav_path_similarity=0.35)
    ctx_dropped = ScoringContext(request_or_event=req_dropped, baseline=baseline)
    res_dropped = behavior_deviation(ctx_dropped)

    assert (
        res_dropped.metric_deviations["nav_path_similarity"]
        > res_normal.metric_deviations["nav_path_similarity"]
    )
    assert res_dropped.behavior_dev > res_normal.behavior_dev


def test_new_device_weight_attenuation():
    """
    Verifies that touch biometrics (tap, typing, swipe) weights are halved on new devices.
    Why: Prevents false positives caused by new screen glass, keyboard size, or tactile feedback.
    """
    baseline = {
        "sessions_count": 15,
        "metrics": {m: {"median": 100.0, "mad": 10.0} for m in DEFAULT_THRESHOLDS.metric_weights},
        "hour_profile": {"mean": 12.0},
    }
    req = {"tap_interval_ms": 100.0, "is_new_device": False}

    ctx_old = ScoringContext(request_or_event=req, baseline=baseline)
    res_old = behavior_deviation(ctx_old)

    ctx_new = ScoringContext(request_or_event=dict(req, is_new_device=True), baseline=baseline)
    res_new = behavior_deviation(ctx_new)

    # Tap, typing, swipe weights should be exactly halved
    assert (
        res_new.metric_records["tap_interval_ms"].weight
        == res_old.metric_records["tap_interval_ms"].weight * 0.5
    )
    assert (
        res_new.metric_records["typing_cps"].weight
        == res_old.metric_records["typing_cps"].weight * 0.5
    )
    assert (
        res_new.metric_records["swipe_velocity_px_s"].weight
        == res_old.metric_records["swipe_velocity_px_s"].weight * 0.5
    )

    # Non-touch metrics remain unchanged
    assert (
        res_new.metric_records["avg_speed_kmh"].weight
        == res_old.metric_records["avg_speed_kmh"].weight
    )
    assert (
        res_new.metric_records["nav_path_similarity"].weight
        == res_old.metric_records["nav_path_similarity"].weight
    )


def test_cold_start_cohort_defaults():
    """
    Verifies cold start detection when a rider has < 5 historical sessions.
    Why: Protects new riders from spurious high z-scores by falling back to cohort expectations.
    """
    req = {"tap_interval_ms": 190.0, "typing_cps": 4.5}

    # 1. No baseline at all
    ctx_none = ScoringContext(request_or_event=req, baseline=None)
    res_none = behavior_deviation(ctx_none)
    assert res_none.low_confidence is True

    # 2. Baseline with only 2 sessions (< 5)
    ctx_few = ScoringContext(request_or_event=req, baseline={"sessions_count": 2, "metrics": {}})
    res_few = behavior_deviation(ctx_few)
    assert res_few.low_confidence is True

    # 3. Established baseline with 10 sessions
    ctx_est = ScoringContext(
        request_or_event=req,
        baseline={
            "sessions_count": 10,
            "metrics": {"tap_interval_ms": {"median": 190.0, "mad": 15.0}},
        },
    )
    res_est = behavior_deviation(ctx_est)
    assert res_est.low_confidence is False


def test_ordinary_change_vs_handoff():
    """
    Verifies acceptance criteria:
    - Ordinary change (new device, same behavior) gives env >= 0.3 and behavior_dev < 0.35.
    - Handoff (different persona's behavior) gives behavior_dev >= 0.55.
    Why: Distinguishes legitimate life transitions from fraudulent account sharing.
    """
    baseline = {
        "sessions_count": 25,
        "home_city": "Mumbai",
        "zone_profile": {"bandra_west": 0.80, "andheri_east": 0.20},
        "hour_profile": {"mean": 10.0},
        "metrics": {
            "tap_interval_ms": {"median": 180.0, "mad": 15.0},
            "typing_cps": {"median": 4.5, "mad": 0.35},
            "swipe_velocity_px_s": {"median": 1000.0, "mad": 75.0},
            "interaction_timing_cv": {"median": 0.30, "mad": 0.03},
            "nav_path_similarity": {"median": 0.88, "mad": 0.03},
            "accept_latency_s": {"median": 5.0, "mad": 0.9},
            "shift_hour_dist": {"median": 0.8, "mad": 0.3},
            "avg_speed_kmh": {"median": 26.0, "mad": 2.2},
            "route_adherence": {"median": 0.92, "mad": 0.025},
            "trip_cadence_per_hr": {"median": 2.4, "mad": 0.25},
        },
    }

    # 1. ORDINARY CHANGE CASE:
    # New phone (is_new_device=True), slight 8% biometrics shift, same driving/delivery behavior
    req_ordinary = {
        "is_new_device": True,
        "city": "Mumbai",
        "zone_id": "bandra_west",
        "start_hour": 10.2,
        # Biometrics shifted slightly (8%) on new screen
        "tap_interval_ms": 194.0,  # +8%
        "typing_cps": 4.2,  # -7%
        "swipe_velocity_px_s": 1070.0,  # +7%
        "interaction_timing_cv": 0.31,
        "nav_path_similarity": 0.86,
        "accept_latency_s": 5.2,
        "avg_speed_kmh": 26.5,
        "route_adherence": 0.91,
        "trip_cadence_per_hr": 2.4,
    }
    ctx_ord = ScoringContext(request_or_event=req_ordinary, baseline=baseline)
    env_ord = environment_change(ctx_ord)
    res_ord = behavior_deviation(ctx_ord)

    assert env_ord >= 0.3, f"Ordinary change environment score must be >= 0.3, got {env_ord}"
    assert res_ord.behavior_dev < 0.35, (
        f"Ordinary change behavior dev must be < 0.35, got {res_ord.behavior_dev}"
    )

    # 2. HANDOFF CASE:
    # Attacker operates account with substantially different biometric signature
    req_handoff = {
        "is_new_device": True,
        "city": "Mumbai",
        "zone_id": "bandra_west",
        "start_hour": 18.0,  # 8 hours off shift mean
        # Radical divergence across all motor-sensory metrics
        "tap_interval_ms": 270.0,  # massive dwell time
        "typing_cps": 2.2,  # very slow typing
        "swipe_velocity_px_s": 550.0,  # sluggish swipes
        "interaction_timing_cv": 0.52,  # chaotic timing
        "nav_path_similarity": 0.42,  # unfamiliar with delivery flow
        "accept_latency_s": 14.5,  # hesitant acceptance
        "avg_speed_kmh": 37.0,  # completely different vehicle speed
        "route_adherence": 0.68,
        "trip_cadence_per_hr": 1.1,
    }
    ctx_handoff = ScoringContext(request_or_event=req_handoff, baseline=baseline)
    res_handoff = behavior_deviation(ctx_handoff)

    assert res_handoff.behavior_dev >= 0.55, (
        f"Handoff behavior dev must be >= 0.55, got {res_handoff.behavior_dev}"
    )


def test_environment_change_components_and_adjacency():
    """
    Verifies environment weights (device: 0.35, city: 0.30, zone: 0.10, asn: 0.25)
    and regional adjacency half-credit discounts.
    Why: Calibrates risk proportional to physical feasibility, avoiding false alarms on adjacent commutes.
    """
    baseline = {
        "home_city": "mumbai",
        "zone_profile": {"bandra_west": 1.0},
        "asns": ["AS55836"],
    }

    # 1. New device alone -> 0.35
    ctx_dev = ScoringContext(
        request_or_event={
            "is_new_device": True,
            "city": "mumbai",
            "zone_id": "bandra_west",
            "asn": "AS55836",
        },
        baseline=baseline,
    )
    assert environment_change(ctx_dev) == 0.35

    # 2. Distant non-adjacent city (Delhi) -> 0.30
    ctx_delhi = ScoringContext(
        request_or_event={
            "is_new_device": False,
            "city": "delhi",
            "zone_id": "connaught_place",
            "asn": "AS55836",
        },
        baseline=baseline,
    )
    # City 0.30 + new zone 0.10 = 0.40
    assert environment_change(ctx_delhi) == 0.40

    # 3. Adjacent city (Pune <-> Mumbai) gets 0.5x discount on city change (0.30 * 0.5 = 0.15)
    ctx_pune = ScoringContext(
        request_or_event={
            "is_new_device": False,
            "city": "pune",
            "zone_id": "bandra_west",
            "asn": "AS55836",
        },
        baseline=baseline,
    )
    assert environment_change(ctx_pune) == 0.15

    # 4. Adjacent zone (Bandra West <-> Andheri East) gets 0.5x discount on zone change (0.10 * 0.5 = 0.05)
    ctx_adj_zone = ScoringContext(
        request_or_event={
            "is_new_device": False,
            "city": "mumbai",
            "zone_id": "andheri_east",
            "asn": "AS55836",
        },
        baseline=baseline,
    )
    assert environment_change(ctx_adj_zone) == 0.05

    # 5. Non-adjacent zone -> 0.10
    ctx_diff_zone = ScoringContext(
        request_or_event={
            "is_new_device": False,
            "city": "mumbai",
            "zone_id": "electronic_city",
            "asn": "AS55836",
        },
        baseline=baseline,
    )
    assert environment_change(ctx_diff_zone) == 0.10

    # 6. Clipping at 1.0
    ctx_all = ScoringContext(
        request_or_event={
            "is_new_device": True,
            "city": "delhi",
            "zone_id": "dwarka",
            "asn": "AS99999",
        },
        baseline=baseline,
    )
    # 0.35 + 0.30 + 0.10 + 0.25 = 1.0
    assert environment_change(ctx_all) == 1.0


def test_sensitive_actions_and_velocity_boost():
    """
    Verifies sensitive action penalties and 1.3x velocity boost when linked to a new environment.
    Why: Immediate payout redirects on newly registered hardware represent the highest-risk ATO signature.
    """
    # 1. Payout update on established device -> 0.5
    ctx_payout = ScoringContext(
        request_or_event={"financial": {"payout_account_changed": True}, "is_new_device": False}
    )
    assert sensitive_actions(ctx_payout) == 0.5

    # 2. Payout update within 24h of new device -> 0.5 * 1.3 = 0.65
    ctx_payout_boost = ScoringContext(
        request_or_event={"financial": {"payout_account_changed": True}, "is_new_device": True}
    )
    assert sensitive_actions(ctx_payout_boost) == 0.65

    # 3. Multiple actions: Payout (0.5) + Phone (0.3) + Password (0.2) = 1.0
    ctx_multi = ScoringContext(
        request_or_event={
            "financial": {"payout_account_changed": True},
            "phone_updated": True,
            "password_updated": True,
            "is_new_device": False,
        }
    )
    assert sensitive_actions(ctx_multi) == 1.0


def test_mitigation_helpers():
    """
    Verifies positive trust mitigation helpers:
    1. Continuity: (1 - behavior_dev) if behavior_dev < 0.35 else 0.0
    2. Known zone share from baseline profile
    3. Trusted device attestation signal
    4. Trust health bonus: clamp((health - 70) / 30, 0, 1)
    """
    # 1. Continuity
    assert behavior_continuity(0.10) == 0.90
    assert behavior_continuity(0.30) == 0.70
    assert behavior_continuity(0.35) == 0.0
    assert behavior_continuity(0.60) == 0.0

    # 2. Known zone share
    base = {"zone_profile": {"bandra_west": 0.75, "powai": 0.25}}
    assert known_zone_share("bandra_west", base) == 0.75
    assert known_zone_share("powai", base) == 0.25
    assert known_zone_share("unknown_zone", base) == 0.0

    # 3. Trusted device signal
    trusted_dev = {"is_emulator": False, "is_rooted": False, "trust_rating": 1.0}
    assert trusted_device_signal(trusted_dev, is_new_device=False) == 1.0
    assert trusted_device_signal(trusted_dev, is_new_device=True) == 0.0
    emulator_dev = {"is_emulator": True, "is_rooted": False, "trust_rating": 0.8}
    assert trusted_device_signal(emulator_dev, is_new_device=False) == 0.0

    # 4. Trust health bonus
    assert trust_health_bonus(100.0) == 1.0
    assert trust_health_bonus(85.0) == 0.5
    assert trust_health_bonus(70.0) == 0.0
    assert trust_health_bonus(50.0) == 0.0


def test_ewma_drift():
    """
    Verifies EWMA filter accumulates multi-session drift for slow-burn handoff detection.
    Why: Smooths noise while compounding systematic biometric displacement across consecutive shifts.
    """
    # Empty list
    assert ewma_drift([]) == 0.0

    # Single deviation
    assert ewma_drift([0.20]) == 0.20

    # Multi-session sequence with alpha = 0.25
    # S_0 = 0.20
    # S_1 = 0.25 * 0.40 + 0.75 * 0.20 = 0.10 + 0.15 = 0.25
    # S_2 = 0.25 * 0.60 + 0.75 * 0.25 = 0.15 + 0.1875 = 0.3375
    drift = ewma_drift([0.20, 0.40, 0.60], alpha=0.25)
    assert drift == 0.3375


def test_thresholds_dataclass_and_override():
    """
    Verifies that ThresholdConfig holds all versioned scoring parameters
    and can load overrides from PolicyConfig or dict without breaking defaults.
    """
    cfg = ThresholdConfig()
    assert cfg.allow_threshold == 24.0
    assert cfg.monitor_threshold == 44.0
    assert cfg.escalate_threshold == 75.0
    assert cfg.ordinary_change_cap == 44.0
    assert cfg.suspected_handoff_floor == 75.0

    # Custom override from dictionary
    custom = ThresholdConfig.from_policy_config(
        {"allow_threshold": 20.0, "monitor_threshold": 40.0}
    )
    assert custom.allow_threshold == 20.0
    assert custom.monitor_threshold == 40.0
    # Other values remain intact
    assert custom.escalate_threshold == 75.0


def test_rules_evaluation_hooks():
    """
    Verifies deterministic security rule hooks, points accumulation, and mandatory floors.
    Why: High-confidence fraud indicators must enforce non-negotiable floor constraints.
    """
    # 1. IMPOSSIBLE_TRAVEL (+25, floor 60)
    ctx_imp = ScoringContext(request_or_event={"telemetry": {"impossible_travel_detected": True}})
    res_imp = evaluate_rules(ctx_imp)
    assert res_imp.rule_points == 25.0
    assert res_imp.rule_floor == 60.0
    assert "IMPOSSIBLE_TRAVEL" in res_imp.threat_tags

    # 2. GPS_SPOOFING (+20, floor 60)
    ctx_gps = ScoringContext(request_or_event={"telemetry": {"mock_location_detected": True}})
    res_gps = evaluate_rules(ctx_gps)
    assert res_gps.rule_points == 20.0
    assert res_gps.rule_floor == 60.0
    assert "GPS_SPOOFING" in res_gps.threat_tags

    # 3. FACE_MISMATCH (+30, floor 75)
    ctx_face = ScoringContext(request_or_event={"biometrics": {"face_match_confidence": 0.25}})
    res_face = evaluate_rules(ctx_face)
    assert res_face.rule_points == 30.0
    assert res_face.rule_floor == 75.0
    assert "ACCOUNT_HANDOFF" in res_face.threat_tags

    # 4. LIVENESS_FAILED (+30, floor 75)
    ctx_live = ScoringContext(request_or_event={"biometrics": {"liveness_score": 0.15}})
    res_live = evaluate_rules(ctx_live)
    assert res_live.rule_points == 30.0
    assert res_live.rule_floor == 75.0

    # 5. MULTI_ACCOUNT_DEVICE_RING (+15, floor 60)
    ctx_ring = ScoringContext(request_or_event={"telemetry": {"shared_device_count": 4}})
    res_ring = evaluate_rules(ctx_ring)
    assert res_ring.rule_points == 15.0
    assert res_ring.rule_floor == 60.0
    assert "FRAUD_RING" in res_ring.threat_tags

    # 6. Clean session -> 0 points, 0 floor
    ctx_clean = ScoringContext(request_or_event={})
    res_clean = evaluate_rules(ctx_clean)
    assert res_clean.rule_points == 0.0
    assert res_clean.rule_floor == 0.0
    assert len(res_clean.threat_tags) == 0
