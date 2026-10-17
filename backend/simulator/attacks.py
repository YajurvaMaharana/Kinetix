"""
TrustJuggler Attack Simulation Engine.
Implements attack archetypes:
1. Account Handoffs: classic, no_selfie, concurrent, slow_burn (behavior from different persona)
2. GPS Spoofing: mock location flag and/or perfectly linear route with zero speed variance
3. Impossible Travel: cross-city location jumps within minutes (> 4000 km/h)
4. Fraud Rings: collusion clusters sharing device tokens, payout accounts, and IP addresses
5. Payout Hijacks: sudden bank account reroute followed by immediate withdrawal
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import numpy as np

from app.services.privacy import tokenize
from simulator.generator import generate_single_session
from simulator.personas import CITIES_ZONES, RiderPersona


def make_handoff(
    persona: RiderPersona,
    other_persona: RiderPersona,
    variant: str = "classic",
    day_idx: int = 32,
    rng: Optional[np.random.RandomState] = None,
) -> Dict[str, Any]:
    """
    Simulates account handoff / renting where a DIFFERENT rider operates the account.
    Telemetry and touch biometrics originate from other_persona's distribution.
    """
    if rng is None:
        rng = np.random.RandomState(42)

    now = datetime.now(timezone.utc) + timedelta(days=day_idx)
    session_id = f"sess_{persona.rider_id}_handoff_{variant}_{day_idx}"

    # Attacker device
    attacker_dev = other_persona.primary_device

    # Base session generated using other_persona's biometric profile
    sess = generate_single_session(
        persona=other_persona,
        session_id=session_id,
        timestamp=now,
        rng=rng,
        device_override=attacker_dev,
        label="suspected_handoff",
        ground_truth_label=f"handoff_{variant}",
    )
    # Re-assign victim rider_id
    sess["rider_id"] = persona.rider_id
    sess["threat_tags"] = ["ACCOUNT_HANDOFF"]

    if variant == "classic":
        # Attacker face mismatch
        sess["biometrics"]["face_match_confidence"] = round(float(rng.uniform(0.12, 0.38)), 3)
        sess["biometrics"]["liveness_score"] = round(float(rng.uniform(0.70, 0.95)), 3)

    elif variant == "no_selfie":
        # Attacker refuses or fails liveness
        sess["biometrics"]["face_match_confidence"] = round(float(rng.uniform(0.05, 0.20)), 3)
        sess["biometrics"]["liveness_score"] = round(float(rng.uniform(0.10, 0.29)), 3)
        sess["telemetry"]["challenge_declined"] = True

    elif variant == "concurrent":
        # Concurrent session detected in another sector
        sess["telemetry"]["concurrent_session_detected"] = True
        sess["telemetry"]["concurrent_distance_km"] = round(float(rng.uniform(25.0, 180.0)), 1)
        sess["threat_tags"].append("CONCURRENT_SESSION")

    elif variant == "slow_burn":
        # Attacker blends behavior slightly but deviates from victim baseline
        sess["biometrics"]["face_match_confidence"] = round(float(rng.uniform(0.42, 0.60)), 3)

    return sess


def make_gps_spoof(
    persona: RiderPersona,
    day_idx: int = 33,
    rng: Optional[np.random.RandomState] = None,
) -> Dict[str, Any]:
    """
    Simulates GPS spoofing via mock location provider and unnaturally straight,
    constant-speed trajectory (zero speed variance, straightness ~ 1.0).
    """
    if rng is None:
        rng = np.random.RandomState(42)

    now = datetime.now(timezone.utc) + timedelta(days=day_idx)
    session_id = f"sess_{persona.rider_id}_spoof_{day_idx}"

    sess = generate_single_session(
        persona=persona,
        session_id=session_id,
        timestamp=now,
        rng=rng,
        label="suspected_handoff",
        ground_truth_label="gps_spoof",
    )

    # GPS Spoof route: perfectly linear with zero acceleration/speed variance
    fixed_speed = round(float(rng.choice([30.0, 40.0, 50.0])), 2)
    start_lat = sess["latitude"]
    start_lng = sess["longitude"]

    spoofed_points = []
    # 10 collinear points with exactly 0.0 speed variance
    for step in range(8):
        spoofed_points.append({
            "step": step,
            "latitude": round(start_lat + (step * 0.005), 6),
            "longitude": round(start_lng + (step * 0.005), 6),
            "speed_kmh": fixed_speed,
            "mock_location": True,
        })

    sess["telemetry"]["mock_location_detected"] = True
    sess["telemetry"]["speed_variance"] = 0.01  # extremely low
    sess["telemetry"]["straightness_ratio"] = 0.998  # unnaturally linear
    sess["telemetry"]["route_adherence"] = 0.999
    sess["avg_speed_kmh"] = fixed_speed
    sess["threat_tags"] = ["GPS_SPOOFING"]

    # Overwrite location events
    sess["events"] = [e for e in sess["events"] if e["event_type"] != "location_ping"]
    for p in spoofed_points:
        sess["events"].append({
            "event_type": "location_ping",
            "payload": p,
            "created_at": (now + timedelta(minutes=p["step"] * 2)).isoformat(),
        })

    return sess


def make_impossible_travel(
    persona: RiderPersona,
    day_idx: int = 34,
    rng: Optional[np.random.RandomState] = None,
) -> Dict[str, Any]:
    """
    Simulates impossible travel: location jump between two distant cities within minutes.
    E.g., Mumbai to Delhi in 10 minutes (> 4000 km/h).
    """
    if rng is None:
        rng = np.random.RandomState(42)

    now = datetime.now(timezone.utc) + timedelta(days=day_idx)
    session_id = f"sess_{persona.rider_id}_imptravel_{day_idx}"

    sess = generate_single_session(
        persona=persona,
        session_id=session_id,
        timestamp=now,
        rng=rng,
        label="suspected_handoff",
        ground_truth_label="impossible_travel",
    )

    # Pick destination city far from home_city
    other_cities = [c for c in CITIES_ZONES.keys() if c != persona.home_city]
    dest_city = rng.choice(other_cities)
    dest_zone = list(CITIES_ZONES[dest_city].keys())[0]
    dest_lat, dest_lng = CITIES_ZONES[dest_city][dest_zone]

    # Teleportation jump 10 minutes later
    ping1 = {
        "step": 0,
        "latitude": sess["latitude"],
        "longitude": sess["longitude"],
        "speed_kmh": 25.0,
        "city": persona.home_city,
    }
    ping2 = {
        "step": 1,
        "latitude": dest_lat,
        "longitude": dest_lng,
        "speed_kmh": 4200.0,
        "city": dest_city,
    }

    sess["telemetry"]["impossible_travel_detected"] = True
    sess["telemetry"]["jump_distance_km"] = 1150.0
    sess["telemetry"]["jump_elapsed_minutes"] = 10
    sess["telemetry"]["speed_between_pings_kmh"] = 6900.0
    sess["threat_tags"] = ["IMPOSSIBLE_TRAVEL"]

    sess["events"].append({
        "event_type": "location_ping",
        "payload": ping1,
        "created_at": now.isoformat(),
    })
    sess["events"].append({
        "event_type": "location_ping",
        "payload": ping2,
        "created_at": (now + timedelta(minutes=10)).isoformat(),
    })

    return sess


def make_fraud_ring(
    personas: List[RiderPersona],
    ring_id: str,
    day_idx: int = 35,
    rng: Optional[np.random.RandomState] = None,
) -> List[Dict[str, Any]]:
    """
    Simulates a fraud ring cluster (3-6 riders) sharing:
    - Same hardware device token (e.g. emulator farm)
    - Same payout account token (funds consolidation)
    - Same IP token / ASN
    - Similar bot/scripted biometrics
    """
    if rng is None:
        rng = np.random.RandomState(42)

    shared_device_raw = f"farm_redmi_emu_{ring_id}"
    shared_device_token = tokenize(shared_device_raw)
    shared_payout_raw = f"shared_mule_acc_{ring_id}"
    shared_payout_token = tokenize(shared_payout_raw)
    shared_ip = tokenize(f"185.220.101.{rng.randint(10, 99)}")

    shared_device = {
        "id": f"dev_shared_{ring_id}",
        "model": "Redmi Note 9 (Emu)",
        "os_version": "Android 10",
        "app_version": "2.4.0",
        "fingerprint": shared_device_token,
        "raw_fingerprint": shared_device_raw,
        "is_emulator": True,
        "is_rooted": True,
        "trust_rating": 0.20,
    }

    ring_sessions: List[Dict[str, Any]] = []
    base_time = datetime.now(timezone.utc) + timedelta(days=day_idx)

    for i, p in enumerate(personas):
        sess_time = base_time + timedelta(minutes=i * 20)
        session_id = f"sess_{p.rider_id}_ring_{ring_id}_{i}"

        sess = generate_single_session(
            persona=p,
            session_id=session_id,
            timestamp=sess_time,
            rng=rng,
            device_override=shared_device,
            label="suspected_handoff",
            ground_truth_label="fraud_ring",
        )
        # Shared ring attributes
        sess["ip_address"] = shared_ip
        sess["payout_account_token"] = shared_payout_token
        sess["device_fingerprint"] = shared_device_token
        sess["is_emulator"] = True
        sess["is_rooted"] = True
        sess["threat_tags"] = ["FRAUD_RING", "DEVICE_FARM"]
        sess["telemetry"]["ring_id"] = ring_id
        sess["telemetry"]["shared_device_count"] = len(personas)
        sess["telemetry"]["shared_payout_count"] = len(personas)

        # Bot-like touch biometrics
        sess["tap_interval_ms"] = round(float(rng.normal(150.0, 5.0)), 2)
        sess["typing_cps"] = round(float(rng.normal(4.0, 0.1)), 2)

        ring_sessions.append(sess)

    return ring_sessions


def make_payout_hijack(
    persona: RiderPersona,
    day_idx: int = 36,
    rng: Optional[np.random.RandomState] = None,
) -> Dict[str, Any]:
    """
    Simulates a payout redirect hijack:
    Sudden payout account token swap immediately followed by a withdrawal request.
    """
    if rng is None:
        rng = np.random.RandomState(42)

    now = datetime.now(timezone.utc) + timedelta(days=day_idx)
    session_id = f"sess_{persona.rider_id}_payout_hijack_{day_idx}"

    sess = generate_single_session(
        persona=persona,
        session_id=session_id,
        timestamp=now,
        rng=rng,
        label="suspected_handoff",
        ground_truth_label="payout_hijack",
    )

    hijack_acc_raw = f"hijack_acc_{rng.randint(100000, 999999)}"
    new_payout_token = tokenize(hijack_acc_raw)

    sess["threat_tags"] = ["PAYOUT_REDIRECT"]
    sess["financial"] = {
        "payout_account_changed": True,
        "old_payout_token": persona.payout_account["account_token"],
        "new_payout_token": new_payout_token,
        "withdrawal_requested": True,
        "withdrawal_amount": 18500.0,
        "withdrawal_time_delta_sec": 45,
    }

    sess["events"].append({
        "event_type": "payout_account_updated",
        "payload": {
            "new_account_token": new_payout_token,
            "channel": "API_AUTOMATED",
        },
        "created_at": now.isoformat(),
    })
    sess["events"].append({
        "event_type": "withdrawal_requested",
        "payload": {
            "amount": 18500.0,
            "currency": "INR",
        },
        "created_at": (now + timedelta(seconds=45)).isoformat(),
    })

    return sess
