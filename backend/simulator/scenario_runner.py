"""
TrustJuggler End-to-End Attack Scenario Runner and Demo Scenario Seeders.
Executes scripted multi-event sessions representing real attack profiles and benign life changes:
- N1: Normal rider baseline session (stays in ALLOW band, risk < 25)
- O1-O4: Benign changes (New phone, Relocation, New zone, Combined). Produces MONITOR (25-44), adapts to ALLOW
- H1: Account Handoff / Rental mid-shift (behavior dev > 0.35, triggers CHALLENGE/ESCALATE, ACCOUNT_HANDOFF)
- T1: Impossible travel (velocity > 150 km/h, triggers IMPOSSIBLE_TRAVEL, floor 60)
- T2: GPS Spoofing (synthetic linear route, triggers GPS_SPOOFING, floor 60)
- F1: Fraud Collusion Ring (cluster >= 3 riders sharing device/bank, triggers MULTI_ACCOUNT_DEVICE_RING, FRAUD_RING)
- P1: Payout instrument hijack (sensitive profile edit + unfamiliar device/IP, triggers CHALLENGE, PAYOUT_REDIRECT)
"""

import copy
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.schemas.contracts import (
    ScenarioInfoResponse,
    ScenarioRunResponse,
    ScenarioStepResponse,
)
from app.scoring.risk import ScoringContext, score_session
from app.scoring.thresholds import DEFAULT_THRESHOLDS, ThresholdConfig
from app.services.baseline_service import baseline_service
from app.services.events_bus import event_bus
from app.services.privacy import tokenize

logger = logging.getLogger("trustjuggler.scenario_runner")


def get_canonical_baseline(rider_id: str = "rider_scenario_runner_01") -> Dict[str, Any]:
    """Establishes an authentic established rider baseline profile in Mumbai."""
    return {
        "rider_id": rider_id,
        "home_city": "mumbai",
        "home_lat": 19.0760,
        "home_lng": 72.8777,
        "home_zone": "bandra_west",
        "known_zones": ["bandra_west", "andheri_east", "juhu"],
        "known_device_ids": [f"dev_primary_{rider_id}"],
        "sessions_count": 45,
        "asns": ["AS133612", "AS55836"],
        "hour_profile": {"mean": 14.5, "std": 1.8},
        "zone_profile": {
            "bandra_west": 0.65,
            "andheri_east": 0.25,
            "juhu": 0.10,
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
# Scenario Builders
# ==============================================================================


def build_scenario_N1(rider_id: str = "rider_n1") -> Dict[str, Any]:
    """
    Scenario N1: Normal rider routine baseline session.
    Stays strictly in ALLOW band (risk < 25), classification normal.
    """
    baseline = get_canonical_baseline(rider_id)
    steps = [
        {
            "step_number": 1,
            "name": "Shift Login & Check-In",
            "event": {
                "session_id": f"sess_{rider_id}_login",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "bandra_west",
                "device_id": f"dev_primary_{rider_id}",
                "is_new_device": False,
                "tap_interval_ms": 186.0,
                "typing_cps": 4.75,
                "swipe_velocity_px_s": 1140.0,
                "interaction_timing_cv": 0.27,
                "nav_path_similarity": 0.89,
                "accept_latency_s": 5.1,
                "avg_speed_kmh": 24.0,
                "route_adherence": 0.90,
                "trip_cadence_per_hr": 2.5,
                "start_hour": 14.5,
            },
            "expected_verdicts": ["ALLOW"],
            "max_risk": 24.9,
            "expected_threat_tags": ["CLEAN"],
        },
        {
            "step_number": 2,
            "name": "Order Acceptance & Dispatch",
            "event": {
                "session_id": f"sess_{rider_id}_dispatch",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "bandra_west",
                "device_id": f"dev_primary_{rider_id}",
                "is_new_device": False,
                "tap_interval_ms": 188.0,
                "typing_cps": 4.82,
                "swipe_velocity_px_s": 1160.0,
                "accept_latency_s": 5.3,
                "avg_speed_kmh": 25.1,
                "route_adherence": 0.88,
                "start_hour": 15.0,
            },
            "expected_verdicts": ["ALLOW"],
            "max_risk": 24.9,
            "expected_threat_tags": ["CLEAN"],
        },
    ]
    return {
        "scenario_id": "N1",
        "name": "Normal Routine Baseline Session",
        "category": "normal",
        "description": "Established rider operating in home city/zone with primary handset. Zero friction.",
        "baseline": baseline,
        "steps": steps,
    }


def build_scenario_O1(rider_id: str = "rider_o1") -> Dict[str, Any]:
    """
    Scenario O1: Benign change - New phone.
    Produces MONITOR (25-44) on first sessions without hard blockages,
    adapting over 3 sessions to ALLOW.
    """
    baseline = get_canonical_baseline(rider_id)
    new_device_id = f"dev_{rider_id}_pixel8_pro"
    tokenized_fp = tokenize(new_device_id)

    # 3 progressive sessions across days
    steps = [
        {
            "step_number": 1,
            "name": "Session 1: Initial Login on New Handset",
            "event": {
                "session_id": f"sess_{rider_id}_phone_s1",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "bandra_west",
                "is_new_device": True,
                "device_id": new_device_id,
                "device_fingerprint": tokenized_fp,
                "label": "ordinary_change",
                # Mild 10% dilation from new glass screen
                "tap_interval_ms": 208.0,
                "typing_cps": 4.35,
                "swipe_velocity_px_s": 1250.0,
                "nav_path_similarity": 0.88,
                "accept_latency_s": 5.4,
                "avg_speed_kmh": 24.8,
            },
            "adapt_behavior_dev": 0.15,
            "expected_verdicts": ["ALLOW", "MONITOR"],
            "min_risk": 0.0,
            "max_risk": 44.0,
            "expected_threat_tags": ["ORDINARY_CHANGE"],
        },
        {
            "step_number": 2,
            "name": "Session 2: Second Shift on New Handset",
            "event": {
                "session_id": f"sess_{rider_id}_phone_s2",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "bandra_west",
                "is_new_device": True,
                "device_id": new_device_id,
                "device_fingerprint": tokenized_fp,
                "label": "ordinary_change",
                "tap_interval_ms": 205.0,
                "typing_cps": 4.40,
                "swipe_velocity_px_s": 1230.0,
            },
            "adapt_behavior_dev": 0.14,
            "expected_verdicts": ["ALLOW", "MONITOR"],
            "max_risk": 44.0,
            "expected_threat_tags": ["ORDINARY_CHANGE", "CLEAN"],
        },
        {
            "step_number": 3,
            "name": "Session 3: Handset Adapted to Baseline",
            "event": {
                "session_id": f"sess_{rider_id}_phone_s3",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "bandra_west",
                "is_new_device": False,
                "device_id": new_device_id,
                "device_fingerprint": tokenized_fp,
                "tap_interval_ms": 200.0,
                "typing_cps": 4.50,
                "swipe_velocity_px_s": 1200.0,
            },
            "adapt_behavior_dev": 0.12,
            "expected_verdicts": ["ALLOW"],
            "max_risk": 24.9,
            "expected_threat_tags": ["CLEAN"],
        },
    ]
    return {
        "scenario_id": "O1",
        "name": "Benign Change: New Phone Transition",
        "category": "benign_change",
        "description": "Hardware upgrade to a new phone with authentic biometrics. Soft-monitored, then adapts to ALLOW.",
        "baseline": baseline,
        "steps": steps,
    }


def build_scenario_O2(rider_id: str = "rider_o2") -> Dict[str, Any]:
    """
    Scenario O2: Benign change - Relocation to new city.
    Produces MONITOR (25-44) on first sessions without hard blockages,
    adapting over 5 sessions across 2 days to ALLOW.
    """
    baseline = get_canonical_baseline(rider_id)
    steps = [
        {
            "step_number": 1,
            "name": "Session 1: First Shift in New City (Pune)",
            "event": {
                "session_id": f"sess_{rider_id}_relo_s1",
                "rider_id": rider_id,
                "city": "pune",
                "zone_id": "kothrud",
                "is_new_device": False,
                "label": "ordinary_change",
                "tap_interval_ms": 185.0,
                "typing_cps": 4.8,
                "swipe_velocity_px_s": 1150.0,
                "avg_speed_kmh": 24.0,
            },
            "adapt_behavior_dev": 0.12,
            "expected_verdicts": ["ALLOW", "MONITOR"],
            "min_risk": 0.0,
            "max_risk": 44.0,
            "expected_threat_tags": ["ORDINARY_CHANGE"],
        },
        {
            "step_number": 2,
            "name": "Session 5: City Relocation Fully Adapted",
            "event": {
                "session_id": f"sess_{rider_id}_relo_s5",
                "rider_id": rider_id,
                "city": "pune",
                "zone_id": "kothrud",
                "is_new_device": False,
                "tap_interval_ms": 186.0,
                "typing_cps": 4.82,
                "swipe_velocity_px_s": 1155.0,
                "avg_speed_kmh": 24.2,
            },
            # Simulate 5 sessions across 2 calendar days
            "multi_session_adapt": {
                "city": "pune",
                "zone": "kothrud",
                "sessions_day1": 3,
                "sessions_day2": 2,
            },
            "expected_verdicts": ["ALLOW"],
            "max_risk": 24.9,
            "expected_threat_tags": ["CLEAN"],
        },
    ]
    return {
        "scenario_id": "O2",
        "name": "Benign Change: Inter-City Relocation",
        "category": "benign_change",
        "description": "Rider moves to a new city. Held in MONITOR tier, adapting to ALLOW without hard blocks.",
        "baseline": baseline,
        "steps": steps,
    }


def build_scenario_O3(rider_id: str = "rider_o3") -> Dict[str, Any]:
    """
    Scenario O3: Benign change - New delivery zone.
    Produces MONITOR initially, adapts after consecutive deliveries.
    """
    baseline = get_canonical_baseline(rider_id)
    steps = [
        {
            "step_number": 1,
            "name": "Session 1: Expanding Delivery into New Zone (Powai)",
            "event": {
                "session_id": f"sess_{rider_id}_zone_s1",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "powai",
                "is_new_device": False,
                "label": "ordinary_change",
                "tap_interval_ms": 185.0,
                "typing_cps": 4.8,
                "swipe_velocity_px_s": 1150.0,
            },
            "adapt_behavior_dev": 0.10,
            "expected_verdicts": ["ALLOW", "MONITOR"],
            "min_risk": 0.0,
            "max_risk": 44.0,
            "expected_threat_tags": ["ORDINARY_CHANGE"],
        },
        {
            "step_number": 2,
            "name": "Session 3: Zone Incorporated into Known Baseline",
            "event": {
                "session_id": f"sess_{rider_id}_zone_s3",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "powai",
                "is_new_device": False,
                "tap_interval_ms": 184.0,
                "typing_cps": 4.81,
                "swipe_velocity_px_s": 1145.0,
            },
            "zone_adapt_complete": "powai",
            "expected_verdicts": ["ALLOW"],
            "max_risk": 24.9,
            "expected_threat_tags": ["CLEAN"],
        },
    ]
    return {
        "scenario_id": "O3",
        "name": "Benign Change: New Delivery Zone",
        "category": "benign_change",
        "description": "Rider delivers in a previously unvisited zone in home city. Seamlessly adapts to ALLOW.",
        "baseline": baseline,
        "steps": steps,
    }


def build_scenario_O4(rider_id: str = "rider_o4") -> Dict[str, Any]:
    """
    Scenario O4: Benign change - Combined new phone and new zone.
    Produces MONITOR capped at 44.0, adapting over time.
    """
    baseline = get_canonical_baseline(rider_id)
    combo_device_id = f"dev_{rider_id}_combo"
    tokenized_fp = tokenize(combo_device_id)

    steps = [
        {
            "step_number": 1,
            "name": "Session 1: New Phone Operating in New Zone",
            "event": {
                "session_id": f"sess_{rider_id}_combo_s1",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "powai",
                "is_new_device": True,
                "device_id": combo_device_id,
                "device_fingerprint": tokenized_fp,
                "label": "ordinary_change",
                "tap_interval_ms": 210.0,
                "typing_cps": 4.30,
                "swipe_velocity_px_s": 1260.0,
            },
            "expected_verdicts": ["ALLOW", "MONITOR"],
            "min_risk": 0.0,
            "max_risk": 44.0,
            "expected_threat_tags": ["ORDINARY_CHANGE"],
        },
        {
            "step_number": 2,
            "name": "Session 3: Multi-Parameter Adaptation Complete",
            "event": {
                "session_id": f"sess_{rider_id}_combo_s3",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "powai",
                "is_new_device": False,
                "device_id": combo_device_id,
                "device_fingerprint": tokenized_fp,
                "tap_interval_ms": 195.0,
                "typing_cps": 4.60,
                "swipe_velocity_px_s": 1180.0,
            },
            "combo_adapt_complete": {"device_id": combo_device_id, "zone": "powai"},
            "expected_verdicts": ["ALLOW"],
            "max_risk": 24.9,
            "expected_threat_tags": ["CLEAN"],
        },
    ]
    return {
        "scenario_id": "O4",
        "name": "Benign Change: Combined New Phone & Zone",
        "category": "benign_change",
        "description": "Simultaneous new device and territory expansion. Strictly capped at MONITOR (44), adapts to ALLOW.",
        "baseline": baseline,
        "steps": steps,
    }


def build_scenario_H1(rider_id: str = "rider_h1") -> Dict[str, Any]:
    """
    Scenario H1: Account Handoff / Rental mid-shift.
    Divergent driver operates account: behavioral deviation spike > 0.35,
    triggers CHALLENGE or ESCALATE with threat_tag ACCOUNT_HANDOFF.
    """
    baseline = get_canonical_baseline(rider_id)
    steps = [
        {
            "step_number": 1,
            "name": "Authentic Rider Shift Start",
            "event": {
                "session_id": f"sess_{rider_id}_step1",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "bandra_west",
                "tap_interval_ms": 185.0,
                "typing_cps": 4.8,
                "swipe_velocity_px_s": 1150.0,
            },
            "expected_verdicts": ["ALLOW"],
            "max_risk": 24.9,
            "expected_threat_tags": ["CLEAN"],
        },
        {
            "step_number": 2,
            "name": "Mid-Shift Account Switch to Unauthenticated Driver",
            "event": {
                "session_id": f"sess_{rider_id}_step2_handoff",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "bandra_west",
                "is_new_device": True,
                # Massive motor-sensory deviation across touch dynamics
                "tap_interval_ms": 340.0,
                "typing_cps": 1.7,
                "swipe_velocity_px_s": 480.0,
                "interaction_timing_cv": 0.58,
                "nav_path_similarity": 0.32,
                "accept_latency_s": 15.5,
                "avg_speed_kmh": 44.0,
                "route_adherence": 0.52,
                "trip_cadence_per_hr": 4.8,
                "ground_truth_label": "handoff_classic",
                "biometrics": {"face_match_confidence": 0.22, "liveness_score": 0.85},
            },
            "expected_verdicts": ["CHALLENGE", "ESCALATE"],
            "min_risk": 75.0,
            "expected_threat_tags": ["ACCOUNT_HANDOFF"],
        },
    ]
    return {
        "scenario_id": "H1",
        "name": "Account Handoff / Rental Mid-Shift",
        "category": "attack",
        "description": "Account handed over mid-shift to an unauthenticated driver with divergent motor patterns. Floored at 75.",
        "baseline": baseline,
        "steps": steps,
    }


def build_scenario_T1(rider_id: str = "rider_t1") -> Dict[str, Any]:
    """
    Scenario T1: Impossible travel (velocity > 150 km/h).
    Triggers hard rule IMPOSSIBLE_TRAVEL (floor 60).
    """
    baseline = get_canonical_baseline(rider_id)
    now = datetime.now(timezone.utc)
    steps = [
        {
            "step_number": 1,
            "name": "Active Delivery Ping in Mumbai",
            "event": {
                "session_id": f"sess_{rider_id}_ping1",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "bandra_west",
                "latitude": 19.0596,
                "longitude": 72.8295,
                "created_at": now.isoformat(),
            },
            "expected_verdicts": ["ALLOW"],
            "max_risk": 24.9,
            "expected_threat_tags": ["CLEAN"],
        },
        {
            "step_number": 2,
            "name": "Impossible Location Jump to Delhi (4,500 km/h)",
            "event": {
                "session_id": f"sess_{rider_id}_ping2_jump",
                "rider_id": rider_id,
                "city": "delhi",
                "zone_id": "connaught_place",
                "latitude": 28.6304,
                "longitude": 77.2177,
                "impossible_travel": 1,
                "travel_risk": 1.0,
                "telemetry": {
                    "impossible_travel_detected": True,
                    "jump_distance_km": 1150.0,
                    "speed_between_pings_kmh": 4500.0,
                    "jump_elapsed_minutes": 10,
                },
                "threat_tags": ["IMPOSSIBLE_TRAVEL"],
            },
            "expected_verdicts": ["CHALLENGE", "ESCALATE"],
            "min_risk": 60.0,
            "expected_threat_tags": ["IMPOSSIBLE_TRAVEL"],
        },
    ]
    return {
        "scenario_id": "T1",
        "name": "Impossible Travel Violation",
        "category": "attack",
        "description": "Geospatial teleportation between Mumbai and Delhi in 10 minutes (> 4,000 km/h). Hard floor 60.",
        "baseline": baseline,
        "steps": steps,
    }


def build_scenario_T2(rider_id: str = "rider_t2") -> Dict[str, Any]:
    """
    Scenario T2: GPS Spoofing.
    Synthetic jitter-free straight line route, triggers GPS_SPOOFING (floor 60).
    """
    baseline = get_canonical_baseline(rider_id)
    steps = [
        {
            "step_number": 1,
            "name": "Synthetic Collinear Trajectory with Zero Speed Variance",
            "event": {
                "session_id": f"sess_{rider_id}_spoof_route",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "bandra_west",
                "mock_location_detected": 1,
                "telemetry": {
                    "mock_location_detected": True,
                    "straightness_ratio": 0.999,
                    "speed_variance": 0.01,
                    "ping_jitter_deg": 0.2,
                    "pings_count": 10,
                },
                "threat_tags": ["GPS_SPOOFING"],
            },
            "expected_verdicts": ["CHALLENGE", "ESCALATE"],
            "min_risk": 60.0,
            "expected_threat_tags": ["GPS_SPOOFING"],
        },
    ]
    return {
        "scenario_id": "T2",
        "name": "GPS Spoofing & Route Synthesis",
        "category": "attack",
        "description": "Synthetic mock location route with zero acceleration and perfect straightness. Hard floor 60.",
        "baseline": baseline,
        "steps": steps,
    }


def build_scenario_F1(rider_id: str = "rider_f1") -> Dict[str, Any]:
    """
    Scenario F1: Fraud Collusion Ring.
    Bipartite cluster >= 3 riders sharing device/bank, triggers MULTI_ACCOUNT_DEVICE_RING.
    """
    baseline = get_canonical_baseline(rider_id)
    shared_device_id = "dev_shared_emu_farm_99"
    shared_fp = tokenize(shared_device_id)

    steps = [
        {
            "step_number": 1,
            "name": "Multi-Account Device Farm Cluster Execution",
            "event": {
                "session_id": f"sess_{rider_id}_ring_cluster",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "bandra_west",
                "is_emulator": 1,
                "is_rooted": 1,
                "device_id": shared_device_id,
                "device_fingerprint": shared_fp,
                "shared_device_count": 4,
                "shared_payout_count": 3,
                "graph_risk": 0.85,
                "telemetry": {
                    "ring_id": "ring_mumbai_emu_01",
                    "shared_device_count": 4,
                    "shared_payout_count": 3,
                },
                "threat_tags": ["FRAUD_RING", "DEVICE_FARM"],
            },
            "expected_verdicts": ["CHALLENGE", "ESCALATE"],
            "min_risk": 60.0,
            "expected_threat_tags": ["FRAUD_RING"],
        },
    ]
    return {
        "scenario_id": "F1",
        "name": "Fraud Collusion Ring (Device Farm)",
        "category": "attack",
        "description": "Collusion cluster with 4 riders sharing emulator hardware and payout destination. Hard floor 60.",
        "baseline": baseline,
        "steps": steps,
    }


def build_scenario_P1(rider_id: str = "rider_p1") -> Dict[str, Any]:
    """
    Scenario P1: Payout instrument hijack.
    Sensitive profile edit + unfamiliar device/IP triggers CHALLENGE OTP/Selfie.
    """
    baseline = get_canonical_baseline(rider_id)
    steps = [
        {
            "step_number": 1,
            "name": "Active Delivery Session",
            "event": {
                "session_id": f"sess_{rider_id}_active",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "bandra_west",
                "tap_interval_ms": 185.0,
                "typing_cps": 4.8,
                "swipe_velocity_px_s": 1150.0,
            },
            "expected_verdicts": ["ALLOW"],
            "max_risk": 24.9,
            "expected_threat_tags": ["CLEAN"],
        },
        {
            "step_number": 2,
            "name": "Sudden Payout Modification & Rapid Withdrawal",
            "event": {
                "session_id": f"sess_{rider_id}_payout_redirect",
                "rider_id": rider_id,
                "city": "mumbai",
                "zone_id": "bandra_west",
                "is_new_device": True,
                "sensitive_action_count": 2,
                "payout_account_updated": 1,
                "withdrawal_requested": 1,
                "financial": {
                    "payout_account_changed": True,
                    "withdrawal_requested": True,
                    "withdrawal_amount": 18500.0,
                    "withdrawal_time_delta_sec": 30,
                },
                "threat_tags": ["PAYOUT_REDIRECT"],
            },
            "expected_verdicts": ["CHALLENGE", "ESCALATE"],
            "min_risk": 45.0,
            "expected_threat_tags": ["PAYOUT_REDIRECT"],
        },
    ]
    return {
        "scenario_id": "P1",
        "name": "Payout Instrument Hijack",
        "category": "attack",
        "description": "Sudden payout account swap followed by immediate withdrawal. Triggers step-up verification.",
        "baseline": baseline,
        "steps": steps,
    }


# Scenario Registry
SCENARIO_BUILDERS = {
    "N1": build_scenario_N1,
    "O1": build_scenario_O1,
    "O2": build_scenario_O2,
    "O3": build_scenario_O3,
    "O4": build_scenario_O4,
    "H1": build_scenario_H1,
    "T1": build_scenario_T1,
    "T2": build_scenario_T2,
    "F1": build_scenario_F1,
    "P1": build_scenario_P1,
}


def list_scenarios() -> List[ScenarioInfoResponse]:
    """Returns catalog of all scripted evaluation and demonstration scenarios."""
    catalog: List[ScenarioInfoResponse] = []
    for sid, builder_fn in SCENARIO_BUILDERS.items():
        data = builder_fn()
        # Find expected final verdict from last step
        last_step = data["steps"][-1]
        catalog.append(
            ScenarioInfoResponse(
                scenario_id=sid,
                name=data["name"],
                description=data["description"],
                category=data["category"],
                expected_verdict=last_step["expected_verdicts"][-1],
                expected_threat_tags=last_step.get("expected_threat_tags", []),
            )
        )
    return catalog


def run_scenario(
    scenario_id: str,
    emit_events: bool = True,
    session_id_prefix: Optional[str] = None,
    cfg: Optional[ThresholdConfig] = None,
) -> ScenarioRunResponse:
    """
    Executes a scenario step-by-step against the multi-modal risk scoring engine.
    Optionally emits real-time scoring assessments to event_bus for live SSE broadcasting.
    """
    sid = scenario_id.strip().upper()
    if sid not in SCENARIO_BUILDERS:
        raise ValueError(
            f"Scenario '{scenario_id}' not found. Available scenarios: {list(SCENARIO_BUILDERS.keys())}"
        )

    builder_fn = SCENARIO_BUILDERS[sid]
    prefix = session_id_prefix or f"demo_{sid.lower()}"
    scenario_data = builder_fn(rider_id=prefix)

    baseline = copy.deepcopy(scenario_data["baseline"])
    active_cfg = cfg or DEFAULT_THRESHOLDS

    step_results: List[ScenarioStepResponse] = []
    all_threat_tags: List[str] = []
    all_passed = True

    history_records: List[Any] = []

    for step in scenario_data["steps"]:
        event_dict = copy.deepcopy(step["event"])

        # Handle adaptation hooks
        if "adapt_behavior_dev" in step:
            baseline_service.process_session_adaptation(
                baseline=baseline,
                session_info=event_dict,
                behavior_dev=step["adapt_behavior_dev"],
            )

        if "zone_adapt_complete" in step:
            z = step["zone_adapt_complete"]
            if z not in baseline.get("known_zones", []):
                baseline.setdefault("known_zones", []).append(z)
            baseline.setdefault("zone_profile", {})[z] = 0.35

        if "combo_adapt_complete" in step:
            c = step["combo_adapt_complete"]
            if c.get("device_id") not in baseline.get("known_device_ids", []):
                baseline.setdefault("known_device_ids", []).append(c["device_id"])
            if c.get("zone") not in baseline.get("known_zones", []):
                baseline.setdefault("known_zones", []).append(c["zone"])
            if c.get("zone"):
                baseline.setdefault("zone_profile", {})[c["zone"]] = 0.35
            adapt_st = baseline.setdefault("adaptation_state", {})
            if isinstance(adapt_st, dict):
                adapt_st.setdefault("new_device", {})["trusted"] = True

        if "multi_session_adapt" in step:
            ms = step["multi_session_adapt"]
            d1 = datetime.now(timezone.utc) - timedelta(days=2)
            d2 = datetime.now(timezone.utc) - timedelta(days=1)
            for i in range(ms.get("sessions_day1", 3)):
                baseline_service.process_session_adaptation(
                    baseline, event_dict, 0.12, timestamp=d1 + timedelta(hours=i)
                )
            for i in range(ms.get("sessions_day2", 2)):
                baseline_service.process_session_adaptation(
                    baseline, event_dict, 0.12, timestamp=d2 + timedelta(hours=i)
                )
            baseline["home_city"] = ms.get("city", baseline.get("home_city"))

        # Build scoring context
        ctx = ScoringContext(
            request_or_event=event_dict,
            baseline=baseline,
            history=history_records,
            active_policy=active_cfg,
            trust_health=step.get("trust_health_override"),
            travel_risk=float(event_dict.get("travel_risk", 0.0) or 0.0),
            graph_risk=float(event_dict.get("graph_risk", 0.0) or 0.0),
            device_risk=float(event_dict.get("device_risk", 0.0) or 0.0),
        )

        assessment = score_session(ctx)
        history_records.append(assessment)

        # Broadcast assessment live via SSE
        if emit_events:
            event_bus.publish(
                "assessment",
                {
                    "scenario_id": sid,
                    "step": step["step_number"],
                    "session_id": str(event_dict.get("session_id", "")),
                    "risk_score": assessment.risk_score,
                    "verdict": assessment.verdict,
                    "classification": assessment.classification,
                    "threat_tags": assessment.threat_tags,
                },
            )

        # Validate step criteria
        expected_verdicts = step.get("expected_verdicts", [])
        min_risk = step.get("min_risk", 0.0)
        max_risk = step.get("max_risk", 100.0)
        expected_tags = step.get("expected_threat_tags", [])

        passed_verdict = not expected_verdicts or (assessment.verdict in expected_verdicts)
        passed_score = min_risk <= assessment.risk_score <= max_risk
        passed_tags = True
        if expected_tags and expected_tags != ["CLEAN"]:
            passed_tags = any(t in assessment.threat_tags for t in expected_tags)

        step_passed = passed_verdict and passed_score and passed_tags
        if not step_passed:
            all_passed = False

        for t in assessment.threat_tags:
            if t not in all_threat_tags and t != "CLEAN":
                all_threat_tags.append(t)

        step_res = ScenarioStepResponse(
            step_number=step["step_number"],
            event_name=step["name"],
            session_id=str(event_dict.get("session_id", "")),
            risk_score=assessment.risk_score,
            raw_risk=assessment.raw_risk,
            verdict=assessment.verdict,
            risk_tier=assessment.risk_tier,
            classification=assessment.classification,
            recommended_action=assessment.recommended_action,
            threat_tags=assessment.threat_tags,
            factors=[f.model_dump() for f in assessment.factors],
            mitigating_factors=[f.model_dump() for f in assessment.mitigating_factors],
            adaptation_progress=assessment.adaptation_progress,
            passed=step_passed,
            notes=f"Verdict: {assessment.verdict} (score: {assessment.risk_score})",
        )
        step_results.append(step_res)

    initial_step = step_results[0]
    final_step = step_results[-1]

    summary = (
        f"Scenario {sid} ({scenario_data['name']}) completed {'successfully' if all_passed else 'with failures'}. "
        f"Initial verdict: {initial_step.verdict} ({initial_step.risk_score}), "
        f"Final verdict: {final_step.verdict} ({final_step.risk_score}). "
        f"Threat tags: {all_threat_tags or ['CLEAN']}."
    )

    return ScenarioRunResponse(
        scenario_id=sid,
        name=scenario_data["name"],
        category=scenario_data["category"],
        passed=all_passed,
        initial_verdict=initial_step.verdict,
        final_verdict=final_step.verdict,
        initial_risk_score=initial_step.risk_score,
        final_risk_score=final_step.risk_score,
        threat_tags=all_threat_tags or ["CLEAN"],
        steps=step_results,
        summary=summary,
    )
