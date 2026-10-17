"""
TrustJuggler Persona Generator.
Generates realistic rider personas sampled with a seeded RNG across 5 Indian tier-1 metro cities.
Includes 10 behavioral biometrics parameters, screen transition matrices, primary hardware profiles,
and Fernet-encrypted synthetic biometric embeddings.
"""

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple

import numpy as np
from cryptography.fernet import Fernet

from app.config import settings
from app.services.privacy import tokenize

# Indian Cities and 5 distinct delivery zones each
CITIES_ZONES: Dict[str, Dict[str, Tuple[float, float]]] = {
    "Mumbai": {
        "bandra_west": (19.0596, 72.8295),
        "andheri_east": (19.1136, 72.8697),
        "powai": (19.1176, 72.9060),
        "dadar": (19.0178, 72.8478),
        "colaba": (18.9067, 72.8147),
    },
    "Pune": {
        "kothrud": (18.5074, 73.8077),
        "viman_nagar": (18.5679, 73.9143),
        "hinjewadi": (18.5913, 73.7389),
        "koregaon_park": (18.5362, 73.8940),
        "baner": (18.5590, 73.7868),
    },
    "Bengaluru": {
        "koramangala": (12.9352, 77.6245),
        "indiranagar": (12.9784, 77.6408),
        "whitefield": (12.9698, 77.7500),
        "hsr_layout": (12.9121, 77.6446),
        "electronic_city": (12.8399, 77.6770),
    },
    "Delhi": {
        "connaught_place": (28.6304, 77.2177),
        "hauz_khas": (28.5494, 77.2001),
        "saket": (28.5244, 77.2104),
        "dwarka": (28.5921, 77.0460),
        "rohini": (28.7495, 77.0565),
    },
    "Hyderabad": {
        "hitec_city": (17.4435, 78.3772),
        "madhapur": (17.4483, 78.3915),
        "banjara_hills": (17.4156, 78.4352),
        "gachibowli": (17.4401, 78.3489),
        "secunderabad": (17.4399, 78.4983),
    },
}

DEVICE_MODELS = [
    "Redmi Note 12",
    "Samsung Galaxy M34",
    "Realme 11",
    "OnePlus Nord CE 3",
    "Vivo T2 5G",
    "POCO X5 5G",
    "Motorola G54",
]

COMMON_ASNS = [
    ("AS55836", "Reliance Jio"),
    ("AS45609", "Bharti Airtel"),
    ("AS9829", "BSNL"),
    ("AS133694", "Vodafone Idea"),
]

SCREENS = [
    "home",
    "orders_list",
    "order_detail",
    "navigation",
    "customer_chat",
    "earnings",
    "profile",
]

FIRST_NAMES = [
    "Aarav",
    "Rohan",
    "Vikram",
    "Aditya",
    "Rahul",
    "Pooja",
    "Ananya",
    "Sneha",
    "Amit",
    "Priya",
    "Karan",
    "Suresh",
    "Sunil",
    "Deepak",
    "Manish",
    "Rajesh",
    "Naveen",
    "Gaurav",
    "Neha",
    "Divya",
    "Sanjay",
    "Anil",
    "Meera",
    "Swati",
]

LAST_NAMES = [
    "Sharma",
    "Patel",
    "Verma",
    "Kulkarni",
    "Deshmukh",
    "Reddy",
    "Nair",
    "Rao",
    "Gupta",
    "Singh",
    "Joshi",
    "Chavan",
    "Mehta",
    "Iyer",
    "Yadav",
    "Kumar",
]


@dataclass
class RiderPersona:
    rider_id: str
    display_name: str
    phone_number: str
    home_city: str
    zones: List[str]
    zone_coords: Dict[str, Tuple[float, float]]
    primary_device: Dict[str, Any]
    asns: List[str]
    shift_pattern: Dict[str, float]
    face_id: str
    face_embedding: np.ndarray
    encrypted_face_embedding: str
    face_embedding_hash: str
    payout_account: Dict[str, str]
    metric_params: Dict[str, Tuple[float, float]]  # metric_name -> (mean, sd)
    screen_transitions: np.ndarray  # len(SCREENS) x len(SCREENS) Markov matrix
    screens: List[str] = field(default_factory=lambda: list(SCREENS))


def generate_persona(rider_idx: int, rng: np.random.RandomState) -> RiderPersona:
    """
    Samples a complete, consistent RiderPersona using the provided seeded RNG.
    Ensures within-rider noise is strictly lower than between-rider spread.
    """
    rider_id = f"rider_{rider_idx:04d}"
    first_name = rng.choice(FIRST_NAMES)
    last_name = rng.choice(LAST_NAMES)
    display_name = f"{first_name} {last_name}"
    phone_number = f"+91-{rng.randint(7000, 9999)}-{rng.randint(100000, 999999)}"

    # City & zones
    home_city = rng.choice(list(CITIES_ZONES.keys()))
    city_zones_dict = CITIES_ZONES[home_city]
    all_zone_names = list(city_zones_dict.keys())
    n_zones = rng.randint(3, len(all_zone_names) + 1)
    selected_zones = list(rng.choice(all_zone_names, size=n_zones, replace=False))
    zone_coords = {z: city_zones_dict[z] for z in selected_zones}

    # Primary Device
    dev_model = rng.choice(DEVICE_MODELS)
    os_ver = f"Android {rng.choice([12, 13, 14])}"
    app_ver = rng.choice(["2.4.0", "2.4.1", "2.4.2"])
    raw_fp = f"fp_{home_city.lower()}_{dev_model.replace(' ', '_')}_{rider_idx:04d}_{rng.randint(10000, 99999)}"
    tokenized_fp = tokenize(raw_fp)
    device_id = f"dev_{rider_id}_primary"

    primary_device = {
        "id": device_id,
        "model": dev_model,
        "os_version": os_ver,
        "app_version": app_ver,
        "fingerprint": tokenized_fp,
        "raw_fingerprint": raw_fp,
        "is_emulator": False,
        "is_rooted": False,
        "trust_rating": 1.0,
    }

    # ASNs (1 to 2 frequent internet providers)
    chosen_indices = rng.choice(len(COMMON_ASNS), size=rng.randint(1, 3), replace=False)
    chosen_asns = [COMMON_ASNS[i][0] for i in chosen_indices]

    # Shift pattern
    start_hour_mean = float(rng.uniform(7.0, 20.0))
    start_hour_sd = float(rng.uniform(0.8, 2.0))
    sessions_per_day = int(rng.choice([1, 2, 3], p=[0.25, 0.55, 0.20]))
    shift_pattern = {
        "start_hour_mean": round(start_hour_mean, 2),
        "start_hour_sd": round(start_hour_sd, 2),
        "sessions_per_day": sessions_per_day,
    }

    # Synthetic Face Embedding (128-dim normalized unit vector)
    face_raw = rng.randn(128).astype(np.float32)
    norm = np.linalg.norm(face_raw)
    face_embedding = face_raw / (norm if norm > 0 else 1.0)
    embedding_floats = [round(float(x), 5) for x in face_embedding]
    embedding_bytes = json.dumps(embedding_floats).encode("utf-8")

    # Store encrypted using application Fernet key
    fernet = Fernet(settings.TJ_FERNET_KEY.encode("utf-8"))
    encrypted_face = fernet.encrypt(embedding_bytes).decode("utf-8")
    face_embedding_hash = hashlib.sha256(embedding_bytes).hexdigest()
    face_id = f"face_{rider_id}"

    # Payout Account
    bank_name = rng.choice(
        ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Bank"]
    )
    raw_acc = f"9876543{rider_idx:05d}{rng.randint(100, 999)}"
    raw_routing = f"IFSC{bank_name[:4].upper()}{rng.randint(1000, 9999)}"
    payout_account = {
        "id": f"payout_{rider_id}",
        "bank_name": bank_name,
        "account_token": tokenize(raw_acc),
        "routing_token": tokenize(raw_routing),
        "account_type": "checking",
    }

    # 10 Behavior Metrics: (mean, sd)
    # Between-rider ranges are wide; within-rider noise is ~6-10% of range
    # 1. tap_interval_ms: 120 - 260 (range = 140)
    tap_mean = float(rng.uniform(120.0, 260.0))
    tap_sd = float(rng.uniform(8.0, 15.0))

    # 2. typing_cps: 2.5 - 6.5 (range = 4.0)
    typing_mean = float(rng.uniform(2.5, 6.5))
    typing_sd = float(rng.uniform(0.20, 0.40))

    # 3. swipe_velocity_px_s: 600 - 1600 (range = 1000)
    swipe_mean = float(rng.uniform(600.0, 1600.0))
    swipe_sd = float(rng.uniform(50.0, 90.0))

    # 4. interaction_timing_cv: 0.15 - 0.50 (range = 0.35)
    timing_cv_mean = float(rng.uniform(0.15, 0.50))
    timing_cv_sd = float(rng.uniform(0.015, 0.035))

    # 5. nav_path_similarity: rider's own typical 0.70 - 0.95 (range = 0.25)
    nav_sim_mean = float(rng.uniform(0.70, 0.95))
    nav_sim_sd = float(rng.uniform(0.015, 0.035))

    # 6. accept_latency_s: 2 - 14 (range = 12.0)
    accept_mean = float(rng.uniform(2.0, 14.0))
    accept_sd = float(rng.uniform(0.60, 1.20))

    # 7. shift_hour_dist: typical distance from rider's own shift mean 0.4 - 2.5
    shift_dist_mean = float(rng.uniform(0.4, 2.2))
    shift_dist_sd = float(rng.uniform(0.2, 0.5))

    # 8. avg_speed_kmh: 15 - 38 (range = 23.0)
    speed_mean = float(rng.uniform(15.0, 38.0))
    speed_sd = float(rng.uniform(1.50, 3.00))

    # 9. route_adherence: 0.70 - 0.97 (range = 0.27)
    adherence_mean = float(rng.uniform(0.70, 0.97))
    adherence_sd = float(rng.uniform(0.015, 0.035))

    # 10. trip_cadence_per_hr: 1.2 - 4.0 (range = 2.8)
    cadence_mean = float(rng.uniform(1.2, 4.0))
    cadence_sd = float(rng.uniform(0.12, 0.28))

    metric_params = {
        "tap_interval_ms": (round(tap_mean, 2), round(tap_sd, 2)),
        "typing_cps": (round(typing_mean, 2), round(typing_sd, 2)),
        "swipe_velocity_px_s": (round(swipe_mean, 2), round(swipe_sd, 2)),
        "interaction_timing_cv": (round(timing_cv_mean, 3), round(timing_cv_sd, 3)),
        "nav_path_similarity": (round(nav_sim_mean, 3), round(nav_sim_sd, 3)),
        "accept_latency_s": (round(accept_mean, 2), round(accept_sd, 2)),
        "shift_hour_dist": (round(shift_dist_mean, 2), round(shift_dist_sd, 2)),
        "avg_speed_kmh": (round(speed_mean, 2), round(speed_sd, 2)),
        "route_adherence": (round(adherence_mean, 3), round(adherence_sd, 3)),
        "trip_cadence_per_hr": (round(cadence_mean, 2), round(cadence_sd, 2)),
    }

    # Screen Transition Matrix (Markov transition probabilities)
    # 7 screens: rows sum to 1.0
    n_screens = len(SCREENS)
    # Sample row weights with a high affinity for natural delivery flow
    raw_matrix = rng.gamma(shape=1.5, scale=1.0, size=(n_screens, n_screens))
    # Bias towards forward delivery flow: home -> orders -> order_detail -> nav
    raw_matrix[0, 1] += 3.0  # home -> orders_list
    raw_matrix[1, 2] += 4.0  # orders_list -> order_detail
    raw_matrix[2, 3] += 5.0  # order_detail -> navigation
    raw_matrix[3, 0] += 3.0  # navigation -> home
    # Normalize each row
    row_sums = raw_matrix.sum(axis=1, keepdims=True)
    transition_matrix = raw_matrix / row_sums

    return RiderPersona(
        rider_id=rider_id,
        display_name=display_name,
        phone_number=phone_number,
        home_city=home_city,
        zones=selected_zones,
        zone_coords=zone_coords,
        primary_device=primary_device,
        asns=chosen_asns,
        shift_pattern=shift_pattern,
        face_id=face_id,
        face_embedding=face_embedding,
        encrypted_face_embedding=encrypted_face,
        face_embedding_hash=face_embedding_hash,
        payout_account=payout_account,
        metric_params=metric_params,
        screen_transitions=transition_matrix,
    )
