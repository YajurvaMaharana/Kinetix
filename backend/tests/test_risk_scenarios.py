"""
Unit Tests for TrustJuggler v2 Multi-Modal Risk Scenarios.
Implements the canonical end-to-end evaluation scenarios:
- N1: Normal Routine Baseline (Established handset, home territory)
- N2: Normal Session with Minor Drift (Slight schedule/route variance)
- O1: Ordinary Life Change - New Phone (Hardware update, authentic biometrics)
- O2: Ordinary Life Change - Relocation (Inter-city relocation, authentic biometrics)
- O3: Ordinary Life Change - New Zone (Delivery territory expansion)
- O4: Ordinary Life Change - New Phone + New Zone (Combined transition)
- B1: Behavioral / Financial Step-Up Challenge (Payout modification / unusual cadence)
- T1: Travel Violation - Impossible Travel (>800 km/h or cross-city teleport)
- T2: Travel Violation - GPS Spoofing (Mock location provider / synthetic route)
- H1: Account Takeover - Classic Handoff (Adversary operating victim account)
- H2: Account Takeover - Face Mismatch / Liveness Failed (Biometric failure)
- H3: Account Takeover - Concurrent Session (Simultaneous dispatch in distant sectors)

Verifies:
1. Asserted risk score ranges and decision tier bands
2. Factor decomposition: at least 1 factor present on every assessment
3. Ordinary change invariants: risk <= 44, mitigating factors present
4. Account handoff invariants: risk >= 75, summary explicitly mentions behavioral deviation
"""

import pytest

from app.scoring.risk import ScoringContext, score_session


@pytest.fixture
def baseline_rider():
    """Authentic established rider baseline profile."""
    return {
        "rider_id": "rider_mumbai_001",
        "home_city": "mumbai",
        "sessions_count": 45,
        "asns": ["AS133612", "AS55836"],
        "hour_profile": {"mean": 14.5, "std": 1.8},
        "zone_profile": {
            "bandra_west": 0.65,
            "andheri_east": 0.25,
            "powai": 0.10,
        },
        "metrics": {
            "tap_interval_ms": {"median": 185.0, "mad": 12.0},
            "typing_cps": {"median": 4.8, "mad": 0.4},
            "swipe_velocity_px_s": {"median": 1150.0, "mad": 95.0},
            "interaction_timing_cv": {"median": 0.28, "mad": 0.03},
            "nav_path_similarity": {"median": 0.88, "mad": 0.04},
            "accept_latency_s": {"median": 5.2, "mad": 1.1},
            "shift_hour_dist": {"median": 0.6, "mad": 0.4},
            "avg_speed_kmh": {"median": 24.5, "mad": 3.2},
            "route_adherence": {"median": 0.89, "mad": 0.03},
            "trip_cadence_per_hr": {"median": 2.6, "mad": 0.3},
        },
    }


# ==============================================================================
# 1. Normal Scenarios (N1, N2)
# ==============================================================================
def test_scenario_N1_routine_baseline(baseline_rider):
    """
    Scenario N1: Authentic routine delivery shift on enrolled device in home zone.
    Expected:
    - Verdict: ALLOW (Risk in [0, 24])
    - Classification: 'normal'
    - Factors: Present (at least one factor)
    - Rider-safe message: Transparent, reassurance without scores
    """
    event = {
        "session_id": "sess_n1_routine",
        "rider_id": "rider_mumbai_001",
        "city": "mumbai",
        "zone_id": "bandra_west",
        "start_hour": 14.5,
        "is_new_device": False,
        "tap_interval_ms": 185.0,
        "typing_cps": 4.8,
        "swipe_velocity_px_s": 1150.0,
        "interaction_timing_cv": 0.28,
        "nav_path_similarity": 0.90,
        "accept_latency_s": 5.1,
        "avg_speed_kmh": 24.5,
        "route_adherence": 0.90,
        "trip_cadence_per_hr": 2.6,
        "biometrics": {"face_match_confidence": 0.96, "liveness_score": 0.95},
        "telemetry": {"speed_variance": 18.0, "straightness_ratio": 0.82},
    }

    ctx = ScoringContext(
        request_or_event=event,
        baseline=baseline_rider,
        device_passport={"is_trusted": True, "trust_rating": 0.95},
        trust_health=85.0,
    )

    assessment = score_session(ctx)

    assert 0.0 <= assessment.risk_score <= 24.0
    assert assessment.verdict == "ALLOW"
    assert assessment.risk_tier == "LOW"
    assert assessment.classification == "normal"
    assert len(assessment.factors) >= 1
    assert "good standing" in assessment.rider_safe_text.lower()


def test_scenario_N2_normal_minor_variation(baseline_rider):
    """
    Scenario N2: Genuine rider delivers at slightly shifted hour with minor traffic variations.
    Expected:
    - Verdict: ALLOW (Risk in [0, 24])
    - Factors: Present
    - Ordinary life variance within allowable margins
    """
    event = {
        "session_id": "sess_n2_minor_drift",
        "rider_id": "rider_mumbai_001",
        "city": "mumbai",
        "zone_id": "andheri_east",  # Known zone (25% historical share)
        "start_hour": 16.5,         # 2 hours from median
        "is_new_device": False,
        "tap_interval_ms": 195.0,   # slight variation
        "typing_cps": 4.5,
        "swipe_velocity_px_s": 1100.0,
        "interaction_timing_cv": 0.31,
        "nav_path_similarity": 0.84,
        "accept_latency_s": 6.0,
        "avg_speed_kmh": 22.0,
        "route_adherence": 0.86,
        "trip_cadence_per_hr": 2.3,
        "biometrics": {"face_match_confidence": 0.94, "liveness_score": 0.92},
        "telemetry": {"speed_variance": 15.0, "straightness_ratio": 0.80},
    }

    ctx = ScoringContext(
        request_or_event=event,
        baseline=baseline_rider,
        device_passport={"is_trusted": True, "trust_rating": 0.90},
        trust_health=82.0,
    )

    assessment = score_session(ctx)

    assert 0.0 <= assessment.risk_score <= 24.0
    assert assessment.verdict == "ALLOW"
    assert len(assessment.factors) >= 1


# ==============================================================================
# 2. Ordinary Change Scenarios (O1 - O4)
# ==============================================================================
def test_scenario_O1_ordinary_new_phone(baseline_rider):
    """
    Scenario O1: Genuine rider upgrades to a new phone.
    Touch biometrics shift 10-15%, but motor rhythm and delivery patterns match baseline.
    Expected:
    - Risk capped at ordinary_change_cap (<= 44.0)
    - Verdict in ('ALLOW', 'MONITOR') -> NEVER CHALLENGE or ESCALATE
    - Classification: 'ordinary_change'
    - Mitigating factors: MUST be present (continuity credit)
    """
    event = {
        "session_id": "sess_o1_new_phone",
        "rider_id": "rider_mumbai_001",
        "city": "mumbai",
        "zone_id": "bandra_west",
        "start_hour": 14.5,
        "is_new_device": True,      # New device token
        "tap_interval_ms": 210.0,   # 13% shift due to larger screen form-factor
        "typing_cps": 4.2,          # keyboard width adaptation
        "swipe_velocity_px_s": 1280.0,
        "interaction_timing_cv": 0.29,
        "nav_path_similarity": 0.89,  # Screen navigation identical
        "accept_latency_s": 5.3,
        "avg_speed_kmh": 25.0,
        "route_adherence": 0.89,
        "trip_cadence_per_hr": 2.5,
        "biometrics": {"face_match_confidence": 0.95, "liveness_score": 0.94},
        "telemetry": {"speed_variance": 19.0, "straightness_ratio": 0.84},
    }

    ctx = ScoringContext(
        request_or_event=event,
        baseline=baseline_rider,
        device_passport={"is_new": True, "is_trusted": False},
        trust_health=88.0,
    )

    assessment = score_session(ctx)

    assert 0.0 <= assessment.risk_score <= 44.0
    assert assessment.verdict in ("ALLOW", "MONITOR")
    assert assessment.classification == "ordinary_change"
    assert len(assessment.factors) >= 1
    assert len(assessment.mitigating_factors) >= 1
    assert any("continuity" in m.name.lower() or "behavior" in m.description.lower() for m in assessment.mitigating_factors)
    assert "new device" in assessment.rider_safe_text.lower()


def test_scenario_O2_ordinary_relocation(baseline_rider):
    """
    Scenario O2: Rider moves to an adjacent city (Pune).
    City changes, but the rider's personal biometric identity and pace remain consistent.
    Expected:
    - Risk capped at ordinary_change_cap (<= 44.0)
    - Verdict in ('ALLOW', 'MONITOR')
    - Classification: 'ordinary_change'
    - Mitigating factors: MUST be present
    """
    event = {
        "session_id": "sess_o2_relocation",
        "rider_id": "rider_mumbai_001",
        "city": "pune",             # Adjacent metropolitan city
        "zone_id": "kothrud",
        "start_hour": 14.0,
        "is_new_device": False,     # Same primary phone
        "tap_interval_ms": 186.0,
        "typing_cps": 4.8,
        "swipe_velocity_px_s": 1160.0,
        "interaction_timing_cv": 0.28,
        "nav_path_similarity": 0.87,
        "accept_latency_s": 5.4,
        "avg_speed_kmh": 24.0,
        "route_adherence": 0.87,
        "trip_cadence_per_hr": 2.5,
        "biometrics": {"face_match_confidence": 0.96, "liveness_score": 0.93},
    }

    ctx = ScoringContext(
        request_or_event=event,
        baseline=baseline_rider,
        device_passport={"is_trusted": True, "trust_rating": 0.95},
        trust_health=85.0,
    )

    assessment = score_session(ctx)

    assert 0.0 <= assessment.risk_score <= 44.0
    assert assessment.verdict in ("ALLOW", "MONITOR")
    assert assessment.classification == "ordinary_change"
    assert len(assessment.mitigating_factors) >= 1


def test_scenario_O3_ordinary_new_zone(baseline_rider):
    """
    Scenario O3: Rider delivers in an adjacent zone (Powai/Colaba).
    Expected:
    - Risk capped at <= 44.0 (typically ALLOW or low MONITOR)
    - Mitigating factors present
    """
    event = {
        "session_id": "sess_o3_new_zone",
        "rider_id": "rider_mumbai_001",
        "city": "mumbai",
        "zone_id": "colaba",        # Adjacent zone
        "start_hour": 14.5,
        "is_new_device": False,
        "tap_interval_ms": 185.0,
        "typing_cps": 4.7,
        "swipe_velocity_px_s": 1140.0,
        "interaction_timing_cv": 0.28,
        "nav_path_similarity": 0.88,
        "accept_latency_s": 5.2,
        "avg_speed_kmh": 23.5,
        "route_adherence": 0.88,
        "trip_cadence_per_hr": 2.6,
        "biometrics": {"face_match_confidence": 0.95, "liveness_score": 0.94},
    }

    ctx = ScoringContext(
        request_or_event=event,
        baseline=baseline_rider,
        device_passport={"is_trusted": True, "trust_rating": 0.95},
        trust_health=85.0,
    )

    assessment = score_session(ctx)

    assert 0.0 <= assessment.risk_score <= 44.0
    assert assessment.verdict in ("ALLOW", "MONITOR")
    assert assessment.classification in ("ordinary_change", "normal")
    assert len(assessment.mitigating_factors) >= 1


def test_scenario_O4_ordinary_new_phone_and_zone(baseline_rider):
    """
    Scenario O4: Combined life change - new handset and expanding to a new operational zone.
    Expected:
    - Risk bounded by ordinary_change_cap (<= 44.0)
    - Classification: 'ordinary_change'
    - Mitigating factors present
    """
    event = {
        "session_id": "sess_o4_combo_change",
        "rider_id": "rider_mumbai_001",
        "city": "mumbai",
        "zone_id": "dadar",         # Adjacent zone
        "start_hour": 15.0,
        "is_new_device": True,      # New handset
        "tap_interval_ms": 205.0,
        "typing_cps": 4.3,
        "swipe_velocity_px_s": 1240.0,
        "interaction_timing_cv": 0.30,
        "nav_path_similarity": 0.86,
        "accept_latency_s": 5.6,
        "avg_speed_kmh": 23.0,
        "route_adherence": 0.86,
        "trip_cadence_per_hr": 2.4,
        "biometrics": {"face_match_confidence": 0.94, "liveness_score": 0.92},
    }

    ctx = ScoringContext(
        request_or_event=event,
        baseline=baseline_rider,
        device_passport={"is_new": True, "is_trusted": False},
        trust_health=85.0,
    )

    assessment = score_session(ctx)

    assert 0.0 <= assessment.risk_score <= 44.0
    assert assessment.verdict in ("ALLOW", "MONITOR")
    assert assessment.classification == "ordinary_change"
    assert len(assessment.mitigating_factors) >= 1


# ==============================================================================
# 3. Behavioral & Sensitive Challenge Scenario (B1)
# ==============================================================================
def test_scenario_B1_behavior_sensitive_or_payout_challenge(baseline_rider):
    """
    Scenario B1: Sensitive financial modification or moderate behavioral divergence.
    Expected:
    - Verdict: CHALLENGE (Risk in [45, 74])
    - Recommended action: CHALLENGE_OTP (or step-up challenge)
    - Factors present
    """
    event = {
        "session_id": "sess_b1_sensitive_action",
        "rider_id": "rider_mumbai_001",
        "city": "mumbai",
        "zone_id": "bandra_west",
        "start_hour": 14.5,
        "is_new_device": False,
        "tap_interval_ms": 235.0,   # Moderate deviation
        "typing_cps": 3.8,
        "swipe_velocity_px_s": 850.0,
        "interaction_timing_cv": 0.40,
        "nav_path_similarity": 0.72,
        "accept_latency_s": 9.2,
        "avg_speed_kmh": 24.5,
        "route_adherence": 0.82,
        "trip_cadence_per_hr": 2.1,
        "financial": {
            "payout_account_changed": True,  # High sensitive modification
        },
        "biometrics": {"face_match_confidence": 0.88, "liveness_score": 0.89},
    }

    ctx = ScoringContext(
        request_or_event=event,
        baseline=baseline_rider,
        device_passport={"is_trusted": True, "trust_rating": 0.85},
        trust_health=75.0,
    )

    assessment = score_session(ctx)

    assert 45.0 <= assessment.risk_score <= 74.0
    assert assessment.verdict == "CHALLENGE"
    assert assessment.recommended_action in ("CHALLENGE_OTP", "CHALLENGE_LIVENESS")
    assert len(assessment.factors) >= 1
    assert any("sensitive" in f.name.lower() or "financial" in f.name.lower() or "payout" in f.description.lower() for f in assessment.factors)


# ==============================================================================
# 4. Travel Violation Scenarios (T1, T2)
# ==============================================================================
def test_scenario_T1_impossible_travel(baseline_rider):
    """
    Scenario T1: Impossible travel detected (>800 km/h jump).
    Expected:
    - Rule Hit: IMPOSSIBLE_TRAVEL (Floor 60)
    - Verdict in ('CHALLENGE', 'ESCALATE')
    - Risk in [60, 100]
    - Threat tags include 'IMPOSSIBLE_TRAVEL'
    """
    event = {
        "session_id": "sess_t1_impossible_travel",
        "rider_id": "rider_mumbai_001",
        "city": "delhi",            # Jump to Delhi
        "zone_id": "connaught_place",
        "telemetry": {
            "impossible_travel_detected": True,
            "speed_between_pings_kmh": 4500.0,
        },
        "impossible_travel": 1,
        "threat_tags": ["IMPOSSIBLE_TRAVEL"],
    }

    ctx = ScoringContext(
        request_or_event=event,
        baseline=baseline_rider,
        travel_risk=1.0,
    )

    assessment = score_session(ctx)

    assert 60.0 <= assessment.risk_score <= 100.0
    assert assessment.verdict in ("CHALLENGE", "ESCALATE")
    assert "IMPOSSIBLE_TRAVEL" in assessment.threat_tags
    assert any("travel" in f.name.lower() or "transit" in f.description.lower() for f in assessment.factors)


def test_scenario_T2_gps_spoofing(baseline_rider):
    """
    Scenario T2: Mock location provider and perfectly linear constant-speed route.
    Expected:
    - Rule Hit: GPS_SPOOFING (Floor 60)
    - Verdict in ('CHALLENGE', 'ESCALATE')
    - Risk in [60, 100]
    - Threat tags include 'GPS_SPOOFING'
    """
    event = {
        "session_id": "sess_t2_gps_spoofing",
        "rider_id": "rider_mumbai_001",
        "city": "mumbai",
        "zone_id": "bandra_west",
        "mock_location_detected": 1,
        "telemetry": {
            "mock_location_detected": True,
            "straightness_ratio": 0.999,
            "speed_variance": 0.01,
        },
        "threat_tags": ["GPS_SPOOFING"],
    }

    ctx = ScoringContext(
        request_or_event=event,
        baseline=baseline_rider,
    )

    assessment = score_session(ctx)

    assert 60.0 <= assessment.risk_score <= 100.0
    assert assessment.verdict in ("CHALLENGE", "ESCALATE")
    assert "GPS_SPOOFING" in assessment.threat_tags
    assert any("gps" in f.name.lower() or "mock" in f.description.lower() for f in assessment.factors)


# ==============================================================================
# 5. Account Handoff Scenarios (H1 - H3)
# ==============================================================================
def test_scenario_H1_handoff_classic(baseline_rider):
    """
    Scenario H1: Classic account handoff / renting.
    Adversary operates account, causing massive motor-sensory deviation (d >= 0.55).
    Expected:
    - Floor 75 applied (suspected_handoff_floor)
    - Verdict: ESCALATE (Risk in [75, 100])
    - Classification: 'suspected_handoff'
    - Summary MUST explicitly mention behavior or motor dynamics
    - Factors present
    """
    event = {
        "session_id": "sess_h1_handoff_classic",
        "rider_id": "rider_mumbai_001",
        "city": "mumbai",
        "zone_id": "bandra_west",
        "start_hour": 22.0,         # Uncharacteristic night shift
        "is_new_device": True,
        # Gross behavioral divergence across metrics
        "tap_interval_ms": 320.0,   # baseline is 185ms (MAD 12) -> z ~ 10
        "typing_cps": 1.8,          # baseline is 4.8 cps (MAD 0.4) -> z ~ 6
        "swipe_velocity_px_s": 500.0,
        "interaction_timing_cv": 0.55,
        "nav_path_similarity": 0.35,
        "accept_latency_s": 15.0,
        "avg_speed_kmh": 42.0,
        "route_adherence": 0.55,
        "trip_cadence_per_hr": 4.5,
        "biometrics": {"face_match_confidence": 0.28, "liveness_score": 0.85},
    }

    ctx = ScoringContext(
        request_or_event=event,
        baseline=baseline_rider,
    )

    assessment = score_session(ctx)

    assert 75.0 <= assessment.risk_score <= 100.0
    assert assessment.verdict == "ESCALATE"
    assert assessment.risk_tier == "CRITICAL"
    assert assessment.classification == "suspected_handoff"
    assert "ACCOUNT_HANDOFF" in assessment.threat_tags
    # Assert summary explicitly mentions behavior / motor dynamics
    summary_lower = assessment.summary.lower()
    assert (
        "behavior" in summary_lower
        or "biometric" in summary_lower
        or "motor" in summary_lower
        or "deviation" in summary_lower
    ), f"Summary did not mention behavior: {assessment.summary}"


def test_scenario_H2_handoff_face_mismatch(baseline_rider):
    """
    Scenario H2: Face verification mismatch or liveness refusal.
    Expected:
    - Rule Hit: FACE_MISMATCH or LIVENESS_FAILED (Floor 75)
    - Verdict: ESCALATE (Risk in [75, 100])
    - Classification: 'suspected_handoff'
    """
    event = {
        "session_id": "sess_h2_face_mismatch",
        "rider_id": "rider_mumbai_001",
        "city": "mumbai",
        "zone_id": "bandra_west",
        "biometrics": {
            "face_match_confidence": 0.18,  # Below 0.40 threshold
            "liveness_score": 0.20,         # Below 0.30 threshold
        },
        "telemetry": {
            "challenge_declined": True,
        },
    }

    ctx = ScoringContext(
        request_or_event=event,
        baseline=baseline_rider,
    )

    assessment = score_session(ctx)

    assert 75.0 <= assessment.risk_score <= 100.0
    assert assessment.verdict == "ESCALATE"
    assert assessment.classification == "suspected_handoff"
    assert "ACCOUNT_HANDOFF" in assessment.threat_tags
    assert any("face" in f.name.lower() or "liveness" in f.name.lower() for f in assessment.factors)


def test_scenario_H3_handoff_concurrent_session(baseline_rider):
    """
    Scenario H3: Concurrent dispatch sessions detected across distant geographic sectors.
    Expected:
    - Rule Hit: CONCURRENT_SESSION (Floor 60)
    - Risk in [60, 100]
    - Threat tags include 'ACCOUNT_HANDOFF'
    """
    event = {
        "session_id": "sess_h3_concurrent_session",
        "rider_id": "rider_mumbai_001",
        "city": "mumbai",
        "zone_id": "bandra_west",
        "concurrent_session": 1,
        "telemetry": {
            "concurrent_session_detected": True,
            "concurrent_distance_km": 85.0,
        },
        "threat_tags": ["ACCOUNT_HANDOFF", "CONCURRENT_SESSION"],
    }

    ctx = ScoringContext(
        request_or_event=event,
        baseline=baseline_rider,
    )

    assessment = score_session(ctx)

    assert 60.0 <= assessment.risk_score <= 100.0
    assert assessment.verdict in ("CHALLENGE", "ESCALATE")
    assert "ACCOUNT_HANDOFF" in assessment.threat_tags
    assert any("concurrent" in f.name.lower() for f in assessment.factors)
