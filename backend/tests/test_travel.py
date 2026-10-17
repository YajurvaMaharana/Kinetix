"""
Unit & Integration Tests for TrustJuggler Kinematic Travel Feasibility & Trajectory Engine.
Validates:
1. Haversine distance calculations against known Indian and global city pairs.
2. 150 km/h boundary speed thresholds and interval noise floor filtering.
3. Synthetic collinear constant-speed route spoof detection (>= 8 pings, straightness > 0.98, speed CV < 0.05).
4. Real simulated routes with stops, turns, and velocity variance not falsely flagged.
5. Mock location provider flag firing GPS_SPOOFING and triggering rule floor 60.
6. Impossible travel cross-city teleportation returning CHALLENGE/ESCALATE with distance, time, and implied speed.
7. Within-session teleportation GPS jump detection.
8. Zone feasibility against elapsed transit time.
9. False-positive validation over 200 normal sessions (< 1% flagged).
"""

from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

from app.scoring.risk import ScoringContext, score_session
from app.scoring.travel import (
    evaluate_travel,
    gps_jump,
    haversine,
    implied_speed,
    initial_bearing,
    route_plausibility,
    zone_feasibility,
)
from simulator.generator import generate_route_points, generate_single_session
from simulator.personas import generate_persona


# ==============================================================================
# 1. Haversine & Known City Pairs
# ==============================================================================
def test_haversine_known_city_pairs():
    """
    Validates great-circle distance computation against known geographical city pairs.
    Mumbai to Pune: ~119 km
    Delhi to Bengaluru: ~1740 km
    Mumbai to Delhi: ~1150 km
    """
    # Identical coordinates -> 0.0
    assert haversine(19.0760, 72.8777, 19.0760, 72.8777) == 0.0

    # Mumbai (19.0760, 72.8777) <-> Pune (18.5204, 73.8567)
    dist_mumbai_pune = haversine(19.0760, 72.8777, 18.5204, 73.8567)
    assert 115.0 <= dist_mumbai_pune <= 125.0, f"Expected ~119 km, got {dist_mumbai_pune}"

    # Delhi (28.6139, 77.2090) <-> Bengaluru (12.9716, 77.5946)
    dist_delhi_blr = haversine(28.6139, 77.2090, 12.9716, 77.5946)
    assert 1700.0 <= dist_delhi_blr <= 1780.0, f"Expected ~1740 km, got {dist_delhi_blr}"

    # Mumbai (19.0760, 72.8777) <-> Delhi (28.6139, 77.2090)
    dist_mumbai_delhi = haversine(19.0760, 72.8777, 28.6139, 77.2090)
    assert 1130.0 <= dist_mumbai_delhi <= 1180.0, f"Expected ~1150 km, got {dist_mumbai_delhi}"


def test_initial_bearing():
    """Verifies compass bearing calculations for cardinal directions."""
    # North (lat increases) -> ~0 degrees
    b_north = initial_bearing(19.0, 72.0, 20.0, 72.0)
    assert pytest.approx(b_north, abs=1.0) == 0.0

    # East (lon increases) -> ~90 degrees
    b_east = initial_bearing(19.0, 72.0, 19.0, 73.0)
    assert pytest.approx(b_east, abs=2.0) == 90.0

    # South -> ~180 degrees
    b_south = initial_bearing(20.0, 72.0, 19.0, 72.0)
    assert pytest.approx(b_south, abs=1.0) == 180.0


# ==============================================================================
# 2. Implied Speed & 150 km/h Boundary Test
# ==============================================================================
def test_implied_speed_and_150_kmh_boundary():
    """
    Validates speed inference, noise floor filtering, and 150 km/h feasibility boundary.
    """
    now = datetime(2026, 11, 20, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Normal vehicle speed: 10 km in 6 minutes (0.1h) = 100 km/h
    p1 = {"latitude": 19.0000, "longitude": 72.8000, "timestamp": now.isoformat()}
    # 10 km north is approx 0.09009 degrees lat
    p2 = {
        "latitude": 19.09009,
        "longitude": 72.8000,
        "timestamp": (now + timedelta(minutes=6)).isoformat(),
    }
    res_100 = implied_speed(p1, p2, max_feasible_speed_kmh=150.0)
    assert not res_100.is_infeasible
    assert pytest.approx(res_100.speed_kmh, abs=2.0) == 100.0

    # 2. Exactly at 150 km/h boundary: 9.996 km in 4 minutes (0.0667h) = 149.95 km/h <= 150 km/h
    p3 = {
        "latitude": 19.0899,
        "longitude": 72.8000,
        "timestamp": (now + timedelta(minutes=4)).isoformat(),
    }
    res_150 = implied_speed(p1, p3, max_feasible_speed_kmh=150.0)
    assert not res_150.is_infeasible
    assert pytest.approx(res_150.speed_kmh, abs=2.0) == 150.0

    # 3. Beyond 150 km/h threshold: 10 km in 3 minutes (0.05h) = 200 km/h -> Infeasible
    p4 = {
        "latitude": 19.09009,
        "longitude": 72.8000,
        "timestamp": (now + timedelta(minutes=3)).isoformat(),
    }
    res_200 = implied_speed(p1, p4, max_feasible_speed_kmh=150.0)
    assert res_200.is_infeasible
    assert res_200.speed_kmh > 150.0
    assert "implied speed" in res_200.explanation

    # 4. Noise floor filtering (< 5.0 seconds interval)
    p_jitter = {
        "latitude": 19.0001,
        "longitude": 72.8001,
        "timestamp": (now + timedelta(seconds=2)).isoformat(),
    }
    res_jitter = implied_speed(p1, p_jitter, min_interval_s=5.0)
    assert not res_jitter.is_infeasible
    assert res_jitter.speed_kmh == 0.0
    assert "under noise floor" in res_jitter.explanation


# ==============================================================================
# 3. Synthetic Collinear Spoof Route Detection
# ==============================================================================
def test_synthetic_spoof_route_detected():
    """
    Verifies that a synthetic collinear constant-speed trajectory is flagged as GPS_SPOOFING.
    Criteria: pings >= 8, straightness > 0.98, speed_cv < 0.05, jitter < 1.5 deg.
    """
    now = datetime(2026, 11, 20, 14, 0, 0, tzinfo=timezone.utc)
    start_lat, start_lng = 19.0596, 72.8295
    fixed_speed = 36.0

    spoofed_pings = []
    # 10 perfectly collinear points along 45 degree line at identical speed
    for step in range(10):
        spoofed_pings.append(
            {
                "step": step,
                "latitude": round(start_lat + (step * 0.003), 6),
                "longitude": round(start_lng + (step * 0.003), 6),
                "speed_kmh": fixed_speed,
                "timestamp": (now + timedelta(minutes=step * 2)).isoformat(),
            }
        )

    res = route_plausibility(
        spoofed_pings,
        min_pings=8,
        spoof_straightness=0.98,
        spoof_speed_cv=0.05,
        spoof_jitter_floor=1.5,
    )

    assert res.pings_count == 10
    assert res.straightness_ratio >= 0.99
    assert res.speed_cv == 0.0
    assert res.ping_jitter < 1.0
    assert res.is_spoofed, "Synthetic linear route should be identified as spoofed"
    assert "Synthetic linear trajectory detected" in res.explanation

    # Integration via evaluate_travel
    ctx = ScoringContext(request_or_event={"location_pings": spoofed_pings})
    eval_trav = evaluate_travel(ctx)
    assert eval_trav.has_gps_spoofing
    assert eval_trav.travel_risk >= 0.85
    assert "GPS_SPOOFING" in eval_trav.threat_tags


# ==============================================================================
# 4. Real Simulated Urban Routes Not Flagged
# ==============================================================================
def test_real_simulated_routes_not_flagged():
    """
    Verifies that genuine urban routes (with road curvature, stops at signals,
    acceleration and deceleration) are NOT classified as spoofed.
    """
    rng = np.random.RandomState(42)
    # Generate route using the platform generator
    real_pings = generate_route_points(
        start_lat=19.0596,
        start_lng=72.8295,
        speed_kmh=28.0,
        duration_min=24,
        rng=rng,
        jitter_sd=0.0003,
    )

    assert len(real_pings) >= 8

    res = route_plausibility(
        real_pings,
        min_pings=8,
        spoof_straightness=0.98,
        spoof_speed_cv=0.05,
        spoof_jitter_floor=1.5,
    )

    assert not res.is_spoofed, "Real urban route should not be flagged as spoofed"
    assert res.speed_cv > 0.08, "Real traffic has significant speed variance"
    assert res.ping_jitter > 2.0, "Real road paths turn and curve"
    assert "Plausible route trajectory" in res.explanation

    # Integration check
    ctx = ScoringContext(request_or_event={"location_pings": real_pings})
    eval_trav = evaluate_travel(ctx)
    assert not eval_trav.has_gps_spoofing
    assert not eval_trav.has_impossible_travel
    assert eval_trav.travel_risk == 0.0


# ==============================================================================
# 5. Mock Location Flag Handling
# ==============================================================================
def test_mock_location_flag_fires_gps_spoofing():
    """
    Verifies that active mock location provider flag triggers GPS_SPOOFING rule hit
    and floors risk at 60.
    """
    # 1. Via evaluate_travel directly
    ctx = ScoringContext(request_or_event={"mock_location_detected": True})
    eval_trav = evaluate_travel(ctx)
    assert eval_trav.has_gps_spoofing
    assert "GPS_SPOOFING" in eval_trav.threat_tags
    assert any(f.code == "GPS_SPOOFING" for f in eval_trav.factors)

    # 2. Via end-to-end score_session
    baseline = {"avg_speed_kmh": 32.0, "avg_cadence_cpm": 210.0}
    session_ctx = ScoringContext(
        request_or_event={
            "session_id": "sess_mock_gps",
            "rider_id": "rider_test_01",
            "mock_location_detected": 1,
            "telemetry": {"mock_location_detected": True},
        },
        baseline=baseline,
    )
    assessment = score_session(session_ctx)
    assert assessment.risk_score >= 60.0
    assert assessment.verdict in ("CHALLENGE", "ESCALATE")
    assert "GPS_SPOOFING" in assessment.threat_tags
    assert any(
        "gps" in f.name.lower() or "mock" in f.description.lower() for f in assessment.factors
    )


# ==============================================================================
# 6. Impossible Travel Cross-City Teleportation
# ==============================================================================
def test_impossible_travel_scenario():
    """
    Verifies cross-city teleportation (e.g., 1,150 km in 6 minutes) triggers
    IMPOSSIBLE_TRAVEL, asserts CHALLENGE/ESCALATE verdict, and validates explanation
    formatting showing distance, time, and implied speed.
    """
    now = datetime(2026, 11, 20, 10, 0, 0, tzinfo=timezone.utc)

    # Mumbai to Delhi: 1,150 km in 6 minutes (~11,500 km/h)
    prev_loc = {
        "city": "mumbai",
        "latitude": 19.0760,
        "longitude": 72.8777,
        "timestamp": now.isoformat(),
    }
    curr_ping = {
        "city": "delhi",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "timestamp": (now + timedelta(minutes=6)).isoformat(),
    }

    ctx = ScoringContext(
        request_or_event=curr_ping,
        previous_location=prev_loc,
        baseline={"home_city": "mumbai"},
    )

    eval_trav = evaluate_travel(ctx)
    assert eval_trav.has_impossible_travel
    assert eval_trav.travel_risk == 1.0
    assert "IMPOSSIBLE_TRAVEL" in eval_trav.threat_tags

    # Verify factor details show distance, time, and speed
    imp_factors = [f for f in eval_trav.factors if f.code == "IMPOSSIBLE_TRAVEL"]
    assert len(imp_factors) >= 1
    factor = imp_factors[0]
    assert "1,148" in factor.observed or "1,150" in factor.observed or "1,15" in factor.observed
    assert "min" in factor.observed
    assert "max plausible 150 km/h" in factor.baseline

    # End-to-end scoring
    assessment = score_session(ctx)
    assert assessment.risk_score >= 60.0
    assert assessment.verdict in ("CHALLENGE", "ESCALATE")
    assert "IMPOSSIBLE_TRAVEL" in assessment.threat_tags
    assert any(
        "travel" in f.name.lower() or "transit" in f.description.lower() for f in assessment.factors
    )


# ==============================================================================
# 7. Within-Session GPS Jump Detection
# ==============================================================================
def test_within_session_gps_jump():
    """
    Verifies detection of sudden coordinate teleportation jumps (> 1 km in seconds).
    """
    now = datetime(2026, 11, 20, 16, 0, 0, tzinfo=timezone.utc)
    p1 = {"latitude": 19.0596, "longitude": 72.8295, "timestamp": now.isoformat()}
    # 3.5 km jump in 8 seconds
    p2 = {
        "latitude": 19.0900,
        "longitude": 72.8350,
        "timestamp": (now + timedelta(seconds=8)).isoformat(),
    }

    jump_res = gps_jump(p1, p2, jump_dist_threshold_km=1.0)
    assert jump_res.jump_detected
    assert jump_res.distance_km >= 3.0
    assert "Teleportation jump" in jump_res.explanation

    # Small 50 meter shift in 10 seconds -> Not a jump
    p_close = {
        "latitude": 19.0598,
        "longitude": 72.8296,
        "timestamp": (now + timedelta(seconds=10)).isoformat(),
    }
    normal_res = gps_jump(p1, p_close, jump_dist_threshold_km=1.0)
    assert not normal_res.jump_detected


# ==============================================================================
# 8. Zone Feasibility Against Transit Time
# ==============================================================================
def test_zone_feasibility_check():
    """
    Verifies that dispatching to a distant zone within impossible transit time
    is flagged as unfeasible.
    """
    mumbai_loc = {"city": "mumbai", "latitude": 19.0760, "longitude": 72.8777}

    # 1. Target zone in Delhi 20 minutes (0.333h) later: ~1150 km > 150 * 0.333 = 50 km -> Unfeasible
    res_delhi = zone_feasibility("connaught_place", prev_location=mumbai_loc, elapsed_hours=0.333)
    assert not res_delhi.is_feasible
    assert "unreachable" in res_delhi.explanation

    # 2. Target zone in Mumbai ("andheri_east") 30 minutes (0.5h) later: ~8 km <= 75 km -> Feasible
    res_andheri = zone_feasibility("andheri_east", prev_location=mumbai_loc, elapsed_hours=0.5)
    assert res_delhi.is_feasible is False
    assert res_andheri.is_feasible is True
    assert "reachable" in res_andheri.explanation


# ==============================================================================
# 9. False Positive Rate on 200 Normal Sessions (< 1%)
# ==============================================================================
def test_false_positive_rate_on_200_normal_sessions():
    """
    Generates 200 genuine normal courier trips using the persona generator.
    Asserts false positive rate < 1.0% (<= 1 session flagged as travel violation).
    """
    rng = np.random.RandomState(100)
    personas = [generate_persona(rider_idx=i, rng=rng) for i in range(10)]
    base_time = datetime(2026, 11, 15, 8, 0, 0, tzinfo=timezone.utc)

    flagged_count = 0
    total_sessions = 200

    for i in range(total_sessions):
        persona = personas[i % len(personas)]
        sess_time = base_time + timedelta(hours=i * 2)

        sess = generate_single_session(
            persona=persona,
            session_id=f"sess_eval_norm_fp_{i:03d}",
            timestamp=sess_time,
            rng=rng,
            label="normal",
            ground_truth_label="normal",
        )

        ctx = ScoringContext(request_or_event=sess)
        trav_eval = evaluate_travel(ctx)

        if trav_eval.has_impossible_travel or trav_eval.has_gps_spoofing:
            flagged_count += 1

    fp_rate = (flagged_count / total_sessions) * 100.0
    print(f"\n[TRAVEL FP BENCHMARK] Flagged: {flagged_count}/{total_sessions} ({fp_rate:.2f}%)")

    assert fp_rate < 1.0, f"False positive rate {fp_rate:.2f}% exceeded 1.0% threshold"
