"""
TrustJuggler Baseline Computation Module.
Exposes compute_baseline() shared across simulator seeding, baseline_service, and scoring.
Calculates median and MAD (Median Absolute Deviation) for all 10 behavior metrics,
alongside zone, hour, and navigation transition profiles.
"""

from typing import Any, Dict, List

import numpy as np

METRIC_NAMES = [
    "tap_interval_ms",
    "typing_cps",
    "swipe_velocity_px_s",
    "interaction_timing_cv",
    "nav_path_similarity",
    "accept_latency_s",
    "shift_hour_dist",
    "avg_speed_kmh",
    "route_adherence",
    "trip_cadence_per_hr",
]

DEFAULT_METRIC_BOUNDS = {
    "tap_interval_ms": (120.0, 260.0),
    "typing_cps": (2.5, 6.5),
    "swipe_velocity_px_s": (600.0, 1600.0),
    "interaction_timing_cv": (0.15, 0.50),
    "nav_path_similarity": (0.70, 0.95),
    "accept_latency_s": (2.0, 14.0),
    "shift_hour_dist": (0.0, 8.0),
    "avg_speed_kmh": (15.0, 38.0),
    "route_adherence": (0.70, 0.97),
    "trip_cadence_per_hr": (1.2, 4.0),
}


def compute_baseline(sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes rider baseline statistics from a sequence of historical normal sessions.

    Returns:
        Dict containing:
        - metrics: Dict mapping metric_name -> {"median": float, "mad": float}
        - home_lat: float (median latitude)
        - home_lng: float (median longitude)
        - typical_hours: str (e.g., '09:00 - 18:00')
        - zone_profile: Dict mapping zone -> frequency
        - hour_profile: Dict containing mean, sd, and peak shift hours
        - nav_profile: Dict containing screen transition frequencies
        - sessions_count: int
    """
    if not sessions:
        # Fallback defaults
        default_metrics = {}
        for m, (low, high) in DEFAULT_METRIC_BOUNDS.items():
            mid = (low + high) / 2.0
            default_metrics[m] = {"median": round(mid, 3), "mad": round((high - low) * 0.1, 3)}
        return {
            "metrics": default_metrics,
            "home_lat": 19.0760,
            "home_lng": 72.8777,
            "typical_hours": "09:00 - 18:00",
            "zone_profile": {},
            "hour_profile": {"mean": 11.0, "sd": 2.0},
            "nav_profile": {},
            "sessions_count": 0,
        }

    # Extract metric values
    metric_values: Dict[str, List[float]] = {m: [] for m in METRIC_NAMES}
    lats: List[float] = []
    lngs: List[float] = []
    start_hours: List[float] = []
    zones: List[str] = []
    nav_transitions: Dict[str, int] = {}

    for s in sessions:
        # Check biometrics / telemetry or top-level keys
        biometrics = s.get("biometrics") or {}
        telemetry = s.get("telemetry") or {}
        loc = s.get("location") or {}

        for m in METRIC_NAMES:
            val = None
            if m in s:
                val = s[m]
            elif m in biometrics:
                val = biometrics[m]
            elif m in telemetry:
                val = telemetry[m]

            if val is not None and isinstance(val, (int, float)) and not np.isnan(val):
                metric_values[m].append(float(val))

        # Spatial
        lat = loc.get("latitude") or loc.get("lat") or s.get("latitude") or s.get("lat")
        lng = loc.get("longitude") or loc.get("lng") or s.get("longitude") or s.get("lng")
        if lat is not None and not np.isnan(lat):
            lats.append(float(lat))
        if lng is not None and not np.isnan(lng):
            lngs.append(float(lng))

        zone = s.get("zone_id") or loc.get("zone_id")
        if zone:
            zones.append(str(zone))

        # Temporal
        hour = s.get("start_hour")
        if hour is not None:
            start_hours.append(float(hour))

        # Navigation
        transitions = s.get("nav_transitions") or {}
        for trans, count in transitions.items():
            nav_transitions[trans] = nav_transitions.get(trans, 0) + count

    # Compute median and MAD for each metric
    metrics_summary: Dict[str, Dict[str, float]] = {}
    for m in METRIC_NAMES:
        vals = metric_values[m]
        if vals:
            arr = np.array(vals, dtype=np.float64)
            med = float(np.median(arr))
            # MAD = median(|x - median(x)|)
            mad = float(np.median(np.abs(arr - med)))
            # Minimum MAD floor to avoid division by zero in robust z-score
            mad_floor = max(1e-4, (DEFAULT_METRIC_BOUNDS[m][1] - DEFAULT_METRIC_BOUNDS[m][0]) * 0.01)
            mad = max(mad, mad_floor)
            metrics_summary[m] = {
                "median": round(med, 4),
                "mad": round(mad, 4),
            }
        else:
            low, high = DEFAULT_METRIC_BOUNDS[m]
            mid = (low + high) / 2.0
            metrics_summary[m] = {
                "median": round(mid, 4),
                "mad": round(max(1e-4, (high - low) * 0.08), 4),
            }

    # Home location
    home_lat = round(float(np.median(lats)), 5) if lats else 19.0760
    home_lng = round(float(np.median(lngs)), 5) if lngs else 72.8777

    # Shift hour profile
    if start_hours:
        sh_arr = np.array(start_hours, dtype=np.float64)
        sh_mean = float(np.mean(sh_arr))
        sh_sd = float(np.std(sh_arr)) if len(sh_arr) > 1 else 1.5
        min_hr = int(max(0, np.floor(sh_mean - 2 * sh_sd)))
        max_hr = int(min(23, np.ceil(sh_mean + 8 + sh_sd)))
        typical_hours = f"{min_hr:02d}:00 - {max_hr:02d}:00"
        hour_profile = {
            "mean": round(sh_mean, 2),
            "sd": round(max(0.5, sh_sd), 2),
        }
    else:
        typical_hours = "09:00 - 18:00"
        hour_profile = {"mean": 10.0, "sd": 1.5}

    # Zone frequency profile
    zone_profile: Dict[str, float] = {}
    if zones:
        total_z = len(zones)
        for z in set(zones):
            zone_profile[z] = round(zones.count(z) / total_z, 4)

    # Nav transition profile (normalized)
    nav_profile: Dict[str, float] = {}
    total_nav = sum(nav_transitions.values())
    if total_nav > 0:
        for trans, cnt in nav_transitions.items():
            nav_profile[trans] = round(cnt / total_nav, 4)

    return {
        "metrics": metrics_summary,
        "home_lat": home_lat,
        "home_lng": home_lng,
        "typical_hours": typical_hours,
        "zone_profile": zone_profile,
        "hour_profile": hour_profile,
        "nav_profile": nav_profile,
        "sessions_count": len(sessions),
    }


def compute_robust_z(
    val: float,
    metric_name: str,
    baseline_metrics: Dict[str, Dict[str, float]],
    new_device: bool = False,
) -> float:
    """
    Computes robust z-score: |val - median| / (1.4826 * MAD).
    On a new device, tap/typing/swipe deviations are attenuated by 0.5x.
    """
    if metric_name not in baseline_metrics:
        return 0.0
    bm = baseline_metrics[metric_name]
    med = bm.get("median", 0.0)
    mad = bm.get("mad", 1.0)
    denom = max(1.4826 * mad, 1e-4)
    dev = abs(val - med) / denom

    # Attenuate touch/typing biometrics on new devices
    if new_device and metric_name in ("tap_interval_ms", "typing_cps", "swipe_velocity_px_s"):
        dev *= 0.5

    return round(float(dev), 4)
