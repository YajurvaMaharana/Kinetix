"""
TrustJuggler Event & Session Generator.
Generates 30 days of normal historical sessions with realistic telemetry, location trajectories,
trip state machine transitions, screen navigation walks, and ordinary operational life changes.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import numpy as np

from app.services.privacy import tokenize
from simulator.personas import (
    CITIES_ZONES,
    DEVICE_MODELS,
    RiderPersona,
)


def sample_bounded(
    mean: float,
    sd: float,
    rng: np.random.RandomState,
    low: float,
    high: float,
) -> float:
    """Samples a normal variable clipped to specified bounds."""
    val = float(rng.normal(mean, sd))
    return round(float(np.clip(val, low, high)), 4)


def generate_nav_walk(
    persona: RiderPersona,
    n_steps: int,
    rng: np.random.RandomState,
) -> List[str]:
    """Generates a sequence of screen visits according to persona's Markov matrix."""
    curr_idx = 0  # Start at 'home'
    walk = [persona.screens[curr_idx]]
    for _ in range(n_steps - 1):
        probs = persona.screen_transitions[curr_idx]
        # Ensure valid probabilities
        probs = probs / np.sum(probs)
        curr_idx = int(rng.choice(len(persona.screens), p=probs))
        walk.append(persona.screens[curr_idx])
    return walk


def compute_walk_similarity(walk: List[str], persona: RiderPersona) -> float:
    """
    Computes cosine similarity between the empirical transitions of walk
    and the rider's Markov transition matrix.
    """
    if len(walk) < 2:
        return 0.85

    screen_to_idx = {s: i for i, s in enumerate(persona.screens)}
    n = len(persona.screens)
    emp_matrix = np.zeros((n, n), dtype=np.float32)

    for i in range(len(walk) - 1):
        u = screen_to_idx.get(walk[i], 0)
        v = screen_to_idx.get(walk[i + 1], 0)
        emp_matrix[u, v] += 1.0

    # Normalize
    row_sums = emp_matrix.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    emp_prob = emp_matrix / row_sums

    # Flatten and compute cosine similarity
    v1 = emp_prob.flatten()
    v2 = persona.screen_transitions.flatten()
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0 or norm2 == 0:
        return 0.80
    sim = float(np.dot(v1, v2) / (norm1 * norm2))
    return round(float(np.clip(sim, 0.40, 0.99)), 3)


def generate_route_points(
    start_lat: float,
    start_lng: float,
    speed_kmh: float,
    duration_min: int,
    rng: np.random.RandomState,
    jitter_sd: float = 0.0003,
) -> List[Dict[str, Any]]:
    """
    Generates realistic location pings along an urban trajectory with GPS jitter,
    speed variations, and curvature.
    """
    n_points = max(4, duration_min // 2)
    points = []
    curr_lat, curr_lng = start_lat, start_lng

    # Random heading in radians
    heading = float(rng.uniform(0, 2 * np.pi))

    for i in range(n_points):
        # 1 deg lat is ~111km; 1 deg lng is ~111km * cos(lat)
        dist_km = (speed_kmh / 60.0) * 2.0  # distance in 2 mins
        deg_lat = (dist_km / 111.0) * np.cos(heading)
        deg_lng = (dist_km / (111.0 * np.cos(np.radians(curr_lat)))) * np.sin(heading)

        # Subtle heading curvature and road jitter
        heading += float(rng.normal(0, 0.25))
        curr_lat += deg_lat + float(rng.normal(0, jitter_sd))
        curr_lng += deg_lng + float(rng.normal(0, jitter_sd))

        speed_inst = max(5.0, float(rng.normal(speed_kmh, speed_kmh * 0.15)))

        points.append({
            "step": i,
            "latitude": round(float(curr_lat), 6),
            "longitude": round(float(curr_lng), 6),
            "speed_kmh": round(float(speed_inst), 2),
            "mock_location": False,
        })

    return points


def generate_single_session(
    persona: RiderPersona,
    session_id: str,
    timestamp: datetime,
    rng: np.random.RandomState,
    zone_override: Optional[str] = None,
    device_override: Optional[Dict[str, Any]] = None,
    biometric_shift_factor: float = 1.0,
    label: str = "normal",
    ground_truth_label: str = "normal",
    scenario_run_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Generates a complete session dictionary with all 10 metrics and events."""
    # Select zone
    zone = zone_override or rng.choice(persona.zones)
    start_lat, start_lng = persona.zone_coords.get(
        zone, list(persona.zone_coords.values())[0]
    )

    # Device
    dev = device_override or persona.primary_device

    # Sample all 10 behavior metrics around persona's parameters
    params = persona.metric_params

    # 1. tap_interval_ms
    tap = sample_bounded(
        params["tap_interval_ms"][0] * biometric_shift_factor,
        params["tap_interval_ms"][1],
        rng, 100.0, 320.0
    )
    # 2. typing_cps
    typing = sample_bounded(
        params["typing_cps"][0] * (1.0 / biometric_shift_factor),
        params["typing_cps"][1],
        rng, 1.8, 8.0
    )
    # 3. swipe_velocity_px_s
    swipe = sample_bounded(
        params["swipe_velocity_px_s"][0] * biometric_shift_factor,
        params["swipe_velocity_px_s"][1],
        rng, 450.0, 1900.0
    )
    # 4. interaction_timing_cv
    timing_cv = sample_bounded(
        params["interaction_timing_cv"][0],
        params["interaction_timing_cv"][1],
        rng, 0.10, 0.60
    )
    # 5. accept_latency_s
    accept_lat = sample_bounded(
        params["accept_latency_s"][0],
        params["accept_latency_s"][1],
        rng, 1.0, 18.0
    )
    # 6. avg_speed_kmh
    speed = sample_bounded(
        params["avg_speed_kmh"][0],
        params["avg_speed_kmh"][1],
        rng, 10.0, 48.0
    )
    # 7. route_adherence
    adherence = sample_bounded(
        params["route_adherence"][0],
        params["route_adherence"][1],
        rng, 0.60, 0.99
    )
    # 8. trip_cadence_per_hr
    cadence = sample_bounded(
        params["trip_cadence_per_hr"][0],
        params["trip_cadence_per_hr"][1],
        rng, 0.8, 5.0
    )

    # Shift hour distance
    curr_hour = timestamp.hour + timestamp.minute / 60.0
    start_mean = persona.shift_pattern["start_hour_mean"]
    raw_dist = abs(curr_hour - start_mean)
    circ_dist = min(raw_dist, 24.0 - raw_dist)
    shift_hour_dist = round(float(circ_dist), 2)

    # Nav path walk
    nav_walk = generate_nav_walk(persona, n_steps=rng.randint(6, 12), rng=rng)
    nav_sim = compute_walk_similarity(nav_walk, persona)

    # Count transitions for baseline
    nav_transitions: Dict[str, int] = {}
    for i in range(len(nav_walk) - 1):
        k = f"{nav_walk[i]}->{nav_walk[i + 1]}"
        nav_transitions[k] = nav_transitions.get(k, 0) + 1

    # Route location pings
    duration_min = rng.randint(25, 60)
    route_points = generate_route_points(start_lat, start_lng, speed, duration_min, rng)

    # Trip events
    events = []
    # 1. Location pings
    for p in route_points:
        events.append({
            "event_type": "location_ping",
            "payload": p,
            "created_at": (timestamp + timedelta(minutes=p["step"] * 2)).isoformat(),
        })
    # 2. Trip acceptance and completion
    events.append({
        "event_type": "trip_accepted",
        "payload": {"accept_latency_s": accept_lat, "zone": zone},
        "created_at": (timestamp + timedelta(seconds=int(accept_lat))).isoformat(),
    })
    events.append({
        "event_type": "trip_picked_up",
        "payload": {"zone": zone},
        "created_at": (timestamp + timedelta(minutes=10)).isoformat(),
    })
    events.append({
        "event_type": "trip_completed",
        "payload": {"distance_km": round(speed * (duration_min / 60.0), 2)},
        "created_at": (timestamp + timedelta(minutes=duration_min)).isoformat(),
    })
    # 3. Nav walk events
    for i, scr in enumerate(nav_walk):
        events.append({
            "event_type": "screen_nav",
            "payload": {"screen": scr, "step": i},
            "created_at": (timestamp + timedelta(seconds=i * 15)).isoformat(),
        })

    # Tokenized IP
    raw_ip = f"103.{rng.randint(10, 250)}.{rng.randint(1, 254)}.{rng.randint(1, 254)}"
    tokenized_ip = tokenize(raw_ip)

    return {
        "session_id": session_id,
        "rider_id": persona.rider_id,
        "device_id": dev["id"],
        "device_model": dev["model"],
        "device_fingerprint": dev["fingerprint"],
        "is_emulator": dev.get("is_emulator", False),
        "is_rooted": dev.get("is_rooted", False),
        "ip_address": tokenized_ip,
        "asn": rng.choice(persona.asns),
        "city": persona.home_city,
        "zone_id": zone,
        "latitude": start_lat,
        "longitude": start_lng,
        "start_hour": round(curr_hour, 2),
        "created_at": timestamp.isoformat(),
        "status": "COMPLETED",
        "label": label,
        "ground_truth_label": ground_truth_label,
        "scenario_run_id": scenario_run_id,
        "threat_tags": [],
        # All 10 Metrics
        "tap_interval_ms": tap,
        "typing_cps": typing,
        "swipe_velocity_px_s": swipe,
        "interaction_timing_cv": timing_cv,
        "nav_path_similarity": nav_sim,
        "accept_latency_s": accept_lat,
        "shift_hour_dist": shift_hour_dist,
        "avg_speed_kmh": speed,
        "route_adherence": adherence,
        "trip_cadence_per_hr": cadence,
        # Contextual biometrics
        "biometrics": {
            "tap_interval_ms": tap,
            "typing_cps": typing,
            "swipe_velocity_px_s": swipe,
            "face_match_confidence": round(float(rng.uniform(0.92, 0.99)), 3),
            "liveness_score": round(float(rng.uniform(0.90, 0.99)), 3),
        },
        "telemetry": {
            "interaction_timing_cv": timing_cv,
            "nav_path_similarity": nav_sim,
            "accept_latency_s": accept_lat,
            "shift_hour_dist": shift_hour_dist,
            "avg_speed_kmh": speed,
            "route_adherence": adherence,
            "trip_cadence_per_hr": cadence,
            "speed_variance": round(float(np.var([p["speed_kmh"] for p in route_points])), 2),
            "straightness_ratio": round(float(rng.uniform(0.75, 0.88)), 3),
            "mock_location_detected": False,
        },
        "nav_transitions": nav_transitions,
        "events": events,
    }


def generate_history(
    persona: RiderPersona,
    days: int = 30,
    rng: Optional[np.random.RandomState] = None,
) -> List[Dict[str, Any]]:
    """
    Generates 30 days of normal historical sessions for baseline profiling.
    Sessions follow the rider's shift pattern and preferred zones.
    """
    if rng is None:
        rng = np.random.RandomState(42)

    history: List[Dict[str, Any]] = []
    base_time = datetime.now(timezone.utc) - timedelta(days=days)

    sess_count = 0
    for day in range(days):
        # Sessions per day
        n_sessions = persona.shift_pattern.get("sessions_per_day", 2)
        day_date = base_time + timedelta(days=day)

        for s_idx in range(n_sessions):
            sess_count += 1
            # Sample start hour based on rider shift distribution
            hr = float(rng.normal(
                persona.shift_pattern["start_hour_mean"],
                persona.shift_pattern["start_hour_sd"],
            ))
            hr = float(np.clip(hr, 6.0, 23.0))
            sess_time = day_date.replace(
                hour=int(hr),
                minute=int((hr % 1) * 60),
                second=rng.randint(0, 59),
                microsecond=0,
            )

            sess = generate_single_session(
                persona=persona,
                session_id=f"sess_{persona.rider_id}_hist_{day:02d}_{s_idx}",
                timestamp=sess_time,
                rng=rng,
                label="normal",
                ground_truth_label="normal",
            )
            history.append(sess)

    return history


def make_ordinary_change(
    persona: RiderPersona,
    kind: str,
    day_idx: int = 31,
    rng: Optional[np.random.RandomState] = None,
) -> Dict[str, Any]:
    """
    Simulates ordinary life changes:
    - new_phone: New handset, tap/typing/swipe shift 5-20%, core behavior same
    - relocation: Gradual shift to a new city, same device & biometrics
    - new_zone: Rider operates in a different zone in same city
    - new_phone_and_zone: Combined new device and new delivery zone
    All have label 'ordinary_change'.
    """
    if rng is None:
        rng = np.random.RandomState(42)

    now = datetime.now(timezone.utc) + timedelta(days=day_idx)
    session_id = f"sess_{persona.rider_id}_ord_{kind}_{day_idx}"

    device = persona.primary_device
    zone = None
    shift_factor = 1.0

    if kind == "new_phone":
        # New device with 5-20% shift on touch biometrics
        new_model = rng.choice([m for m in DEVICE_MODELS if m != persona.primary_device["model"]] or DEVICE_MODELS)
        raw_fp = f"fp_new_{new_model.replace(' ', '_')}_{persona.rider_id}_{rng.randint(1000, 9999)}"
        device = {
            "id": f"dev_{persona.rider_id}_newphone",
            "model": new_model,
            "os_version": "Android 14",
            "app_version": "2.4.2",
            "fingerprint": tokenize(raw_fp),
            "raw_fingerprint": raw_fp,
            "is_emulator": False,
            "is_rooted": False,
            "trust_rating": 0.85,
        }
        # 5% to 20% biometric shift due to glass screen / keyboard size change
        shift_factor = float(rng.choice([1.08, 1.15, 0.92, 0.88]))

    elif kind == "relocation":
        # Relocate to another city
        other_cities = [c for c in CITIES_ZONES.keys() if c != persona.home_city]
        new_city = rng.choice(other_cities)
        new_city_zones = CITIES_ZONES[new_city]
        zone = rng.choice(list(new_city_zones.keys()))

    elif kind == "new_zone":
        # Select an unselected zone in the same city
        all_city_zones = list(CITIES_ZONES[persona.home_city].keys())
        diff_zones = [z for z in all_city_zones if z not in persona.zones]
        zone = rng.choice(diff_zones if diff_zones else all_city_zones)

    elif kind == "new_phone_and_zone":
        new_model = rng.choice([m for m in DEVICE_MODELS if m != persona.primary_device["model"]] or DEVICE_MODELS)
        raw_fp = f"fp_combo_{new_model.replace(' ', '_')}_{persona.rider_id}_{rng.randint(1000, 9999)}"
        device = {
            "id": f"dev_{persona.rider_id}_combo",
            "model": new_model,
            "os_version": "Android 14",
            "app_version": "2.4.2",
            "fingerprint": tokenize(raw_fp),
            "raw_fingerprint": raw_fp,
            "is_emulator": False,
            "is_rooted": False,
            "trust_rating": 0.85,
        }
        shift_factor = float(rng.choice([1.12, 1.18, 0.85]))
        all_city_zones = list(CITIES_ZONES[persona.home_city].keys())
        diff_zones = [z for z in all_city_zones if z not in persona.zones]
        zone = rng.choice(diff_zones if diff_zones else all_city_zones)

    sess = generate_single_session(
        persona=persona,
        session_id=session_id,
        timestamp=now,
        rng=rng,
        zone_override=zone,
        device_override=device,
        biometric_shift_factor=shift_factor,
        label="ordinary_change",
        ground_truth_label="ordinary_change",
    )
    sess["threat_tags"] = ["ORDINARY_CHANGE"]
    return sess
