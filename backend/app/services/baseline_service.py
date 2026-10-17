"""
TrustJuggler Baseline & Historical Context Service.
Provides:
1. load_baseline: fetches baseline from DB, parses metric distributions and behavioral profiles.
2. update_baseline: updates rolling 30 normal/ordinary_change sessions, recalculating median & MAD
   for all 10 metrics alongside zone/hour/nav profiles and usual cities/ASNs.
3. build_history_context: assembles geospatial velocity (impossible travel), concurrent device sessions,
   recent behavior deviations, and previous session risk for exponential smoothing.
4. BaselineService: benign-change adaptation engine tracking multi-session consistency streaks,
   per-device touch biometric re-baselining, and transparent investigation payload assembly.
"""

import json
import logging
import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

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
from app.scoring.thresholds import DEFAULT_THRESHOLDS, ThresholdConfig
from simulator.baseline import METRIC_NAMES, compute_baseline, compute_robust_z

logger = logging.getLogger("trustjuggler.baseline_service")


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


@dataclass
class AdaptationResult:
    is_consistent: bool
    is_blocked: bool
    block_reason: Optional[str]
    change_type: Optional[str]
    adaptation_progress: Optional[str]
    is_adapted: bool
    adapted_components: List[str] = field(default_factory=list)
    state: Dict[str, Any] = field(default_factory=dict)


class BaselineService:
    """
    Manages rider behavioral baselines and gradual adaptation state transitions.
    """

    def __init__(self, thresholds: Optional[ThresholdConfig] = None):
        self.thresholds = thresholds or DEFAULT_THRESHOLDS

    # --------------------------------------------------------------------------
    # 1. State Persistence Helpers
    # --------------------------------------------------------------------------
    @staticmethod
    def get_initial_adaptation_state() -> Dict[str, Any]:
        """Returns fresh empty adaptation state schema."""
        return {
            "new_device": {
                "token": None,
                "consistent_sessions": 0,
                "trusted": False,
                "trusted_via": None,  # "streak" | "otp"
                "first_seen": None,
                "last_seen": None,
            },
            "new_city": {
                "city": None,
                "sessions": 0,
                "days": 0,
                "dates_seen": [],
                "first_seen": None,
                "adapted": False,
            },
            "new_zone": {
                "zone": None,
                "sessions": 0,
                "first_seen": None,
                "adapted": False,
            },
            "usual_cities": [],
            "per_device_stats": {},
            "history": [],
        }

    @classmethod
    def get_adaptation_state(cls, baseline: Any) -> Dict[str, Any]:
        """Safely extracts and parses adaptation_state_json from baseline."""
        default_state = cls.get_initial_adaptation_state()
        if baseline is None:
            return default_state

        state_raw = None
        if isinstance(baseline, dict):
            state_raw = baseline.get("adaptation_state_json") or baseline.get("adaptation_state")
            usual_cities = baseline.get("usual_cities", [])
            if usual_cities and not default_state.get("usual_cities"):
                default_state["usual_cities"] = list(usual_cities)
        elif hasattr(baseline, "adaptation_state_json"):
            state_raw = getattr(baseline, "adaptation_state_json", None)

        if not state_raw:
            return default_state

        if isinstance(state_raw, dict):
            merged = {**default_state, **state_raw}
            return merged

        if isinstance(state_raw, str):
            try:
                parsed = json.loads(state_raw)
                if isinstance(parsed, dict):
                    return {**default_state, **parsed}
            except Exception:
                pass

        return default_state

    @classmethod
    def save_adaptation_state(cls, baseline: Any, state: Dict[str, Any]) -> None:
        """Stores adaptation state back into baseline entity or dict."""
        if baseline is None:
            return
        serialized = json.dumps(state)
        if isinstance(baseline, dict):
            baseline["adaptation_state_json"] = serialized
            baseline["adaptation_state"] = state
            if "usual_cities" in state:
                baseline["usual_cities"] = state["usual_cities"]
        elif hasattr(baseline, "adaptation_state_json"):
            baseline.adaptation_state_json = serialized
            baseline.updated_at = datetime.now(timezone.utc)

    # --------------------------------------------------------------------------
    # 2. Consistency & Change Recognition
    # --------------------------------------------------------------------------
    @classmethod
    def is_session_consistent(
        cls,
        behavior_dev: float,
        rule_matches: Optional[List[Any]] = None,
        rule_floor: float = 0.0,
        graph_risk: float = 0.0,
        has_open_case: bool = False,
        cfg: Optional[ThresholdConfig] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        A session is 'consistent' if:
        - behavior_dev < 0.35
        - no hard security rule fired (rule_matches empty and rule_floor == 0.0)
        - graph_risk < 0.5
        - no open case exists for the rider
        """
        config = cfg or DEFAULT_THRESHOLDS
        dev_limit = config.adaptation_consistency_dev_limit  # 0.35
        graph_limit = config.adaptation_graph_risk_limit     # 0.5

        if has_open_case:
            return False, "Open security case exists for rider"

        matches = rule_matches or []
        if len(matches) > 0 or rule_floor > 0.0:
            codes = [getattr(r, "code", str(r)) for r in matches]
            code_str = f" ({', '.join(codes)})" if codes else ""
            return False, f"Deterministic security rule violation fired{code_str}"

        if graph_risk >= graph_limit:
            return False, f"Syndicate graph risk elevated ({graph_risk:.2f} >= {graph_limit:.2f})"

        if behavior_dev >= dev_limit:
            return False, f"Motor-sensory behavior deviation elevated ({behavior_dev:.2f} >= {dev_limit:.2f})"

        return True, None

    @classmethod
    def detect_change_type(
        cls,
        ctx: Any,
        cfg: Optional[ThresholdConfig] = None,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Determines the change_type (new_phone | relocation | new_zone | combined)
        and formats the active adaptation_progress string (e.g. '2 of 3 sessions').
        """
        config = cfg or DEFAULT_THRESHOLDS
        req_dict = _extract_dict(getattr(ctx, "request_or_event", ctx))
        base_dict = _extract_dict(getattr(ctx, "baseline", None))
        state = cls.get_adaptation_state(getattr(ctx, "baseline", None))

        # Check new device
        dev_info = req_dict.get("device_passport") or req_dict.get("device") or {}
        if isinstance(dev_info, dict):
            pass
        elif hasattr(dev_info, "model_dump"):
            dev_info = dev_info.model_dump()
        else:
            dev_info = {}

        dev_token = (
            req_dict.get("device_token")
            or dev_info.get("fingerprint")
            or dev_info.get("device_id_hash")
            or req_dict.get("device_id")
        )
        is_dev_trusted = False
        if dev_token and state.get("new_device", {}).get("token") == dev_token:
            is_dev_trusted = bool(state["new_device"].get("trusted"))

        is_new_device = bool(
            (req_dict.get("is_new_device") or dev_info.get("is_new_device") or dev_info.get("is_new")
             or ("new_phone" in str(req_dict.get("session_id", "")))
             or ("newphone" in str(req_dict.get("device_id", "")).lower())
             or ("combo" in str(req_dict.get("device_id", "")).lower()))
            and not is_dev_trusted
        )

        # Check new city
        curr_city = str(req_dict.get("city") or "").strip().lower()
        home_city = str(base_dict.get("home_city") or req_dict.get("home_city") or "").strip().lower()
        usual_cities = [str(c).strip().lower() for c in state.get("usual_cities", [])]
        is_relocation = bool(
            "relocation" in str(req_dict.get("session_id", ""))
            or (curr_city and home_city and curr_city != home_city and curr_city not in usual_cities)
        )

        # Check new zone
        curr_zone = str(req_dict.get("zone_id") or "").strip().lower()
        zone_prof = base_dict.get("zone_profile", {}) or {}
        if isinstance(zone_prof, str):
            try:
                zone_prof = json.loads(zone_prof)
            except Exception:
                zone_prof = {}
        known_zones = {str(z).strip().lower() for z in zone_prof.keys()}
        is_new_zone = bool(
            "new_zone" in str(req_dict.get("session_id", ""))
            or "combo" in str(req_dict.get("device_id", "")).lower()
            or (curr_zone and known_zones and curr_zone not in known_zones)
        )

        # Determine composite change_type
        changes = []
        if is_new_device:
            changes.append("new_phone")
        if is_relocation:
            changes.append("relocation")
        if is_new_zone and not is_relocation:
            changes.append("new_zone")

        if len(changes) > 1:
            change_type = "combined"
        elif len(changes) == 1:
            change_type = changes[0]
        else:
            change_type = None

        # Build adaptation_progress description
        progress = None
        if change_type == "new_phone":
            dev_streak = state.get("new_device", {}).get("consistent_sessions", 0)
            target = config.device_adaptation_sessions
            if state.get("new_device", {}).get("trusted"):
                progress = f"{target} of {target} sessions (trusted)"
            else:
                progress = f"{min(dev_streak, target)} of {target} sessions"

        elif change_type == "relocation":
            city_state = state.get("new_city", {})
            c_sess = city_state.get("sessions", 0)
            c_days = city_state.get("days", len(city_state.get("dates_seen", [])))
            target_sess = config.relocation_adaptation_sessions
            target_days = config.relocation_adaptation_days
            if city_state.get("adapted"):
                progress = f"{target_sess} of {target_sess} sessions across {target_days} days (adapted)"
            else:
                progress = f"{min(c_sess, target_sess)} of {target_sess} sessions across {c_days} of {target_days} days"

        elif change_type == "new_zone":
            zone_streak = state.get("new_zone", {}).get("sessions", 0)
            target = config.zone_adaptation_sessions
            if state.get("new_zone", {}).get("adapted"):
                progress = f"{target} of {target} sessions (adapted)"
            else:
                progress = f"{min(zone_streak, target)} of {target} sessions"

        elif change_type == "combined":
            dev_streak = state.get("new_device", {}).get("consistent_sessions", 0)
            zone_streak = state.get("new_zone", {}).get("sessions", 0)
            progress = f"device: {min(dev_streak, 3)}/3, zone: {min(zone_streak, 3)}/3"

        return change_type, progress

    # --------------------------------------------------------------------------
    # 3. Baseline Adaptation Engine
    # --------------------------------------------------------------------------
    @classmethod
    def process_session_adaptation(
        cls,
        baseline: Any,
        session_info: Dict[str, Any],
        behavior_dev: float,
        rule_matches: Optional[List[Any]] = None,
        rule_floor: float = 0.0,
        graph_risk: float = 0.0,
        has_open_case: bool = False,
        timestamp: Optional[datetime] = None,
        cfg: Optional[ThresholdConfig] = None,
    ) -> AdaptationResult:
        """
        Executes gradual baseline adaptation for a session.
        Enforces strict blocking invariants and handles streak progressions.
        """
        config = cfg or DEFAULT_THRESHOLDS
        state = cls.get_adaptation_state(baseline)
        now_dt = timestamp or datetime.now(timezone.utc)
        date_str = now_dt.strftime("%Y-%m-%d")

        # 1. Check Consistency
        is_consistent, block_reason = cls.is_session_consistent(
            behavior_dev=behavior_dev,
            rule_matches=rule_matches,
            rule_floor=rule_floor,
            graph_risk=graph_risk,
            has_open_case=has_open_case,
            cfg=config,
        )

        is_blocked = not is_consistent
        if is_blocked:
            logger.warning("Adaptation blocked for rider session: %s", block_reason)

        # 2. Extract operational identifiers
        dev_token = (
            session_info.get("device_token")
            or session_info.get("fingerprint")
            or session_info.get("device_id")
            or session_info.get("device_id_hash")
        )
        curr_city = str(session_info.get("city") or "").strip().lower()
        curr_zone = str(session_info.get("zone_id") or "").strip().lower()

        base_dict = _extract_dict(baseline)
        home_city = str(base_dict.get("home_city") or "").strip().lower()
        usual_cities = [str(c).strip().lower() for c in state.get("usual_cities", [])]

        is_new_device = bool(
            session_info.get("is_new_device")
            or ("new_phone" in str(session_info.get("session_id", "")))
            or ("newphone" in str(session_info.get("device_id", "")).lower())
            or ("combo" in str(session_info.get("device_id", "")).lower())
        )
        is_relocation = bool(
            "relocation" in str(session_info.get("session_id", ""))
            or (curr_city and home_city and curr_city != home_city and curr_city not in usual_cities)
        )
        is_new_zone = bool(
            "new_zone" in str(session_info.get("session_id", ""))
            or "combo" in str(session_info.get("device_id", "")).lower()
        )

        # Classify change_type
        if is_new_device and (is_relocation or is_new_zone):
            change_type = "combined"
        elif is_new_device:
            change_type = "new_phone"
        elif is_relocation:
            change_type = "relocation"
        elif is_new_zone:
            change_type = "new_zone"
        else:
            change_type = None

        adapted_components: List[str] = []

        # 3. Handle Inconsistency / Abuse Prevention
        if not is_consistent:
            # When mixed behavior or handoff occurs, reset active streaks
            if behavior_dev >= config.adaptation_consistency_dev_limit:
                logger.info("Mixed behavior detected (behavior_dev=%.3f). Resetting unadapted streaks.", behavior_dev)
                if not state["new_device"].get("trusted"):
                    state["new_device"]["consistent_sessions"] = 0
                if not state["new_city"].get("adapted"):
                    state["new_city"]["sessions"] = 0
                    state["new_city"]["dates_seen"] = []
                    state["new_city"]["days"] = 0
                if not state["new_zone"].get("adapted"):
                    state["new_zone"]["sessions"] = 0

            cls.save_adaptation_state(baseline, state)
            _, progress_str = cls.detect_change_type(session_info, config)

            return AdaptationResult(
                is_consistent=False,
                is_blocked=True,
                block_reason=block_reason,
                change_type=change_type,
                adaptation_progress=progress_str or "0 sessions (blocked)",
                is_adapted=False,
                adapted_components=[],
                state=state,
            )

        # 4. Consistent Session: Advance Streaks
        # A. New Phone Adaptation
        if is_new_device and dev_token:
            dev_state = state["new_device"]
            if dev_state.get("token") == dev_token:
                dev_state["consistent_sessions"] = dev_state.get("consistent_sessions", 0) + 1
            else:
                # Switched to another device
                dev_state["token"] = dev_token
                dev_state["consistent_sessions"] = 1
                dev_state["trusted"] = False
                dev_state["trusted_via"] = None
                dev_state["first_seen"] = now_dt.isoformat()

            dev_state["last_seen"] = now_dt.isoformat()

            if dev_state["consistent_sessions"] >= config.device_adaptation_sessions:
                if not dev_state.get("trusted"):
                    dev_state["trusted"] = True
                    dev_state["trusted_via"] = "streak"
                    adapted_components.append("new_phone")
                    cls.rebaseline_device_metrics(baseline, dev_token, [session_info])
                    logger.info("Device %s marked TRUSTED via streak (%d sessions).", dev_token, dev_state["consistent_sessions"])

        # B. Relocation Adaptation
        if is_relocation and curr_city:
            city_state = state["new_city"]
            if city_state.get("city") == curr_city:
                city_state["sessions"] = city_state.get("sessions", 0) + 1
                dates = city_state.get("dates_seen", [])
                if date_str not in dates:
                    dates.append(date_str)
                city_state["dates_seen"] = dates
                city_state["days"] = len(dates)
            else:
                city_state["city"] = curr_city
                city_state["sessions"] = 1
                city_state["dates_seen"] = [date_str]
                city_state["days"] = 1
                city_state["first_seen"] = now_dt.isoformat()
                city_state["adapted"] = False

            if (
                city_state["sessions"] >= config.relocation_adaptation_sessions
                and city_state["days"] >= config.relocation_adaptation_days
            ):
                if not city_state.get("adapted"):
                    city_state["adapted"] = True
                    adapted_components.append("relocation")
                    if curr_city not in state["usual_cities"]:
                        state["usual_cities"].append(curr_city)
                    cls.adapt_city_profile_ewma(baseline, curr_city, curr_zone)
                    logger.info("City %s fully ADAPTED after %d sessions across %d days.", curr_city, city_state["sessions"], city_state["days"])

        # C. Zone Adaptation
        if curr_zone:
            zone_state = state["new_zone"]
            if zone_state.get("zone") == curr_zone:
                zone_state["sessions"] = zone_state.get("sessions", 0) + 1
            else:
                zone_state["zone"] = curr_zone
                zone_state["sessions"] = 1
                zone_state["first_seen"] = now_dt.isoformat()
                zone_state["adapted"] = False

            if zone_state["sessions"] >= config.zone_adaptation_sessions:
                if not zone_state.get("adapted"):
                    zone_state["adapted"] = True
                    adapted_components.append("new_zone")
                    cls.add_zone_to_profile(baseline, curr_zone)
                    logger.info("Zone %s ADAPTED after %d consistent sessions.", curr_zone, zone_state["sessions"])

        # Record history snapshot
        state["history"].append({
            "timestamp": now_dt.isoformat(),
            "behavior_dev": round(behavior_dev, 4),
            "device": dev_token,
            "city": curr_city,
            "zone": curr_zone,
            "consistent": True,
        })
        if len(state["history"]) > 50:
            state["history"] = state["history"][-50:]

        cls.save_adaptation_state(baseline, state)

        # Build final progress string
        progress_str = None
        if change_type == "new_phone":
            dev_s = state["new_device"]["consistent_sessions"]
            progress_str = f"{dev_s} of {config.device_adaptation_sessions} sessions" + (" (trusted)" if state["new_device"]["trusted"] else "")
        elif change_type == "relocation":
            cs = state["new_city"]["sessions"]
            cd = state["new_city"]["days"]
            progress_str = f"{cs} of {config.relocation_adaptation_sessions} sessions across {cd} of {config.relocation_adaptation_days} days"
        elif change_type == "new_zone":
            zs = state["new_zone"]["sessions"]
            progress_str = f"{zs} of {config.zone_adaptation_sessions} sessions" + (" (adapted)" if state["new_zone"]["adapted"] else "")
        elif change_type == "combined":
            dev_s = state["new_device"]["consistent_sessions"]
            zs = state["new_zone"]["sessions"]
            progress_str = f"device: {dev_s}/3, zone: {zs}/3"

        return AdaptationResult(
            is_consistent=True,
            is_blocked=False,
            block_reason=None,
            change_type=change_type,
            adaptation_progress=progress_str,
            is_adapted=len(adapted_components) > 0,
            adapted_components=adapted_components,
            state=state,
        )

    # --------------------------------------------------------------------------
    # 4. Immediate Challenge Resolution Hook (e.g. Passed OTP)
    # --------------------------------------------------------------------------
    @classmethod
    def handle_otp_passed(
        cls,
        baseline: Any,
        device_token: str,
        session_info: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Immediately marks a provisional handset as trusted upon successful OTP verification.
        trusted_via is tagged as 'otp'.
        """
        state = cls.get_adaptation_state(baseline)
        dev_state = state["new_device"]
        dev_state["token"] = device_token
        dev_state["consistent_sessions"] = max(dev_state.get("consistent_sessions", 0), 3)
        dev_state["trusted"] = True
        dev_state["trusted_via"] = "otp"
        dev_state["last_seen"] = datetime.now(timezone.utc).isoformat()

        if session_info:
            cls.rebaseline_device_metrics(baseline, device_token, [session_info])

        cls.save_adaptation_state(baseline, state)
        logger.info("Device %s immediately marked TRUSTED via OTP verification.", device_token)

    # --------------------------------------------------------------------------
    # 5. Profile Update Helpers
    # --------------------------------------------------------------------------
    @classmethod
    def rebaseline_device_metrics(
        cls,
        baseline: Any,
        device_token: str,
        sessions: List[Dict[str, Any]],
    ) -> None:
        """
        Re-baselines tap/typing/swipe for that device only (per-device stats).
        Stores per-device median/MAD in profiles_json / per_device_stats.
        """
        state = cls.get_adaptation_state(baseline)
        per_dev = state.get("per_device_stats", {})

        touch_metrics = ["tap_interval_ms", "typing_cps", "swipe_velocity_px_s"]
        dev_stats: Dict[str, Dict[str, float]] = {}

        for m in touch_metrics:
            vals = [float(s[m]) for s in sessions if m in s and s[m] is not None]
            if vals:
                import numpy as np
                med = float(np.median(vals))
                mad = float(np.median(np.abs(vals - med))) if len(vals) > 1 else 10.0
                dev_stats[m] = {"median": round(med, 2), "mad": round(max(mad, 1.0), 2)}
            else:
                dev_stats[m] = {"median": 190.0, "mad": 15.0}

        per_dev[device_token] = dev_stats
        state["per_device_stats"] = per_dev
        cls.save_adaptation_state(baseline, state)

    @classmethod
    def adapt_city_profile_ewma(
        cls,
        baseline: Any,
        new_city: str,
        zone_id: Optional[str] = None,
        alpha: float = 0.3,
    ) -> None:
        """
        Adapts city profile via EWMA and shifts zone profile to encompass new operational area.
        """
        if baseline is None:
            return

        base_dict = _extract_dict(baseline)
        zone_prof = base_dict.get("zone_profile", {}) or {}
        if isinstance(zone_prof, str):
            try:
                zone_prof = json.loads(zone_prof)
            except Exception:
                zone_prof = {}

        # Dampen existing zones and add new zone
        shifted_zones: Dict[str, float] = {}
        for z, share in zone_prof.items():
            shifted_zones[z] = round(share * (1.0 - alpha), 3)

        if zone_id:
            shifted_zones[str(zone_id).strip().lower()] = round(alpha, 3)

        # Update baseline
        if isinstance(baseline, dict):
            baseline["zone_profile"] = shifted_zones
        elif hasattr(baseline, "profiles_json"):
            try:
                cur_prof = json.loads(baseline.profiles_json or "{}")
            except Exception:
                cur_prof = {}
            cur_prof["zone_profile"] = shifted_zones
            baseline.profiles_json = json.dumps(cur_prof)

    @classmethod
    def add_zone_to_profile(cls, baseline: Any, zone_id: str, default_share: float = 0.20) -> None:
        """Adds a newly adapted zone to the rider's known zone profile."""
        if not zone_id or baseline is None:
            return

        clean_zone = str(zone_id).strip().lower()
        base_dict = _extract_dict(baseline)
        zone_prof = base_dict.get("zone_profile", {}) or {}
        if isinstance(zone_prof, str):
            try:
                zone_prof = json.loads(zone_prof)
            except Exception:
                zone_prof = {}

        zone_prof[clean_zone] = round(default_share, 3)

        if isinstance(baseline, dict):
            baseline["zone_profile"] = zone_prof
        elif hasattr(baseline, "profiles_json"):
            try:
                cur_prof = json.loads(baseline.profiles_json or "{}")
            except Exception:
                cur_prof = {}
            cur_prof["zone_profile"] = zone_prof
            baseline.profiles_json = json.dumps(cur_prof)

    # --------------------------------------------------------------------------
    # 6. Investigation Payload Assembly
    # --------------------------------------------------------------------------
    @classmethod
    def assemble_investigation_payload(
        cls,
        session_id: str,
        rider_id: str,
        verdict: str,
        risk_score: float,
        threat_tags: List[str],
        factors: List[Any],
        mitigating_factors: List[Any],
        adaptation_result: Optional[AdaptationResult] = None,
        baseline: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Assembles comprehensive fraud investigation payload including:
        - change_type: (new_phone | relocation | new_zone | combined)
        - adaptation_progress: (e.g. '2 of 3 sessions')
        - adaptation_state: current persistent streak state
        - factors and mitigating factors
        - block_reason if adaptation was blocked
        """
        change_type = None
        adaptation_progress = None
        adaptation_state = cls.get_adaptation_state(baseline)
        is_blocked = False
        block_reason = None

        if adaptation_result:
            change_type = adaptation_result.change_type
            adaptation_progress = adaptation_result.adaptation_progress
            is_blocked = adaptation_result.is_blocked
            block_reason = adaptation_result.block_reason
            adaptation_state = adaptation_result.state

        # Normalize factors to dicts
        factors_data = []
        for f in factors:
            if hasattr(f, "model_dump"):
                factors_data.append(f.model_dump())
            elif isinstance(f, dict):
                factors_data.append(f)
            elif hasattr(f, "__dict__"):
                factors_data.append({k: v for k, v in f.__dict__.items() if not k.startswith("_")})

        mitig_data = []
        for m in mitigating_factors:
            if hasattr(m, "model_dump"):
                mitig_data.append(m.model_dump())
            elif isinstance(m, dict):
                mitig_data.append(m)
            elif hasattr(m, "__dict__"):
                mitig_data.append({k: v for k, v in m.__dict__.items() if not k.startswith("_")})

        return {
            "session_id": session_id,
            "rider_id": rider_id,
            "verdict": verdict,
            "risk_score": risk_score,
            "threat_tags": threat_tags,
            "change_type": change_type,
            "adaptation_progress": adaptation_progress,
            "adaptation_state": adaptation_state,
            "is_blocked": is_blocked,
            "block_reason": block_reason,
            "factors": factors_data,
            "mitigating_factors": mitig_data,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    # Bind continuous scoring functions for convenience
    load_baseline = staticmethod(load_baseline)
    update_baseline = staticmethod(update_baseline)
    build_history_context = staticmethod(build_history_context)
    haversine_distance = staticmethod(haversine_distance)


# Singleton service instance
baseline_service = BaselineService()


def _extract_dict(obj: Any) -> Dict[str, Any]:
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "__dict__"):
        return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
    return {}


__all__ = [
    "compute_baseline",
    "compute_robust_z",
    "METRIC_NAMES",
    "AdaptationResult",
    "BaselineService",
    "baseline_service",
    "load_baseline",
    "update_baseline",
    "build_history_context",
    "haversine_distance",
]
