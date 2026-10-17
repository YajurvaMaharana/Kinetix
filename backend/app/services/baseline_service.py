"""
TrustJuggler Baseline & Historical Context Service.
Provides:
1. load_baseline: fetches baseline from DB, parses metric distributions and behavioral profiles.
2. update_baseline: updates rolling 30 normal/ordinary_change sessions, recalculating median & MAD
   for all 10 metrics alongside zone/hour/nav profiles and usual cities/ASNs.
3. build_history_context: assembles geospatial velocity (impossible travel), concurrent device sessions,
   recent behavior deviations, and previous session risk for exponential smoothing.
"""

import json
import math
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.entities import (
    RiderBaseline,
    RiskAssessment,
    RiskFactor,
    SessionEvent,
    utcnow,
)
from app.models.entities import (
    Session as SessionModel,
)
from simulator.baseline import METRIC_NAMES, compute_baseline, compute_robust_z

__all__ = [
    "load_baseline",
    "update_baseline",
    "build_history_context",
    "haversine_distance",
    "compute_baseline",
    "compute_robust_z",
    "METRIC_NAMES",
]


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes the great-circle distance between two coordinates in kilometers
    using the Haversine formula.
    """
    if lat1 == lat2 and lon1 == lon2:
        return 0.0

    R = 6371.0  # Earth radius in kilometers
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(float(R * c), 3)


def load_baseline(db: Session, rider_id: str) -> Optional[Dict[str, Any]]:
    """
    Loads established behavioral baseline from RiderBaseline DB model.
    Returns None if baseline record is missing, empty, or below cold-start confidence
    so that downstream scoring properly triggers cold start defaults.
    """
    b_record = db.query(RiderBaseline).filter(RiderBaseline.rider_id == rider_id).first()
    if not b_record:
        return None

    # Parse metrics JSON
    metrics_dict: Dict[str, Any] = {}
    sessions_count = 0
    if b_record.metrics_json:
        try:
            parsed = json.loads(b_record.metrics_json)
            if isinstance(parsed, dict):
                metrics_dict = parsed.get("metrics", parsed)
                sessions_count = int(parsed.get("sessions_count", 0))
        except Exception:
            metrics_dict = {}

    # Parse profiles JSON
    profiles_dict: Dict[str, Any] = {}
    if b_record.profiles_json:
        try:
            parsed_prof = json.loads(b_record.profiles_json)
            if isinstance(parsed_prof, dict):
                profiles_dict = parsed_prof
        except Exception:
            profiles_dict = {}

    if not metrics_dict:
        # If no metric data stored, treat as cold start
        return None

    home_lat = float(b_record.home_lat or profiles_dict.get("home_lat", 19.0760))
    home_lng = float(b_record.home_lng or profiles_dict.get("home_lng", 72.8777))
    home_city = str(profiles_dict.get("home_city") or "mumbai").strip().lower()
    typical_hours = str(b_record.typical_hours or profiles_dict.get("typical_hours", "09:00 - 18:00"))

    zone_profile = profiles_dict.get("zone_profile", {})
    hour_profile = profiles_dict.get("hour_profile", {"mean": 11.0, "sd": 2.0})
    nav_profile = profiles_dict.get("nav_profile", {})
    usual_cities = profiles_dict.get("usual_cities", [home_city])
    asns = profiles_dict.get("asns", [])

    return {
        "metrics": metrics_dict,
        "sessions_count": sessions_count or len(profiles_dict.get("recent_sessions", [])),
        "home_lat": home_lat,
        "home_lng": home_lng,
        "home_city": home_city,
        "typical_hours": typical_hours,
        "zone_profile": zone_profile,
        "hour_profile": hour_profile,
        "nav_profile": nav_profile,
        "usual_cities": usual_cities,
        "asns": asns,
    }


def update_baseline(db: Session, rider_id: str, session_data: Dict[str, Any]) -> None:
    """
    Updates the rider baseline using a rolling window of the last 30 sessions.
    Recalculates median & MAD for all 10 metrics, alongside zone, hour, and nav profiles,
    and usual cities/ASNs.
    Only triggered on ordinary_change or benign approved transitions.
    """
    b_record = db.query(RiderBaseline).filter(RiderBaseline.rider_id == rider_id).first()
    if not b_record:
        b_record = RiderBaseline(
            id=f"base_{uuid.uuid4().hex[:8]}",
            rider_id=rider_id,
            avg_speed_kmh=35.0,
            avg_cadence_cpm=220.0,
            updated_at=utcnow(),
        )
        db.add(b_record)
        db.flush()

    # Load existing profile state
    profiles_dict: Dict[str, Any] = {}
    if b_record.profiles_json:
        try:
            parsed = json.loads(b_record.profiles_json)
            if isinstance(parsed, dict):
                profiles_dict = parsed
        except Exception:
            profiles_dict = {}

    recent_sessions: List[Dict[str, Any]] = profiles_dict.get("recent_sessions", [])

    # Flatten/clean session_data to ensure telemetry & biometrics keys exist
    cleaned_session: Dict[str, Any] = dict(session_data)
    if "biometrics" in session_data and isinstance(session_data["biometrics"], dict):
        cleaned_session.update(session_data["biometrics"])
    if "telemetry" in session_data and isinstance(session_data["telemetry"], dict):
        cleaned_session.update(session_data["telemetry"])
    if "location" in session_data and isinstance(session_data["location"], dict):
        loc = session_data["location"]
        cleaned_session["latitude"] = loc.get("latitude") or loc.get("lat")
        cleaned_session["longitude"] = loc.get("longitude") or loc.get("lng")
        if loc.get("zone_id"):
            cleaned_session["zone_id"] = loc.get("zone_id")
        if loc.get("city"):
            cleaned_session["city"] = loc.get("city")

    recent_sessions.append(cleaned_session)
    # Strictly maintain rolling last 30 sessions
    recent_sessions = recent_sessions[-30:]

    # Compute updated statistical baseline
    computed = compute_baseline(recent_sessions)

    # Accumulate usual cities and ASNs
    usual_cities = set(profiles_dict.get("usual_cities", []))
    city = cleaned_session.get("city") or cleaned_session.get("home_city")
    if city:
        usual_cities.add(str(city).strip().lower())
    if not usual_cities:
        usual_cities.add("mumbai")

    asns = set(profiles_dict.get("asns", []))
    asn = cleaned_session.get("asn")
    if asn:
        asns.add(str(asn).strip().upper())

    profiles_dict["recent_sessions"] = recent_sessions
    profiles_dict["zone_profile"] = computed.get("zone_profile", {})
    profiles_dict["hour_profile"] = computed.get("hour_profile", {})
    profiles_dict["nav_profile"] = computed.get("nav_profile", {})
    profiles_dict["usual_cities"] = list(usual_cities)
    profiles_dict["asns"] = list(asns)
    profiles_dict["home_lat"] = computed.get("home_lat", 19.0760)
    profiles_dict["home_lng"] = computed.get("home_lng", 72.8777)
    profiles_dict["home_city"] = list(usual_cities)[0]
    profiles_dict["typical_hours"] = computed.get("typical_hours", "09:00 - 18:00")

    metrics_payload = {
        "metrics": computed.get("metrics", {}),
        "sessions_count": len(recent_sessions),
    }

    # Persist updated values
    b_record.metrics_json = json.dumps(metrics_payload)
    b_record.profiles_json = json.dumps(profiles_dict)
    b_record.home_lat = computed.get("home_lat")
    b_record.home_lng = computed.get("home_lng")
    b_record.typical_hours = computed.get("typical_hours")

    # Update top-level summary metrics
    speed_metric = computed.get("metrics", {}).get("avg_speed_kmh", {})
    if "median" in speed_metric:
        b_record.avg_speed_kmh = float(speed_metric["median"])
    typing_metric = computed.get("metrics", {}).get("typing_cps", {})
    if "median" in typing_metric:
        b_record.avg_cadence_cpm = float(typing_metric["median"]) * 60.0

    b_record.updated_at = utcnow()
    db.flush()


def build_history_context(
    db: Session,
    rider_id: str,
    current_session: Optional[Any] = None,
    current_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Assembles contextual history signals required for multi-modal scoring:
    - previous_risk_score: latest assessment risk of the current session (or latest previous session)
    - travel features: last location, elapsed time, displacement speed, and impossible travel detection
    - concurrent sessions on disparate hardware
    - recent behavior deviation trajectory (for EWMA drift tracking)
    """
    req_dict = current_payload or {}
    prev_risk: Optional[float] = None

    # 1. Previous Risk for Smoothing:
    # Priority A: Latest assessment within the current session
    if current_session and hasattr(current_session, "id"):
        curr_assessment = (
            db.query(RiskAssessment)
            .filter(RiskAssessment.session_id == current_session.id)
            .order_by(RiskAssessment.created_at.desc())
            .first()
        )
        if curr_assessment:
            prev_risk = float(curr_assessment.risk_score)

    # Priority B: If starting a new session, latest assessment from prior session
    if prev_risk is None:
        prior_eval = (
            db.query(RiskAssessment)
            .join(SessionModel, RiskAssessment.session_id == SessionModel.id)
            .filter(SessionModel.rider_id == rider_id)
            .filter(SessionModel.id != (current_session.id if current_session else ""))
            .order_by(RiskAssessment.created_at.desc())
            .first()
        )
        if prior_eval:
            prev_risk = float(prior_eval.risk_score)

    # 2. Travel Features (Last location & impossible travel calculation)
    # Extract current location
    curr_loc = req_dict.get("location", {}) or req_dict
    curr_lat = curr_loc.get("latitude") or curr_loc.get("lat")
    curr_lng = curr_loc.get("longitude") or curr_loc.get("lng")
    curr_time = req_dict.get("timestamp") or utcnow()
    if isinstance(curr_time, str):
        try:
            curr_time = datetime.fromisoformat(curr_time)
        except Exception:
            curr_time = utcnow()

    last_loc_dict: Optional[Dict[str, Any]] = None
    speed_between_pings = 0.0
    impossible_travel = False

    # Find previous session or event with valid coordinates
    prev_events = (
        db.query(SessionEvent)
        .join(SessionModel, SessionEvent.session_id == SessionModel.id)
        .filter(SessionModel.rider_id == rider_id)
        .filter(SessionEvent.event_type.in_(["location_ping", "telemetry", "session_start"]))
        .order_by(SessionEvent.created_at.desc())
        .limit(10)
        .all()
    )

    prev_lat: Optional[float] = None
    prev_lng: Optional[float] = None
    prev_time: Optional[datetime] = None

    for ev in prev_events:
        try:
            p = json.loads(ev.payload_json)
            lat = p.get("latitude") or p.get("lat") or p.get("location", {}).get("lat")
            lng = p.get("longitude") or p.get("lng") or p.get("location", {}).get("lng")
            if lat is not None and lng is not None:
                prev_lat = float(lat)
                prev_lng = float(lng)
                prev_time = ev.created_at
                last_loc_dict = {"lat": prev_lat, "lng": prev_lng, "time": prev_time.isoformat()}
                break
        except Exception:
            continue

    if (
        curr_lat is not None
        and curr_lng is not None
        and prev_lat is not None
        and prev_lng is not None
        and prev_time is not None
    ):
        dist_km = haversine_distance(float(prev_lat), float(prev_lng), float(curr_lat), float(curr_lng))
        delta_sec = max(0.1, abs((curr_time - prev_time).total_seconds()))
        delta_hours = delta_sec / 3600.0
        speed_between_pings = round(dist_km / delta_hours, 1)

        # Impossible travel flagged if displacement speed exceeds commercial transit limits (>800 km/h)
        if speed_between_pings > 800.0 or (dist_km > 300.0 and delta_hours < 0.5):
            impossible_travel = True

    # 3. Concurrent Active Sessions on other devices
    concurrent_sessions_count = 0
    concurrent_session_detected = False

    curr_device_id = getattr(current_session, "device_id", None) if current_session else None
    active_query = (
        db.query(SessionModel)
        .filter(SessionModel.rider_id == rider_id)
        .filter(SessionModel.status.in_(["IN_PROGRESS", "CHALLENGED"]))
    )
    if current_session and hasattr(current_session, "id"):
        active_query = active_query.filter(SessionModel.id != current_session.id)

    active_sessions = active_query.all()
    for s in active_sessions:
        if curr_device_id and s.device_id and s.device_id != curr_device_id:
            concurrent_sessions_count += 1
            concurrent_session_detected = True
        elif not curr_device_id:
            concurrent_sessions_count += 1
            concurrent_session_detected = True

    # 4. Recent Behavior Deviations for EWMA drift
    recent_devs: List[float] = []
    recent_factors = (
        db.query(RiskFactor)
        .join(RiskAssessment, RiskFactor.assessment_id == RiskAssessment.id)
        .join(SessionModel, RiskAssessment.session_id == SessionModel.id)
        .filter(SessionModel.rider_id == rider_id)
        .filter(RiskFactor.name.ilike("%behavior%"))
        .order_by(RiskFactor.id.desc())
        .limit(10)
        .all()
    )
    for f in recent_factors:
        try:
            recent_devs.append(float(f.score) / 38.0)
        except Exception:
            continue

    return {
        "previous_risk_score": prev_risk,
        "last_location": last_loc_dict,
        "speed_between_pings_kmh": speed_between_pings,
        "impossible_travel_detected": impossible_travel,
        "concurrent_sessions_count": concurrent_sessions_count,
        "concurrent_session_detected": concurrent_session_detected,
        "recent_behavior_devs": recent_devs,
    }
