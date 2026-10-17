"""
Unit & Integration Tests for TrustJuggler v2 Rider Trust Health & Friction Tiers.
Validates:
- Pure trust health scoring: account tenure, completed trips, passed verifications,
  zero-fraud streaks, and dispute history.
- Friction tiers: NEW (0-39), ESTABLISHED (40-79), TRUSTED (80-100).
- Mitigating signal: trust_health_bonus in [0, 1] (-4.0 pts max).
- Dynamic boundary shifts: +5.0 for TRUSTED, -5.0 for NEW, invariant ESCALATE & rule floors.
- Sharp degradation on active/recent fraud flags.
- Policy boundary expansion for trusted riders without bypassing rule floors.
"""

from app.scoring.features import trust_health_bonus
from app.scoring.risk import ScoringContext, score_session
from app.scoring.trust import (
    TrustProfile,
    calculate_trust_health,
    compute_boundary_shift,
    evaluate_trust_health,
    trust_health_tier,
)


def test_high_tenure_clean_history_gives_trusted_tier():
    """
    Validation: Seasoned account with substantial trip history, passed verifications,
    and zero fraud incidents scores >= 80 and achieves TRUSTED tier.
    """
    res = calculate_trust_health(
        tenure_days=200.0,
        completed_trips=150,
        passed_verifications=5,
        failed_verifications=0,
        zero_fraud_streak_days=180.0,
        dispute_count=0,
        active_fraud_cases=0,
        has_recent_fraud=False,
    )

    assert res.score >= 80.0, f"Expected score >= 80.0, got {res.score}"
    assert res.tier == "TRUSTED"
    assert res.trust_health_bonus > 0.33
    assert res.boundary_shift == 5.0
    assert "TRUSTED" in res.summary


def test_new_rider_low_tenure_gives_new_tier():
    """
    Validation: Fresh account with minimal delivery history and no verifications
    scores < 40 and is classified in the NEW tier with a -5.0 boundary shift.
    """
    res = calculate_trust_health(
        tenure_days=3.0,
        completed_trips=2,
        passed_verifications=0,
        zero_fraud_streak_days=3.0,
        dispute_count=0,
    )

    assert res.score < 40.0, f"Expected score < 40.0, got {res.score}"
    assert res.tier == "NEW"
    assert res.trust_health_bonus == 0.0
    assert res.boundary_shift == -5.0


def test_established_rider_moderate_tenure():
    """
    Validation: Intermediate rider with moderate tenure and completed trips
    scores between 40 and 79, categorized as ESTABLISHED.
    """
    res = calculate_trust_health(
        tenure_days=60.0,
        completed_trips=45,
        passed_verifications=2,
        zero_fraud_streak_days=60.0,
    )

    assert 40.0 <= res.score < 80.0, f"Expected ESTABLISHED score (40-79), got {res.score}"
    assert res.tier == "ESTABLISHED"
    assert -5.0 <= res.boundary_shift <= 5.0


def test_recent_fraud_flag_degrades_trust_health_sharply():
    """
    Validation: An active fraud flag or confirmed incident sharply degrades
    trust health from high standing down to the NEW tier (<= 35.0).
    """
    # 1. Clean seasoned profile
    clean_profile = TrustProfile(
        tenure_days=240.0,
        completed_trips=200,
        passed_verifications=6,
        zero_fraud_streak_days=200.0,
        dispute_count=0,
        active_fraud_cases=0,
        has_recent_fraud=False,
    )
    clean_res = calculate_trust_health(clean_profile)
    assert clean_res.score >= 85.0
    assert clean_res.tier == "TRUSTED"

    # 2. Same rider with active fraud case or recent fraud flag
    flagged_profile = TrustProfile(
        tenure_days=240.0,
        completed_trips=200,
        passed_verifications=6,
        zero_fraud_streak_days=0.0,
        dispute_count=1,
        active_fraud_cases=1,
        has_recent_fraud=True,
    )
    flagged_res = calculate_trust_health(flagged_profile)

    # Sharp degradation assertion
    assert flagged_res.score <= 35.0, (
        f"Expected score <= 35.0 on active fraud, got {flagged_res.score}"
    )
    assert flagged_res.tier == "NEW"
    assert flagged_res.boundary_shift == -5.0
    assert flagged_res.trust_health_bonus == 0.0
    assert clean_res.score - flagged_res.score >= 50.0, "Expected sharp degradation of >= 50 points"


def test_boundary_shift_expands_allow_band_for_trusted_riders():
    """
    Validation: High trust health (+5 shift) softens the MONITOR/CHALLENGE boundary,
    safely expanding the ALLOW band for genuine riders.
    """
    # Synthetic baseline profile
    mock_base = {
        "home_lat": 18.5204,
        "home_lng": 73.8567,
        "home_city": "pune",
        "known_zones": ["koregaon_park"],
        "tap_interval_ms": 150.0,
        "typing_cps": 4.0,
        "swipe_velocity_px_s": 1000.0,
        "interaction_timing_cv": 0.25,
        "nav_path_similarity": 0.5,
        "accept_latency_s": 6.0,
        "shift_hour_dist": 0.0,
        "avg_speed_kmh": 25.0,
        "route_adherence": 0.9,
        "trip_cadence_per_hr": 3.0,
    }

    # Moderate behavioral drift and handset change event that produces risk ~20.0
    event = {
        "rider_id": "rider_trust_test",
        "city": "pune",
        "zone_id": "koregaon_park",
        "telemetry": {
            "tap_interval_ms": 230.0,
            "typing_cps": 2.2,
            "swipe_velocity_px_s": 600.0,
            "shift_hour_dist": 3.0,
            "nav_path_similarity": 0.15,
        },
        "device_passport": {
            "is_new_device": True,
            "trust_rating": 0.8,
        },
    }

    # Case A: Low trust health (30.0 -> NEW tier, shift = -5.0)
    # allow_threshold drops to 15.0, resulting in MONITOR
    ctx_low = ScoringContext(
        request_or_event=event,
        baseline=mock_base,
        trust_health=30.0,
    )
    scored_low = score_session(ctx_low)

    # Case B: Trusted rider (95.0 -> TRUSTED tier, shift = +5.0)
    # allow_threshold rises to 25.0, resulting in ALLOW
    ctx_trusted = ScoringContext(
        request_or_event=event,
        baseline=mock_base,
        trust_health=95.0,
    )
    scored_trusted = score_session(ctx_trusted)

    # The trusted rider benefits from both the -4 pt mitigation deduction
    # AND the expanded ALLOW boundary
    assert scored_trusted.risk_score < scored_low.risk_score
    # Low trust health experiences higher friction tier (MONITOR)
    assert scored_low.verdict == "MONITOR"
    # High trust health expands ALLOW band (ALLOW)
    assert scored_trusted.verdict == "ALLOW"


def test_rule_floors_never_bypassed_by_trust_health():
    """
    Invariant: Hard rule floors (60 for travel/gps, 75 for liveness/handoff)
    and ESCALATE boundaries NEVER move, regardless of maximum trust health (100.0).
    """
    # Rider with maximum trust health (100.0)
    ctx_spoof = ScoringContext(
        request_or_event={
            "rider_id": "rider_super_trusted",
            "location": {"mock_location_detected": True},
        },
        trust_health=100.0,
    )
    scored = score_session(ctx_spoof)

    # GPS spoofing mandates a 60.0 floor
    assert scored.risk_score >= 60.0
    assert scored.verdict in ["CHALLENGE", "ESCALATE"]
    assert scored.verdict != "ALLOW"
    assert scored.verdict != "MONITOR"
    assert "GPS_SPOOFING" in scored.threat_tags


def test_trust_health_bonus_mitigation_max_minus_four():
    """
    Validation: Trust health bonus scales linearly from 70.0 (0.0 bonus)
    to 100.0 (1.0 bonus = -4.0 points maximum risk mitigation).
    """
    assert trust_health_bonus(100.0) == 1.0
    assert trust_health_bonus(85.0) == 0.5
    assert trust_health_bonus(70.0) == 0.0
    assert trust_health_bonus(50.0) == 0.0

    # In scoring combiner components
    ctx_max = ScoringContext(
        request_or_event={"rider_id": "rider_bonus_test"},
        trust_health=100.0,
    )
    scored_max = score_session(ctx_max)
    # pts_trust_health should be -4.0
    assert scored_max.components["pts_trust_health"] == -4.0

    ctx_zero = ScoringContext(
        request_or_event={"rider_id": "rider_bonus_test"},
        trust_health=70.0,
    )
    scored_zero = score_session(ctx_zero)
    assert scored_zero.components["pts_trust_health"] == 0.0


def test_tier_classification_and_boundary_shift_consistency():
    """
    Validation: Tests boundary shift and tier helpers across key inflection points.
    """
    assert trust_health_tier(90.0) == "TRUSTED"
    assert trust_health_tier(80.0) == "TRUSTED"
    assert trust_health_tier(79.9) == "ESTABLISHED"
    assert trust_health_tier(40.0) == "ESTABLISHED"
    assert trust_health_tier(39.9) == "NEW"
    assert trust_health_tier(0.0) == "NEW"

    assert compute_boundary_shift(100.0) == 5.0
    assert compute_boundary_shift(70.0) == 0.0
    assert compute_boundary_shift(40.0) == -5.0
    assert compute_boundary_shift(20.0) == -5.0


def test_evaluate_trust_health_context_adapter():
    """
    Validation: Tests adapter handling of numbers, dicts, and TrustProfile instances.
    """
    # 1. Number
    ctx_num = ScoringContext(request_or_event={}, trust_health=90.0)
    res_num = evaluate_trust_health(ctx_num)
    assert res_num.score == 90.0
    assert res_num.tier == "TRUSTED"

    # 2. TrustProfile
    profile = TrustProfile(tenure_days=180.0, completed_trips=100, passed_verifications=4)
    ctx_prof = ScoringContext(request_or_event={}, trust_health=profile)
    res_prof = evaluate_trust_health(ctx_prof)
    assert res_prof.score >= 80.0
    assert res_prof.tier == "TRUSTED"

    # 3. Dict
    ctx_dict = ScoringContext(
        request_or_event={},
        trust_health={"tenure_days": 20.0, "completed_trips": 10},
    )
    res_dict = evaluate_trust_health(ctx_dict)
    assert res_dict.score < 50.0
