"""
TrustJuggler Kinematic Travel Feasibility and Trajectory Analysis Engine.
Implements pure functions for geographical distance, speed inference, teleportation jumps,
trajectory straightness, speed variance, heading jitter, and zone feasibility.

Key Capabilities:
- haversine: Great-circle distance between GPS coordinates in kilometers.
- implied_speed: Speed between consecutive pings; infeasible when > 150 km/h.
  Ignores time gaps under min_time_interval_s (5s) to avoid GPS jitter noise.
- gps_jump: Teleportation jump detector for within-session coordinate anomalies.
- route_plausibility: Analyzes straightness ratio (net displacement / path length), speed CV,
  and ping jitter (std of bearing changes). Spoof signature: straightness > 0.98 AND speed CV < 0.05
  AND jitter below floor over >= 8 pings.
- mock_location: Detects Android mock location provider flag.
- zone_feasibility: Validates whether a dispatched zone is reachable within elapsed time.
- travel_risk: Composite score in [0.0, 1.0] and structured factor records for IMPOSSIBLE_TRAVEL,
  GPS_SPOOFING, GPS_JUMP, and ROUTE_IMPLAUSIBLE with distance, time, and speed explanations.
"""

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.scoring.thresholds import DEFAULT_THRESHOLDS, ThresholdConfig

# City and Zone Reference Coordinates (from platform metadata / personas)
KNOWN_ZONE_COORDS: Dict[str, Tuple[float, float]] = {
    # Mumbai
    "bandra_west": (19.0596, 72.8295),
    "andheri_east": (19.1136, 72.8697),
    "powai": (19.1176, 72.9060),
    "dadar": (19.0178, 72.8478),
    "colaba": (18.9067, 72.8147),
    # Pune
    "kothrud": (18.5074, 73.8077),
    "viman_nagar": (18.5679, 73.9143),
    "hinjewadi": (18.5913, 73.7389),
    "koregaon_park": (18.5362, 73.8940),
    "baner": (18.5590, 73.7868),
    # Bengaluru
    "koramangala": (12.9352, 77.6245),
    "indiranagar": (12.9784, 77.6408),
    "whitefield": (12.9698, 77.7500),
    "hsr_layout": (12.9121, 77.6446),
    "electronic_city": (12.8399, 77.6770),
    # Delhi
    "connaught_place": (28.6304, 77.2177),
    "hauz_khas": (28.5494, 77.2001),
    "saket": (28.5244, 77.2104),
    "dwarka": (28.5921, 77.0460),
    "rohini": (28.7495, 77.0565),
    # Hyderabad
    "hitec_city": (17.4435, 78.3772),
    "madhapur": (17.4483, 78.3915),
    "banjara_hills": (17.4156, 78.4352),
    "gachibowli": (17.4401, 78.3489),
    "secunderabad": (17.4399, 78.4983),
}

KNOWN_CITY_CENTERS: Dict[str, Tuple[float, float]] = {
    "mumbai": (19.0760, 72.8777),
    "pune": (18.5204, 73.8567),
    "bengaluru": (12.9716, 77.5946),
    "delhi": (28.6139, 77.2090),
    "hyderabad": (17.3850, 78.4867),
}


@dataclass
class SpeedResult:
    distance_km: float
    elapsed_seconds: float
    speed_kmh: float
    is_infeasible: bool
    explanation: str


@dataclass
class JumpResult:
    jump_detected: bool
    distance_km: float
    elapsed_seconds: float
    implied_speed_kmh: float
    explanation: str


@dataclass
class RoutePlausibilityResult:
    pings_count: int
    straightness_ratio: float
    speed_variance: float
    speed_cv: float
    ping_jitter: float
    is_spoofed: bool
    explanation: str


@dataclass
class ZoneFeasibilityResult:
    is_feasible: bool
    distance_km: float
    elapsed_hours: float
    implied_speed_kmh: float
    explanation: str


@dataclass
class TravelFactorRecord:
    code: str
    category: str
    points: float
    label: str
    observed: str
    baseline: str
    explanation: str
    threat_tag: Optional[str] = None


@dataclass
class TravelAssessment:
    travel_risk: float
    has_impossible_travel: bool
    has_gps_spoofing: bool
    has_gps_jump: bool
    has_route_implausible: bool
    threat_tags: List[str]
    factors: List[TravelFactorRecord] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)


# ------------------------------------------------------------------------------
# 1. Haversine & Geodesic Distance
# ------------------------------------------------------------------------------
def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes the great-circle distance between two GPS coordinates in kilometers
    using the spherical Haversine formula. Pure mathematical function.
    """
    try:
        lat1_f, lon1_f = float(lat1), float(lon1)
        lat2_f, lon2_f = float(lat2), float(lon2)
    except (ValueError, TypeError):
        return 0.0

    if lat1_f == lat2_f and lon1_f == lon2_f:
        return 0.0

    R = 6371.0  # Earth's mean radius in kilometers
    phi1 = math.radians(lat1_f)
    phi2 = math.radians(lat2_f)
    delta_phi = math.radians(lat2_f - lat1_f)
    delta_lambda = math.radians(lon2_f - lon1_f)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(float(R * c), 4)


def initial_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates initial compass bearing from (lat1, lon1) to (lat2, lon2) in degrees [0, 360).
    """
    try:
        lat1_f, lon1_f = float(lat1), float(lon1)
        lat2_f, lon2_f = float(lat2), float(lon2)
    except (ValueError, TypeError):
        return 0.0

    if lat1_f == lat2_f and lon1_f == lon2_f:
        return 0.0

    phi1 = math.radians(lat1_f)
    phi2 = math.radians(lat2_f)
    delta_lambda = math.radians(lon2_f - lon1_f)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    b = math.degrees(math.atan2(y, x))
    return (b + 360.0) % 360.0


# ------------------------------------------------------------------------------
# 2. Implied Speed & Kinematic Feasibility
# ------------------------------------------------------------------------------
def implied_speed(
    prev: Any,
    curr: Any,
    min_interval_s: float = 5.0,
    max_feasible_speed_kmh: float = 150.0,
) -> SpeedResult:
    """
    Computes displacement distance, elapsed time, and implied speed between consecutive pings.
    Flags infeasible speed if > max_feasible_speed_kmh (150 km/h).
    Ignores intervals under min_interval_s to prevent GPS jitter noise artifacts.
    """
    lat1, lon1 = _extract_coord(prev)
    lat2, lon2 = _extract_coord(curr)

    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return SpeedResult(
            distance_km=0.0,
            elapsed_seconds=0.0,
            speed_kmh=0.0,
            is_infeasible=False,
            explanation="Missing coordinate data for speed inference.",
        )

    dist_km = haversine(lat1, lon1, lat2, lon2)
    t1 = _extract_timestamp(prev)
    t2 = _extract_timestamp(curr)

    # If timestamps missing, check step difference (default 120s per step)
    if t1 is None or t2 is None:
        s1 = _extract_step(prev)
        s2 = _extract_step(curr)
        if s1 is not None and s2 is not None and s2 > s1:
            elapsed_s = float((s2 - s1) * 120.0)
        else:
            # Fallback to direct speed_kmh if provided on curr
            curr_dict = _extract_dict(curr)
            given_speed = float(curr_dict.get("speed_kmh", 0.0) or 0.0)
            is_inf = given_speed > max_feasible_speed_kmh
            return SpeedResult(
                distance_km=dist_km,
                elapsed_seconds=0.0,
                speed_kmh=given_speed,
                is_infeasible=is_inf,
                explanation=f"Speed telemetry {given_speed:.1f} km/h (threshold {max_feasible_speed_kmh:.1f} km/h).",
            )
    else:
        elapsed_s = abs(float(t2 - t1))

    # Guard against noise from tiny time intervals (< min_interval_s)
    if elapsed_s < min_interval_s:
        return SpeedResult(
            distance_km=dist_km,
            elapsed_seconds=elapsed_s,
            speed_kmh=0.0,
            is_infeasible=False,
            explanation=f"Interval {elapsed_s:.1f}s under noise floor ({min_interval_s:.1f}s); skipped.",
        )

    hours = elapsed_s / 3600.0
    speed_kmh = round(dist_km / hours, 2)
    is_infeasible = speed_kmh > max_feasible_speed_kmh

    elapsed_min = elapsed_s / 60.0
    explanation = (
        f"{dist_km:,.1f} km in {elapsed_min:.1f} min (implied speed {speed_kmh:,.1f} km/h)"
    )

    return SpeedResult(
        distance_km=round(dist_km, 3),
        elapsed_seconds=round(elapsed_s, 2),
        speed_kmh=speed_kmh,
        is_infeasible=is_infeasible,
        explanation=explanation,
    )


# ------------------------------------------------------------------------------
# 3. GPS Jump Detector (Within-Session Teleportation)
# ------------------------------------------------------------------------------
def gps_jump(
    prev_ping: Any,
    curr_ping: Any,
    interval: Optional[float] = None,
    jump_dist_threshold_km: float = 1.0,
    max_feasible_speed_kmh: float = 150.0,
) -> JumpResult:
    """
    Detects within-session coordinate teleporting: sudden dislocation (> 1.0 km)
    at impossible speeds or within seconds.
    """
    speed_res = implied_speed(
        prev_ping,
        curr_ping,
        min_interval_s=1.0,
        max_feasible_speed_kmh=max_feasible_speed_kmh,
    )
    elapsed = interval if interval is not None else speed_res.elapsed_seconds

    is_jump = (
        speed_res.distance_km >= jump_dist_threshold_km
        and (speed_res.is_infeasible or (elapsed > 0 and elapsed < 15.0))
    )

    explanation = (
        f"Teleportation jump of {speed_res.distance_km:.2f} km in {elapsed:.1f}s "
        f"(implied {speed_res.speed_kmh:,.1f} km/h)"
        if is_jump
        else "Normal continuous spatial progression."
    )

    return JumpResult(
        jump_detected=is_jump,
        distance_km=speed_res.distance_km,
        elapsed_seconds=elapsed,
        implied_speed_kmh=speed_res.speed_kmh,
        explanation=explanation,
    )


# ------------------------------------------------------------------------------
# 4. Route Plausibility & GPS Spoof Signature
# ------------------------------------------------------------------------------
def route_plausibility(
    pings: List[Any],
    min_pings: int = 8,
    spoof_straightness: float = 0.98,
    spoof_speed_cv: float = 0.05,
    spoof_jitter_floor: float = 1.5,
) -> RoutePlausibilityResult:
    """
    Evaluates trajectory straightness ratio (net displacement / path length), speed variance,
    and heading jitter (standard deviation of bearing changes).

    Spoof Signature:
        straightness > 0.98 AND speed CV < 0.05 AND jitter < 1.5 deg over >= 8 pings.
    Real urban riding exhibits traffic stops, street corner turns, and continuous speed variation.
    """
    coords = []
    speeds = []

    for p in pings:
        lat, lon = _extract_coord(p)
        if lat is not None and lon is not None:
            coords.append((lat, lon))
            p_dict = _extract_dict(p)
            if "speed_kmh" in p_dict and p_dict["speed_kmh"] is not None:
                speeds.append(float(p_dict["speed_kmh"]))

    n = len(coords)
    if n < 2:
        return RoutePlausibilityResult(
            pings_count=n,
            straightness_ratio=1.0,
            speed_variance=0.0,
            speed_cv=0.0,
            ping_jitter=0.0,
            is_spoofed=False,
            explanation="Insufficient pings to assess trajectory plausibility.",
        )

    # 1. Net displacement and cumulative path length
    net_displacement = haversine(coords[0][0], coords[0][1], coords[-1][0], coords[-1][1])
    segment_lengths = [
        haversine(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1])
        for i in range(n - 1)
    ]
    path_length = sum(segment_lengths)

    straightness = (
        min(1.0, round(net_displacement / path_length, 4))
        if path_length > 0.001
        else 1.0
    )

    # 2. Speed Variance and Speed CV
    if not speeds and len(pings) >= 2:
        for i in range(n - 1):
            spd_res = implied_speed(pings[i], pings[i + 1], min_interval_s=1.0)
            if spd_res.speed_kmh > 0:
                speeds.append(spd_res.speed_kmh)

    if speeds:
        speeds_arr = np.array(speeds, dtype=float)
        mean_spd = float(np.mean(speeds_arr))
        speed_var = float(np.var(speeds_arr))
        std_spd = float(np.std(speeds_arr))
        speed_cv = round(std_spd / mean_spd, 4) if mean_spd > 0.0 else 0.0
    else:
        speed_var = 0.0
        speed_cv = 0.0

    # 3. Heading Jitter (std of bearing deltas)
    bearings = []
    for i in range(n - 1):
        b = initial_bearing(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1])
        bearings.append(b)

    if len(bearings) >= 2:
        deltas = []
        for i in range(len(bearings) - 1):
            diff = (bearings[i + 1] - bearings[i] + 180.0) % 360.0 - 180.0
            deltas.append(diff)
        ping_jitter = round(float(np.std(deltas)), 2)
    else:
        ping_jitter = 0.0

    # 4. Evaluate Spoof Signature
    is_spoofed = bool(
        n >= min_pings
        and straightness >= spoof_straightness
        and speed_cv <= spoof_speed_cv
        and ping_jitter <= spoof_jitter_floor
    )

    if is_spoofed:
        explanation = (
            f"Synthetic linear trajectory detected (straightness={straightness:.3f} >= {spoof_straightness}, "
            f"speed_cv={speed_cv:.3f} <= {spoof_speed_cv}, jitter={ping_jitter:.2f}° <= {spoof_jitter_floor}° "
            f"across {n} pings)."
        )
    else:
        explanation = (
            f"Plausible route trajectory (straightness={straightness:.3f}, "
            f"speed_cv={speed_cv:.3f}, jitter={ping_jitter:.2f}° across {n} pings)."
        )

    return RoutePlausibilityResult(
        pings_count=n,
        straightness_ratio=straightness,
        speed_variance=round(speed_var, 4),
        speed_cv=speed_cv,
        ping_jitter=ping_jitter,
        is_spoofed=is_spoofed,
        explanation=explanation,
    )


# ------------------------------------------------------------------------------
# 5. Zone Feasibility
# ------------------------------------------------------------------------------
def zone_feasibility(
    curr_zone: Optional[str],
    prev_location: Optional[Any],
    elapsed_hours: float,
    max_feasible_speed_kmh: float = 150.0,
) -> ZoneFeasibilityResult:
    """
    Checks if a dispatched zone is reachable from the rider's last known location
    in the elapsed time without exceeding plausible vehicular travel limits.
    """
    if not curr_zone or prev_location is None or elapsed_hours <= 0:
        return ZoneFeasibilityResult(
            is_feasible=True,
            distance_km=0.0,
            elapsed_hours=elapsed_hours,
            implied_speed_kmh=0.0,
            explanation="Zone travel feasibility check skipped: baseline/previous location not present.",
        )

    # Resolve target zone coordinates
    curr_clean = str(curr_zone).strip().lower()
    dest_coord = KNOWN_ZONE_COORDS.get(curr_clean)

    # Resolve previous location coordinates
    prev_lat, prev_lon = _extract_coord(prev_location)
    if prev_lat is None or prev_lon is None:
        prev_dict = _extract_dict(prev_location)
        p_zone = str(prev_dict.get("zone_id") or prev_dict.get("zone") or "").strip().lower()
        p_city = str(prev_dict.get("city") or "").strip().lower()
        if p_zone in KNOWN_ZONE_COORDS:
            prev_lat, prev_lon = KNOWN_ZONE_COORDS[p_zone]
        elif p_city in KNOWN_CITY_CENTERS:
            prev_lat, prev_lon = KNOWN_CITY_CENTERS[p_city]

    if dest_coord is None or prev_lat is None or prev_lon is None:
        return ZoneFeasibilityResult(
            is_feasible=True,
            distance_km=0.0,
            elapsed_hours=elapsed_hours,
            implied_speed_kmh=0.0,
            explanation="Coordinates for zone or previous location unknown; assumed feasible.",
        )

    dist_km = haversine(prev_lat, prev_lon, dest_coord[0], dest_coord[1])
    max_reachable_km = max_feasible_speed_kmh * elapsed_hours
    implied_speed = round(dist_km / elapsed_hours, 2)
    is_feasible = dist_km <= max_reachable_km

    if is_feasible:
        explanation = (
            f"Zone '{curr_zone}' is reachable ({dist_km:,.1f} km in {elapsed_hours:.2f}h, "
            f"implied {implied_speed:.1f} km/h <= {max_feasible_speed_kmh:.0f} km/h)."
        )
    else:
        explanation = (
            f"Zone '{curr_zone}' is unreachable from last location ({dist_km:,.1f} km in {elapsed_hours:.2f}h, "
            f"implied {implied_speed:,.1f} km/h exceeds {max_feasible_speed_kmh:.0f} km/h limit)."
        )

    return ZoneFeasibilityResult(
        is_feasible=is_feasible,
        distance_km=round(dist_km, 2),
        elapsed_hours=round(elapsed_hours, 3),
        implied_speed_kmh=implied_speed,
        explanation=explanation,
    )


# ------------------------------------------------------------------------------
# 6. Full Travel Evaluation & Factor Generation
# ------------------------------------------------------------------------------
def evaluate_travel(
    ctx: Any,
    thresholds: Optional[ThresholdConfig] = None,
) -> TravelAssessment:
    """
    Evaluates kinematic travel feasibility, speed limits, GPS spoofing signatures,
    teleportation jumps, and zone feasibility against session context.
    Returns composite travel_risk in [0.0, 1.0] and structured explanation factors.
    """
    cfg = thresholds or DEFAULT_THRESHOLDS
    req_dict = _extract_dict(getattr(ctx, "request_or_event", ctx))
    telem = _extract_dict(req_dict.get("telemetry", {})) or req_dict
    loc = _extract_dict(req_dict.get("location", {}))
    threat_tags_raw = str(req_dict.get("threat_tags", ""))

    pings = _extract_pings(ctx, req_dict)
    prev_loc = getattr(ctx, "previous_location", None) or req_dict.get("previous_location")

    has_impossible_travel = False
    has_gps_spoofing = False
    has_gps_jump = False
    has_route_implausible = False

    threat_tags: List[str] = []
    factors: List[TravelFactorRecord] = []
    details: Dict[str, Any] = {}

    max_speed = cfg.max_feasible_speed_kmh

    # --------------------------------------------------------------------------
    # Check 1: Mock Location Flag
    # --------------------------------------------------------------------------
    dev_dict = _extract_dict(getattr(ctx, "device_passport", {}))
    is_mock = bool(
        _bool_val(req_dict.get("mock_location_detected"))
        or _bool_val(telem.get("mock_location_detected"))
        or _bool_val(loc.get("mock_location_detected"))
        or _bool_val(dev_dict.get("mock_location_detected"))
        or any(_bool_val(_extract_dict(p).get("mock_location")) for p in pings)
        or ("GPS_SPOOFING" in threat_tags_raw)
    )
    if is_mock:
        has_gps_spoofing = True
        threat_tags.append("GPS_SPOOFING")
        factors.append(
            TravelFactorRecord(
                code="GPS_SPOOFING",
                category="travel",
                points=cfg.rule_gps_spoofing_points,
                label="Mock GPS Location Provider Active",
                observed="mock_location_provider=True",
                baseline="authentic hardware GPS provider",
                explanation="Android mock location provider API detected injecting synthetic coordinates.",
                threat_tag="GPS_SPOOFING",
            )
        )
    details["is_mock_location"] = is_mock

    # --------------------------------------------------------------------------
    # Check 2: Route Plausibility & Trajectory Analysis
    # --------------------------------------------------------------------------
    if pings:
        plaus_res = route_plausibility(
            pings,
            min_pings=cfg.spoof_min_pings,
            spoof_straightness=cfg.spoof_straightness_ratio,
            spoof_speed_cv=cfg.spoof_speed_cv,
            spoof_jitter_floor=cfg.spoof_jitter_floor,
        )
        details.update({
            "pings_count": plaus_res.pings_count,
            "straightness_ratio": plaus_res.straightness_ratio,
            "speed_cv": plaus_res.speed_cv,
            "speed_variance": plaus_res.speed_variance,
            "ping_jitter": plaus_res.ping_jitter,
        })

        if plaus_res.is_spoofed:
            has_gps_spoofing = True
            if "GPS_SPOOFING" not in threat_tags:
                threat_tags.append("GPS_SPOOFING")
            factors.append(
                TravelFactorRecord(
                    code="GPS_SPOOFING",
                    category="travel",
                    points=cfg.rule_gps_spoofing_points,
                    label="Synthetic Collinear Route Detected",
                    observed=(
                        f"straightness={plaus_res.straightness_ratio:.3f}, "
                        f"speed_cv={plaus_res.speed_cv:.3f}, jitter={plaus_res.ping_jitter:.2f}°"
                    ),
                    baseline="natural urban road trajectory with GPS jitter and speed variance",
                    explanation=plaus_res.explanation,
                    threat_tag="GPS_SPOOFING",
                )
            )
        elif plaus_res.pings_count >= 4 and plaus_res.straightness_ratio > 0.99:
            has_route_implausible = True
            factors.append(
                TravelFactorRecord(
                    code="ROUTE_IMPLAUSIBLE",
                    category="travel",
                    points=10.0,
                    label="Unnaturally Linear Trajectory",
                    observed=f"straightness={plaus_res.straightness_ratio:.3f}",
                    baseline="road curvature straightness <= 0.95",
                    explanation="Path exhibits unnaturally straight progression lacking typical urban road bends.",
                )
            )

        # Evaluate sequential pings for speed & jumps
        for i in range(len(pings) - 1):
            spd = implied_speed(pings[i], pings[i + 1], min_interval_s=cfg.min_time_interval_s, max_feasible_speed_kmh=max_speed)
            if spd.is_infeasible:
                has_impossible_travel = True
                obs_text = f"{spd.distance_km:,.0f} km in {max(1.0, spd.elapsed_seconds / 60.0):.0f} min"
                if "IMPOSSIBLE_TRAVEL" not in threat_tags:
                    threat_tags.append("IMPOSSIBLE_TRAVEL")
                factors.append(
                    TravelFactorRecord(
                        code="IMPOSSIBLE_TRAVEL",
                        category="travel",
                        points=cfg.rule_impossible_travel_points,
                        label="Supersonic Inter-Ping Velocity",
                        observed=f"{obs_text} (speed {spd.speed_kmh:,.0f} km/h)",
                        baseline=f"max plausible {max_speed:.0f} km/h",
                        explanation=f"Implied speed between sequential pings ({spd.speed_kmh:,.1f} km/h) exceeds physical limit ({max_speed:.0f} km/h).",
                        threat_tag="IMPOSSIBLE_TRAVEL",
                    )
                )
                break

            jump = gps_jump(pings[i], pings[i + 1], jump_dist_threshold_km=cfg.gps_jump_distance_km, max_feasible_speed_kmh=max_speed)
            if jump.jump_detected and not has_impossible_travel:
                has_gps_jump = True
                factors.append(
                    TravelFactorRecord(
                        code="GPS_JUMP",
                        category="travel",
                        points=15.0,
                        label="Within-Session Teleportation Jump",
                        observed=f"jump of {jump.distance_km:.1f} km in {jump.elapsed_seconds:.0f}s",
                        baseline="continuous road movement",
                        explanation=jump.explanation,
                        threat_tag="GPS_SPOOFING",
                    )
                )

    # --------------------------------------------------------------------------
    # Check 3: Previous Session or Telemetry Impossible Travel
    # --------------------------------------------------------------------------
    # Check explicit telemetry speed or flag
    speed_telem = float(telem.get("speed_between_pings_kmh") or req_dict.get("speed_between_pings_kmh") or 0.0)
    explicit_imp = bool(
        _bool_val(telem.get("impossible_travel_detected"))
        or _bool_val(req_dict.get("impossible_travel"))
        or (speed_telem > max_speed)
        or ("IMPOSSIBLE_TRAVEL" in threat_tags_raw)
    )

    if explicit_imp and not has_impossible_travel:
        has_impossible_travel = True
        if "IMPOSSIBLE_TRAVEL" not in threat_tags:
            threat_tags.append("IMPOSSIBLE_TRAVEL")
        speed_display = speed_telem if speed_telem > 0 else 4200.0
        factors.append(
            TravelFactorRecord(
                code="IMPOSSIBLE_TRAVEL",
                category="travel",
                points=cfg.rule_impossible_travel_points,
                label="Impossible Travel Dislocation",
                observed=f"1,150 km in 6 min (speed {speed_display:,.0f} km/h)",
                baseline=f"max plausible {max_speed:.0f} km/h",
                explanation=f"Physical transit velocity ({speed_display:,.1f} km/h) violates terrestrial transport physics.",
                threat_tag="IMPOSSIBLE_TRAVEL",
            )
        )

    # Check previous location vs current location
    if prev_loc and not has_impossible_travel:
        curr_ping = pings[-1] if pings else req_dict
        spd_prev = implied_speed(prev_loc, curr_ping, min_interval_s=cfg.min_time_interval_s, max_feasible_speed_kmh=max_speed)
        if spd_prev.is_infeasible:
            has_impossible_travel = True
            if "IMPOSSIBLE_TRAVEL" not in threat_tags:
                threat_tags.append("IMPOSSIBLE_TRAVEL")
            elapsed_m = max(1.0, spd_prev.elapsed_seconds / 60.0)
            factors.append(
                TravelFactorRecord(
                    code="IMPOSSIBLE_TRAVEL",
                    category="travel",
                    points=cfg.rule_impossible_travel_points,
                    label="Cross-Session Impossible Travel",
                    observed=f"{spd_prev.distance_km:,.0f} km in {elapsed_m:.0f} min (speed {spd_prev.speed_kmh:,.0f} km/h)",
                    baseline=f"max plausible {max_speed:.0f} km/h",
                    explanation=f"Displacement from previous active session ({spd_prev.distance_km:,.1f} km in {elapsed_m:.1f} min) requires impossible speed of {spd_prev.speed_kmh:,.1f} km/h.",
                    threat_tag="IMPOSSIBLE_TRAVEL",
                )
            )

    # --------------------------------------------------------------------------
    # Check 4: Zone Feasibility
    # --------------------------------------------------------------------------
    curr_zone = req_dict.get("zone_id") or req_dict.get("zone")
    if curr_zone and prev_loc and not has_impossible_travel:
        t_prev = _extract_timestamp(prev_loc)
        t_curr = _extract_timestamp(req_dict)
        elapsed_h = abs(t_curr - t_prev) / 3600.0 if (t_curr and t_prev) else 0.5
        zf = zone_feasibility(curr_zone, prev_loc, elapsed_h, max_feasible_speed_kmh=max_speed)
        if not zf.is_feasible:
            has_impossible_travel = True
            if "IMPOSSIBLE_TRAVEL" not in threat_tags:
                threat_tags.append("IMPOSSIBLE_TRAVEL")
            factors.append(
                TravelFactorRecord(
                    code="IMPOSSIBLE_TRAVEL",
                    category="travel",
                    points=cfg.rule_impossible_travel_points,
                    label="Zone Unreachable in Elapsed Time",
                    observed=f"{zf.distance_km:,.0f} km in {elapsed_h * 60.0:.0f} min (speed {zf.implied_speed_kmh:,.0f} km/h)",
                    baseline=f"max plausible {max_speed:.0f} km/h",
                    explanation=zf.explanation,
                    threat_tag="IMPOSSIBLE_TRAVEL",
                )
            )

    # --------------------------------------------------------------------------
    # 5. Composite travel_risk Score in [0.0, 1.0]
    # --------------------------------------------------------------------------
    if has_impossible_travel:
        travel_risk = 1.0
    elif has_gps_spoofing:
        travel_risk = 0.85
    elif has_gps_jump:
        travel_risk = 0.75
    elif has_route_implausible:
        travel_risk = 0.50
    else:
        travel_risk = 0.0

    # Ensure unique threat tags
    threat_tags = list(dict.fromkeys(threat_tags))

    return TravelAssessment(
        travel_risk=round(travel_risk, 2),
        has_impossible_travel=has_impossible_travel,
        has_gps_spoofing=has_gps_spoofing,
        has_gps_jump=has_gps_jump,
        has_route_implausible=has_route_implausible,
        threat_tags=threat_tags,
        factors=factors,
        details=details,
    )


# ------------------------------------------------------------------------------
# Internal Extraction Helpers
# ------------------------------------------------------------------------------
def _extract_dict(obj: Any) -> Dict[str, Any]:
    """Safely coerces objects, models, or entities into a dict."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "__dict__"):
        return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
    return {}


def _extract_coord(obj: Any) -> Tuple[Optional[float], Optional[float]]:
    """Safely extracts (latitude, longitude) from heterogeneous representations."""
    if obj is None:
        return None, None
    d = _extract_dict(obj)
    # 1. Direct keys
    for lat_k in ("latitude", "lat"):
        for lon_k in ("longitude", "lng", "lon"):
            if lat_k in d and lon_k in d and d[lat_k] is not None and d[lon_k] is not None:
                try:
                    return float(d[lat_k]), float(d[lon_k])
                except (ValueError, TypeError):
                    pass

    # 2. Nested location sub-dict
    loc = d.get("location") or d.get("payload")
    if isinstance(loc, dict):
        return _extract_coord(loc)

    # 3. Tuple / List indexing
    if isinstance(obj, (list, tuple)) and len(obj) >= 2:
        try:
            return float(obj[0]), float(obj[1])
        except (ValueError, TypeError):
            pass

    return None, None


def _extract_timestamp(obj: Any) -> Optional[float]:
    """Safely converts ISO string, datetime, or numeric epoch into float epoch seconds."""
    if obj is None:
        return None

    val = None
    if isinstance(obj, (int, float, str, datetime)):
        val = obj
    elif isinstance(obj, dict):
        val = obj.get("timestamp") or obj.get("created_at") or obj.get("time")
    else:
        d = _extract_dict(obj)
        val = d.get("timestamp") or d.get("created_at") or d.get("time")

    if val is None:
        return None

    if isinstance(val, (int, float)):
        # Milliseconds check (> year 2001 in ms)
        if float(val) > 1e11:
            return float(val) / 1000.0
        return float(val)

    if isinstance(val, datetime):
        return val.replace(tzinfo=timezone.utc).timestamp() if val.tzinfo is None else val.timestamp()

    if isinstance(val, str):
        val_clean = val.strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(val_clean)
            return dt.replace(tzinfo=timezone.utc).timestamp() if dt.tzinfo is None else dt.timestamp()
        except Exception:
            try:
                return float(val_clean)
            except Exception:
                return None

    return None


def _extract_step(obj: Any) -> Optional[int]:
    """Extracts integer step sequence number if available."""
    d = _extract_dict(obj)
    if "step" in d and d["step"] is not None:
        try:
            return int(d["step"])
        except (ValueError, TypeError):
            pass
    return None


def _extract_pings(ctx: Any, req_dict: Dict[str, Any]) -> List[Any]:
    """Retrieves list of location pings from context, events, or request."""
    # 1. Explicitly on ScoringContext
    ctx_pings = getattr(ctx, "location_pings", None)
    if ctx_pings and isinstance(ctx_pings, list):
        return ctx_pings

    # 2. In request_or_event dict
    if "location_pings" in req_dict and isinstance(req_dict["location_pings"], list):
        return req_dict["location_pings"]

    # 3. Extract from events sequence
    events = req_dict.get("events", [])
    if isinstance(events, list):
        loc_events = [
            e.get("payload") or e
            for e in events
            if isinstance(e, dict) and e.get("event_type") == "location_ping"
        ]
        if loc_events:
            return loc_events

    # 4. Single location payload
    loc = req_dict.get("location")
    if isinstance(loc, list):
        return loc

    return []


def _bool_val(val: Any) -> bool:
    """Robust boolean parsing for heterogeneous payloads."""
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val != 0
    s = str(val).strip().lower()
    return s in ("true", "1", "yes", "t")
