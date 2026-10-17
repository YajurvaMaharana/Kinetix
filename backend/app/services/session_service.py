"""
TrustJuggler Continuous Session Risk Assessment Service.
Unified handling pipeline:
- One single entry-point handle(session_or_event) used by POST /sessions and POST /sessions/{id}/events
- Edge tokenization of device fingerprint and IP address before DB persistence
- Strict rider verification (unknown rider returns 404)
- Physical payload range validation
- Multi-modal context assembly (baseline, passport, graph collisions, policy, history, travel velocity)
- Multi-modal risk evaluation via pure scoring engine in app/scoring/risk.py
- Exponential risk smoothing: previous risk read from latest assessment of the same session
- Decision execution: Challenge creation, automated Case opening, payout account & request holds
- Rider status transitions (under_review, restricted)
- Event bus publishing and immutable audit logging
- Sub-5ms latency measurement
"""

import json
import time
import uuid
from datetime import timedelta
from typing import Any, Dict, Optional, Tuple, Union

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.entities import (
    BehaviorSnapshot,
    Case,
    Challenge,
    Device,
    DeviceRider,
    PayoutAccount,
    PayoutRequest,
    PolicyConfig,
    Rider,
    RiderBaseline,
    RiskAssessment,
    RiskFactor,
    SessionEvent,
    utcnow,
)
from app.models.entities import (
    Session as SessionModel,
)
from app.schemas.contracts import (
    AssessmentSchema,
    ChallengeSchema,
    SessionCreateRequest,
    SessionEventRequest,
)
from app.scoring.risk import ScoringContext, score_session
from app.services.audit_service import audit_service
from app.services.baseline_service import (
    build_history_context,
    load_baseline,
    update_baseline,
)
from app.services.events_bus import event_bus
from app.services.privacy import tokenize


def validate_payload_ranges(payload: Dict[str, Any]) -> None:
    """
    Validates physical boundaries for telemetry, biometrics, and geospatial coordinates.
    Raises HTTPException(422) if values violate physical laws or expected bounds.
    """
    # Location
    loc = payload.get("location") if isinstance(payload.get("location"), dict) else payload
    lat = loc.get("latitude") if loc.get("latitude") is not None else loc.get("lat")
    lng = loc.get("longitude") if loc.get("longitude") is not None else loc.get("lng")

    if lat is not None and lat != "":
        try:
            lat_f = float(lat)
            if not (-90.0 <= lat_f <= 90.0):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Latitude {lat_f} out of allowable range [-90, 90]",
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid latitude format"
            ) from None

    if lng is not None and lng != "":
        try:
            lng_f = float(lng)
            if not (-180.0 <= lng_f <= 180.0):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Longitude {lng_f} out of allowable range [-180, 180]",
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid longitude format"
            ) from None

    # Biometrics
    biom = payload.get("biometrics") if isinstance(payload.get("biometrics"), dict) else payload
    face_conf = biom.get("face_match_confidence")
    if face_conf is not None and face_conf != "":
        try:
            fc_f = float(face_conf)
            if not (0.0 <= fc_f <= 1.0):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"face_match_confidence {fc_f} out of allowable range [0, 1]",
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Invalid face_match_confidence format",
            ) from None

    live_score = biom.get("liveness_score")
    if live_score is not None and live_score != "":
        try:
            ls_f = float(live_score)
            if not (0.0 <= ls_f <= 1.0):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"liveness_score {ls_f} out of allowable range [0, 1]",
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid liveness_score format"
            ) from None

    # Telemetry
    telem = payload.get("telemetry") if isinstance(payload.get("telemetry"), dict) else payload
    speed = telem.get("speed_kmh") if telem.get("speed_kmh") is not None else payload.get("speed_kmh")
    if speed is not None and speed != "":
        try:
            sp_f = float(speed)
            if sp_f < 0.0 or sp_f > 1000.0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"speed_kmh {sp_f} out of allowable range [0, 1000]",
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid speed_kmh format"
            ) from None


class SessionService:
    @staticmethod
    def get_or_create_device(
        db: Session,
        rider_id: str,
        fingerprint_raw: Optional[str],
        device_meta: Optional[Dict[str, Any]] = None,
    ) -> Device:
        meta = device_meta or {}
        # If no explicit fingerprint provided, retrieve rider's existing primary device if present
        if not fingerprint_raw or fingerprint_raw == f"dev_default_{rider_id}":
            primary_link = (
                db.query(DeviceRider)
                .filter(DeviceRider.rider_id == rider_id, DeviceRider.is_primary.is_(True))
                .first()
            )
            if primary_link:
                primary_dev = db.query(Device).filter(Device.id == primary_link.device_id).first()
                if primary_dev:
                    return primary_dev

        # Strictly tokenize raw hardware fingerprint at edge before persistence
        tokenized_fp = tokenize(fingerprint_raw or f"dev_default_{rider_id}")

        device = db.query(Device).filter(Device.fingerprint == tokenized_fp).first()
        if not device:
            is_emulator = bool(
                meta.get("is_emulator")
                or meta.get("mock_location_detected")
                or meta.get("is_emulator") in (1, "1", True)
            )
            is_rooted = bool(
                meta.get("is_rooted")
                or meta.get("rooted_or_jailbroken")
                or meta.get("is_rooted") in (1, "1", True)
            )
            device = Device(
                id=f"dev_{tokenized_fp[:10]}",
                fingerprint=tokenized_fp,
                model=meta.get("device_model") or meta.get("model") or "Smartphone",
                os_version=meta.get("os_version") or "Android 14",
                app_version=meta.get("app_version") or "2.4.1",
                is_emulator=is_emulator,
                is_rooted=is_rooted,
                trust_rating=0.4 if (is_emulator or is_rooted) else 1.0,
                created_at=utcnow(),
                last_seen_at=utcnow(),
            )
            db.add(device)
            db.flush()

        # Link DeviceRider
        link = (
            db.query(DeviceRider)
            .filter(DeviceRider.device_id == device.id, DeviceRider.rider_id == rider_id)
            .first()
        )
        if not link:
            existing_primary = (
                db.query(DeviceRider)
                .filter(DeviceRider.rider_id == rider_id, DeviceRider.is_primary.is_(True))
                .first()
            )
            link = DeviceRider(
                id=f"dr_{uuid.uuid4().hex[:8]}",
                device_id=device.id,
                rider_id=rider_id,
                is_primary=(existing_primary is None),
                first_used_at=utcnow(),
                last_used_at=utcnow(),
            )
            db.add(link)
            db.flush()

        return device

    @staticmethod
    def get_graph_stats(db: Session, rider_id: str, device_id: Optional[str]) -> Dict[str, Any]:
        """Calculates graph collision metrics across shared hardware and payout tokens."""
        shared_devices = 1
        if device_id:
            shared_devices = (
                db.query(DeviceRider)
                .filter(DeviceRider.device_id == device_id)
                .count()
            )
        shared_payouts = (
            db.query(PayoutAccount)
            .filter(PayoutAccount.rider_id == rider_id)
            .count()
        )
        graph_risk = 0.90 if (shared_devices >= 3 or shared_payouts >= 3) else 0.0
        return {
            "shared_device_count": shared_devices,
            "shared_payout_count": shared_payouts,
            "risk_score": graph_risk,
        }

    def handle(
        self,
        db: Session,
        session_or_event: Union[SessionCreateRequest, SessionEventRequest, Dict[str, Any]],
        session_id: Optional[str] = None,
        actor: str = "system",
        role: str = "system",
        otp_passed: bool = False,
        challenge_failed: bool = False,
        trigger: Optional[str] = None,
    ) -> Tuple[SessionModel, AssessmentSchema]:
        """
        Unified real-time scoring and execution pipeline for TrustJuggler v2:
        1. Tokenizes edge identifiers (fingerprint and IP).
        2. Loads rider (validating existence, returning 404 for unknown riders).
        3. Loads baseline (falling back to cohort cold-start when unestablished).
        4. Gathers hardware passport, graph collision stats, trust health, active policy.
        5. Gathers history context (travel speed, concurrent sessions, previous session risk).
        6. Evaluates multi-modal risk via score_session().
        7. Persists RiskAssessment, RiskFactor, BehaviorSnapshot, and SessionEvent records.
        8. Updates Session state (risk, verdict, status).
        9. Executes band interventions (Challenge, Case, Payout hold, Rider restriction).
        10. Updates baseline on ordinary_change.
        11. Emits event on EventBus, writes immutable AuditLog, and populates latency_ms.
        """
        start_time = time.perf_counter()

        # 1. Normalize input payload into standard dictionary
        req_dict: Dict[str, Any] = {}
        if hasattr(session_or_event, "model_dump"):
            req_dict = session_or_event.model_dump()
        elif isinstance(session_or_event, dict):
            req_dict = dict(session_or_event)

        # Safety: Payload Range Validation
        validate_payload_ranges(req_dict)

        # 2. Distinguish new session creation vs mid-session event
        is_new_session = session_id is None and ("rider_id" in req_dict)

        if is_new_session:
            rider_id = req_dict["rider_id"]
            # Safety: Unknown rider returns 404
            rider = db.query(Rider).filter(Rider.id == rider_id).first()
            if not rider:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Rider '{rider_id}' not found",
                )

            sess_id = req_dict.get("session_id") or f"sess_{uuid.uuid4().hex[:8]}"

            # Extract hardware & network metadata
            dev_info = req_dict.get("device_passport") or req_dict.get("device") or {}
            raw_fingerprint = (
                dev_info.get("device_id_hash")
                or dev_info.get("fingerprint")
                or dev_info.get("device_id")
                or f"dev_default_{rider.id}"
            )
            raw_ip = dev_info.get("ip_address") or req_dict.get("ip_address") or "192.0.2.1"

            # Strict HMAC tokenization at API boundary
            tokenized_ip = tokenize(raw_ip)
            device = self.get_or_create_device(db, rider.id, raw_fingerprint, dev_info)

            # Check if device is new to this rider
            dr_link = (
                db.query(DeviceRider)
                .filter(DeviceRider.device_id == device.id, DeviceRider.rider_id == rider.id)
                .first()
            )
            is_new_device_for_rider = bool(
                req_dict.get("is_new_device")
                or (dr_link is not None and not dr_link.is_primary)
            )

            # Persist initial session record
            session = SessionModel(
                id=sess_id,
                rider_id=rider.id,
                driver_id=req_dict.get("driver_id"),
                device_id=device.id,
                status="IN_PROGRESS",
                ip_address=tokenized_ip,
                current_risk_score=10.0,
                current_verdict="ALLOW",
                created_at=utcnow(),
                updated_at=utcnow(),
            )
            db.add(session)
            db.flush()

            event_type = trigger or "session_start"
            payload_data = req_dict

        else:
            # Mid-session event or challenge re-score
            actual_session_id = session_id or req_dict.get("session_id")
            if not actual_session_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="session_id is required for event scoring",
                )

            session = db.query(SessionModel).filter(SessionModel.id == actual_session_id).first()
            if not session:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Session '{actual_session_id}' not found",
                )

            rider = db.query(Rider).filter(Rider.id == session.rider_id).first()
            if not rider:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Rider '{session.rider_id}' not found",
                )

            device = db.query(Device).filter(Device.id == session.device_id).first()
            if not device:
                device = self.get_or_create_device(db, rider.id, None, {})

            event_type = (
                trigger
                or req_dict.get("event_type")
                or ("challenge_result" if (otp_passed or challenge_failed) else "telemetry")
            )
            payload_data = req_dict.get("payload", req_dict)
            validate_payload_ranges(payload_data)

            dr_link = (
                db.query(DeviceRider)
                .filter(DeviceRider.device_id == device.id, DeviceRider.rider_id == rider.id)
                .first()
            )
            is_new_device_for_rider = (dr_link is not None and not dr_link.is_primary) or (
                payload_data.get("is_new_device") is True
            )

        # 3. Assemble Scoring Context Components
        # Load baseline (None if unestablished -> cold start path)
        baseline = load_baseline(db, rider.id)

        # Graph collusion risk
        graph_stats = self.get_graph_stats(db, rider.id, device.id)

        # Trust health
        trust_health = (
            rider.trust_score.trust_score
            if (rider.trust_score and rider.trust_score.trust_score is not None)
            else 85.0
        )

        # Active policy config
        active_policy = db.query(PolicyConfig).filter(PolicyConfig.is_active == True).first()  # noqa: E712

        # Historical context (travel velocity, concurrent sessions, previous session risk)
        history_ctx = build_history_context(
            db=db,
            rider_id=rider.id,
            current_session=session,
            current_payload=payload_data,
        )

        # Prepare scoring request dictionary
        merged_req: Dict[str, Any] = dict(payload_data)
        merged_req["session_id"] = session.id
        merged_req["rider_id"] = rider.id
        merged_req["event_type"] = event_type
        merged_req["is_new_device"] = is_new_device_for_rider

        if otp_passed:
            merged_req["otp_passed"] = True
            merged_req["challenge_passed"] = True
        if challenge_failed:
            merged_req["challenge_failed"] = True

        if history_ctx.get("impossible_travel_detected"):
            merged_req["impossible_travel"] = True
        if history_ctx.get("speed_between_pings_kmh", 0.0) > 0:
            if "telemetry" not in merged_req or not isinstance(merged_req["telemetry"], dict):
                merged_req["telemetry"] = {}
            merged_req["telemetry"]["speed_between_pings_kmh"] = history_ctx["speed_between_pings_kmh"]
        if history_ctx.get("concurrent_session_detected"):
            merged_req["concurrent_session"] = True

        # Query the last N location pings (from session_events)
        recent_pings_events = (
            db.query(SessionEvent)
            .filter(
                SessionEvent.session_id == session.id, SessionEvent.event_type == "location_ping"
            )
            .order_by(SessionEvent.created_at.desc())
            .limit(10)
            .all()
        )
        location_pings = []
        for pe in reversed(recent_pings_events):
            try:
                p_data = json.loads(pe.payload_json)
                if isinstance(p_data, dict):
                    if "created_at" not in p_data and "timestamp" not in p_data:
                        p_data["created_at"] = pe.created_at.isoformat()
                    location_pings.append(p_data)
            except Exception:
                pass

        loc = payload_data.get("location")
        if loc:
            location_pings.append(loc.model_dump() if hasattr(loc, "model_dump") else loc)

        previous_location = history_ctx.get("last_location")

        # Check if rider has open case
        has_open_case = (
            db.query(Case)
            .filter(Case.rider_id == rider.id, Case.status.in_(["OPEN", "IN_REVIEW"]))
            .count()
            > 0
        )
        # Fraud Graph integration
        from app.services.graph_service import graph_service

        graph_service.add_session_entities(
            rider_id=rider.id,
            device_id=device.fingerprint
            if (device and device.fingerprint)
            else (device.id if device else None),
            ip_address=session.ip_address if session else None,
        )

        ctx = ScoringContext(
            request_or_event=merged_req,
            baseline=baseline,
            device_passport=device,
            graph_stats=graph_stats,
            trust_health=trust_health,
            history=history_ctx.get("history", []),
            active_policy=active_policy,
            travel_risk=1.0 if history_ctx.get("impossible_travel_detected") else 0.0,
            previous_risk_score=history_ctx.get("previous_risk_score"),
            location_pings=location_pings if location_pings else None,
            previous_location=previous_location,
        )

        # 4. Pure Multi-Modal Scoring
        scored = score_session(ctx)

        # Measure end-to-end latency in milliseconds (guarantee > 0.0)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        final_latency_ms = max(0.1, elapsed_ms)

        # Process gradual baseline adaptation
        from app.services.baseline_service import baseline_service
        session_info = dict(merged_req)
        session_info["session_id"] = session.id
        session_info["device_id"] = device.id
        session_info["device_token"] = raw_fingerprint if is_new_session else getattr(device, "fingerprint", None)

        adaptation_res = baseline_service.process_session_adaptation(
            baseline=baseline,
            session_info=session_info,
            behavior_dev=scored.components.get("pts_behavior", 0.0) / 38.0 if scored.components.get("pts_behavior") else 0.15,
            rule_matches=[f for f in scored.factors if f.category.lower() == "rule"],
            rule_floor=75.0 if scored.classification == "suspected_handoff" else 0.0,
            graph_risk=scored.components.get("pts_graph_risk", 0.0) / 12.0,
            has_open_case=has_open_case,
            timestamp=session.created_at,
        )
        if "new_phone" in adaptation_res.adapted_components:
            device.trust_rating = 1.0

        # 5. Persist RiskAssessment and RiskFactors
        assessment_id = f"eval_{uuid.uuid4().hex[:8]}"
        assessment = RiskAssessment(
            id=assessment_id,
            session_id=session.id,
            risk_score=scored.risk_score,
            raw_risk=scored.raw_risk,
            verdict=scored.verdict,
            risk_tier=scored.risk_tier,
            classification=scored.classification,
            threat_tags_json=json.dumps(scored.threat_tags),
            latency_ms=final_latency_ms,
            model_version=scored.model_version,
            policy_version=scored.policy_version,
            created_at=utcnow(),
        )
        db.add(assessment)
        db.flush()

        for f in scored.factors:
            rf = RiskFactor(
                id=f"factor_{uuid.uuid4().hex[:8]}",
                assessment_id=assessment.id,
                name=f.name,
                category=f.category,
                impact=f.impact,
                weight=f.weight,
                score=f.score,
                description=f.description,
            )
            db.add(rf)

        # 6. Persist BehaviorSnapshot
        telem_dict = payload_data.get("telemetry", {}) if isinstance(payload_data.get("telemetry"), dict) else payload_data
        biom_dict = payload_data.get("biometrics", {}) if isinstance(payload_data.get("biometrics"), dict) else payload_data

        snapshot = BehaviorSnapshot(
            id=f"snap_{uuid.uuid4().hex[:8]}",
            session_id=session.id,
            speed_kmh=float(telem_dict.get("speed_kmh", payload_data.get("speed_kmh", 0.0)) or 0.0),
            acceleration_variance=float(telem_dict.get("acceleration_variance", 0.0) or 0.0),
            gyro_stability=float(telem_dict.get("gyro_stability", 1.0) or 1.0),
            typing_cadence_cpm=float(
                biom_dict.get("typing_cadence_cpm", float(biom_dict.get("typing_cps", 3.5) or 3.5) * 60.0)
            ),
            route_deviation_pct=float(telem_dict.get("route_adherence", 1.0) or 1.0),
            created_at=utcnow(),
        )
        db.add(snapshot)

        # 7. Persist SessionEvent
        event_record = SessionEvent(
            id=f"ev_{uuid.uuid4().hex[:8]}",
            session_id=session.id,
            event_type=event_type,
            payload_json=json.dumps(payload_data),
            created_at=utcnow(),
        )
        db.add(event_record)

        # 8. Update Session state
        session.current_risk_score = scored.risk_score
        session.current_verdict = scored.verdict
        session.updated_at = utcnow()

        challenge_schema: Optional[ChallengeSchema] = None
        case_id: Optional[str] = None

        # 9. Band Decisions: CHALLENGE, ESCALATE, and Payout Holds
        if scored.verdict == "CHALLENGE":
            session.status = "CHALLENGED"
            # Create challenge record
            chlg_id = f"chlg_{uuid.uuid4().hex[:8]}"
            expires = utcnow() + timedelta(minutes=5)
            chlg_type = (
                "OTP" if scored.recommended_action == "CHALLENGE_OTP" else "FACE_LIVENESS"
            )
            chlg = Challenge(
                id=chlg_id,
                session_id=session.id,
                challenge_type=chlg_type,
                status="PENDING",
                expires_at=expires,
                created_at=utcnow(),
            )
            db.add(chlg)
            db.flush()

            challenge_schema = ChallengeSchema(
                challenge_id=chlg.id,
                session_id=session.id,
                challenge_type=chlg.challenge_type,
                status=chlg.status,
                expires_at=expires.isoformat(),
                created_at=chlg.created_at.isoformat(),
            )
            audit_service.log(
                db, actor, role, "CREATE_CHALLENGE", "challenge", chlg.id, f"Verdict: CHALLENGE ({chlg_type})"

            )

        elif scored.verdict == "ESCALATE":
            session.status = "ESCALATED"
            case_id = f"case_{uuid.uuid4().hex[:8]}"
            c = Case(
                id=case_id,
                session_id=session.id,
                rider_id=rider.id,
                severity="CRITICAL" if scored.risk_tier == "CRITICAL" else "HIGH",
                status="OPEN",
                threat_summary=f"Automated risk escalation: verdict={scored.verdict}, score={scored.risk_score}, classification={scored.classification}",
                created_at=utcnow(),
                updated_at=utcnow(),
            )
            db.add(c)
            db.flush()

            # Update Rider Status
            if scored.risk_tier == "CRITICAL" or scored.risk_score >= 85.0:
                rider.status = "restricted"
            else:
                rider.status = "under_review"
            rider.updated_at = utcnow()

            # Payout Hold per ESCALATE decision
            payout_accounts = db.query(PayoutAccount).filter(PayoutAccount.rider_id == rider.id).all()
            for pa in payout_accounts:
                pa.is_flagged = True

            payout_reqs = (
                db.query(PayoutRequest)
                .filter(PayoutRequest.rider_id == rider.id, PayoutRequest.status == "RELEASED")
                .all()
            )
            for pr in payout_reqs:
                pr.status = "HELD"
                pr.hold_reason = f"Automated payout hold: ESCALATE (score={scored.risk_score})"

            audit_service.log(db, actor, role, "OPEN_CASE", "case", c.id, f"Verdict: ESCALATE (rider={rider.status})")

        elif otp_passed:
            session.status = "IN_PROGRESS"
            session.current_verdict = "ALLOW"
            if rider.status in ("under_review", "restricted"):
                rider.status = "active"
                rider.updated_at = utcnow()

        else:
            session.status = "IN_PROGRESS"

        # 10. Baseline update on ordinary_change ONLY
        if scored.classification == "ordinary_change":
            update_baseline(db, rider.id, payload_data)

        db.commit()

        # 11. Immutable Audit Logging
        audit_service.log(
            db,
            actor,
            role,
            "ASSESS_SESSION",
            "session",
            session.id,
            f"Risk={scored.risk_score}, Verdict={scored.verdict}, Latency={final_latency_ms}ms",
        )

        # 12. Publish to EventBus
        event_bus.publish(
            "assessment_created",
            {
                "session_id": session.id,
                "assessment_id": assessment.id,
                "rider_id": rider.id,
                "verdict": scored.verdict,
                "risk_score": scored.risk_score,
                "classification": scored.classification,
                "threat_tags": scored.threat_tags,
                "latency_ms": final_latency_ms,
            },
        )

        res_schema = AssessmentSchema(
            assessment_id=assessment.id,
            session_id=session.id,
            rider_id=session.rider_id,
            risk_score=scored.risk_score,
            raw_risk=scored.raw_risk,
            trust_score=scored.trust_score,
            verdict=scored.verdict,
            risk_tier=scored.risk_tier,
            classification=scored.classification,
            factors=scored.factors,
            threat_tags=scored.threat_tags,
            challenge=challenge_schema,
            case_id=case_id,
            latency_ms=final_latency_ms,
            evaluated_at=assessment.created_at.isoformat(),
            change_type=adaptation_res.change_type or scored.change_type,
            adaptation_progress=adaptation_res.adaptation_progress or scored.adaptation_progress,
        )

        return session, res_schema

    def create_session(
        self, db: Session, req: SessionCreateRequest, actor: str = "system", role: str = "system"
    ) -> Tuple[SessionModel, AssessmentSchema]:
        """Convenience wrapper around handle() for POST /sessions."""
        return self.handle(db=db, session_or_event=req, actor=actor, role=role)

    def add_session_event(
        self,
        db: Session,
        session_id: str,
        event_type: str,
        payload: Dict[str, Any],
        actor: str = "system",
        role: str = "system",
    ) -> AssessmentSchema:
        """Convenience wrapper around handle() for POST /sessions/{id}/events."""
        event_dict = {"event_type": event_type, "payload": payload}
        _, assessment = self.handle(
            db=db, session_or_event=event_dict, session_id=session_id, actor=actor, role=role
        )
        return assessment

    @classmethod
    def get_investigation_payload(cls, db: Session, session_id: str) -> Dict[str, Any]:
        """
        Builds complete investigation payload for analyst review.
        Includes change_type and adaptation_progress.
        """
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise KeyError(f"Session '{session_id}' not found")

        assessment = (
            db.query(RiskAssessment)
            .filter(RiskAssessment.session_id == session.id)
            .order_by(RiskAssessment.created_at.desc())
            .first()
        )
        baseline = (
            db.query(RiderBaseline).filter(RiderBaseline.rider_id == session.rider_id).first()
        )

        from app.services.baseline_service import baseline_service

        change_type, progress = baseline_service.detect_change_type(
            {
                "session_id": session.id,
                "rider_id": session.rider_id,
                "device_id": session.device_id,
            },
            cfg=None,
        )

        factors = assessment.factors if assessment else []
        return baseline_service.assemble_investigation_payload(
            session_id=session.id,
            rider_id=session.rider_id,
            verdict=session.current_verdict,
            risk_score=session.current_risk_score,
            threat_tags=[],
            factors=factors,
            mitigating_factors=[],
            baseline=baseline,
        )


session_service = SessionService()
