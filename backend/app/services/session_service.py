import json
import uuid
from datetime import timedelta
from typing import Any, Dict, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.entities import (
    Case,
    Challenge,
    Device,
    DeviceRider,
    PolicyConfig,
    Rider,
    RiderBaseline,
    RiderTrustScore,
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
)
from app.scoring.risk import ScoringContext, score_session
from app.services.audit_service import audit_service
from app.services.events_bus import event_bus
from app.services.privacy import tokenize


class SessionService:
    @staticmethod
    def get_or_create_rider(db: Session, rider_id: str) -> Rider:
        rider = db.query(Rider).filter(Rider.id == rider_id).first()
        if not rider:
            rider = Rider(
                id=rider_id,
                display_name=f"Rider {rider_id[-4:] if len(rider_id) >= 4 else rider_id}",
                phone_number="+1-555-0100",
                email=f"{rider_id}@example.com",
                status="active",
                created_at=utcnow(),
                updated_at=utcnow(),
            )
            db.add(rider)
            db.flush()

            # Create default baseline and trust score
            baseline = RiderBaseline(
                id=f"base_{uuid.uuid4().hex[:8]}",
                rider_id=rider.id,
                avg_speed_kmh=35.0,
                avg_cadence_cpm=220.0,
                updated_at=utcnow(),
            )
            trust = RiderTrustScore(
                id=f"trust_{uuid.uuid4().hex[:8]}",
                rider_id=rider.id,
                trust_score=90.0,
                trend="STABLE",
                confidence=0.95,
                last_calculated_at=utcnow(),
            )
            db.add_all([baseline, trust])
            db.flush()
        return rider

    @staticmethod
    def get_or_create_device(
        db: Session,
        rider_id: str,
        fingerprint_raw: Optional[str],
        device_meta: Optional[Dict[str, Any]] = None,
    ) -> Device:
        meta = device_meta or {}
        # Apply HMAC tokenization at API edge before storing
        tokenized_fp = tokenize(fingerprint_raw or f"dev_default_{rider_id}")

        device = db.query(Device).filter(Device.fingerprint == tokenized_fp).first()
        if not device:
            is_emulator = bool(meta.get("is_emulator") or meta.get("mock_location_detected"))
            is_rooted = bool(meta.get("is_rooted") or meta.get("rooted_or_jailbroken"))
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
            link = DeviceRider(
                id=f"dr_{uuid.uuid4().hex[:8]}",
                device_id=device.id,
                rider_id=rider_id,
                is_primary=True,
                first_used_at=utcnow(),
                last_used_at=utcnow(),
            )
            db.add(link)
            db.flush()

        return device

    @classmethod
    def create_session(
        cls, db: Session, req: SessionCreateRequest, actor: str = "system", role: str = "system"
    ) -> Tuple[SessionModel, AssessmentSchema]:
        session_id = req.session_id or f"sess_{uuid.uuid4().hex[:8]}"

        # 1. Ensure Rider and Device records (Tokenizing fingerprint and IP)
        cls.get_or_create_rider(db, req.rider_id)

        # Extract device metadata from request
        dev_info: Dict[str, Any] = {}
        if req.device_passport:
            dev_info = req.device_passport.model_dump()
        elif req.device:
            dev_info = req.device.model_dump()

        raw_fingerprint = (
            dev_info.get("device_id_hash") or dev_info.get("fingerprint") or session_id
        )
        raw_ip = dev_info.get("ip_address") or "192.0.2.1"

        # TOKENIZE at edge before persistence
        tokenized_ip = tokenize(raw_ip)
        device = cls.get_or_create_device(db, req.rider_id, raw_fingerprint, dev_info)

        # 2. Persist initial Session record
        session = SessionModel(
            id=session_id,
            rider_id=req.rider_id,
            driver_id=req.driver_id,
            device_id=device.id,
            status="IN_PROGRESS",
            ip_address=tokenized_ip,  # strictly tokenized
            current_risk_score=10.0,
            current_verdict="ALLOW",
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        db.add(session)
        db.flush()

        # 3. Bundle context & call ONLY scoring interface
        baseline = db.query(RiderBaseline).filter(RiderBaseline.rider_id == req.rider_id).first()
        policy = db.query(PolicyConfig).filter(PolicyConfig.is_active == True).first()  # noqa: E712

        # Query previous session's last location
        prev_session = (
            db.query(SessionModel)
            .filter(SessionModel.rider_id == req.rider_id, SessionModel.id != session.id)
            .order_by(SessionModel.created_at.desc())
            .first()
        )
        previous_location = None
        if prev_session:
            last_ev = (
                db.query(SessionEvent)
                .filter(
                    SessionEvent.session_id == prev_session.id,
                    SessionEvent.event_type == "location_ping",
                )
                .order_by(SessionEvent.created_at.desc())
                .first()
            )
            if last_ev:
                try:
                    previous_location = json.loads(last_ev.payload_json)
                    if (
                        isinstance(previous_location, dict)
                        and "created_at" not in previous_location
                    ):
                        previous_location["created_at"] = last_ev.created_at.isoformat()
                except Exception:
                    pass

        # Extract initial pings if available in request
        init_pings = []
        if hasattr(req, "location") and req.location:
            init_pings.append(
                req.location.model_dump() if hasattr(req.location, "model_dump") else req.location
            )

        from app.services.graph_service import graph_service

        graph_service.add_session_entities(
            rider_id=req.rider_id,
            device_id=device.fingerprint
            if (device and device.fingerprint)
            else (device.id if device else None),
            ip_address=tokenized_ip,
        )

        ctx = ScoringContext(
            request_or_event=req,
            baseline=baseline,
            device_passport=device,
            active_policy=policy,
            location_pings=init_pings if init_pings else None,
            previous_location=previous_location,
        )

        # Check if rider has open case
        has_open_case = (
            db.query(Case)
            .filter(Case.rider_id == req.rider_id, Case.status.in_(["OPEN", "IN_REVIEW"]))
            .count()
            > 0
        )

        # Score exclusively through interface in app/scoring/risk.py
        scored = score_session(ctx)

        # Process gradual baseline adaptation
        from app.services.baseline_service import baseline_service

        session_info = (
            req.model_dump()
            if hasattr(req, "model_dump")
            else (req if isinstance(req, dict) else {})
        )
        session_info["session_id"] = session.id
        session_info["device_id"] = device.id
        session_info["device_token"] = raw_fingerprint

        adaptation_res = baseline_service.process_session_adaptation(
            baseline=baseline,
            session_info=session_info,
            behavior_dev=scored.components.get("pts_behavior", 0.0) / 38.0
            if scored.components.get("pts_behavior")
            else 0.15,
            rule_matches=[f for f in scored.factors if f.category.lower() == "rule"],
            rule_floor=75.0 if scored.classification == "suspected_handoff" else 0.0,
            graph_risk=scored.components.get("pts_graph_risk", 0.0) / 12.0,
            has_open_case=has_open_case,
            timestamp=session.created_at,
        )
        if "new_phone" in adaptation_res.adapted_components:
            device.trust_rating = 1.0

        # 4. Save RiskAssessment & Factors
        assessment_id = f"eval_{uuid.uuid4().hex[:8]}"
        assessment = RiskAssessment(
            id=assessment_id,
            session_id=session.id,
            risk_score=scored.risk_score,
            raw_risk=scored.raw_risk,
            verdict=scored.verdict,
            risk_tier=scored.risk_tier,
            latency_ms=scored.latency_ms,
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

        # 5. Handle Band Decisions: CHALLENGE and ESCALATE
        challenge_schema: Optional[ChallengeSchema] = None
        case_id: Optional[str] = None

        if scored.verdict == "CHALLENGE":
            session.status = "CHALLENGED"
            chlg_id = f"chlg_{uuid.uuid4().hex[:8]}"
            expires = utcnow() + timedelta(minutes=5)
            chlg = Challenge(
                id=chlg_id,
                session_id=session.id,
                challenge_type="FACE_LIVENESS",
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
                db, actor, role, "CREATE_CHALLENGE", "challenge", chlg.id, "Verdict: CHALLENGE"
            )

        elif scored.verdict == "ESCALATE":
            session.status = "ESCALATED"
            case_id = f"case_{uuid.uuid4().hex[:8]}"
            c = Case(
                id=case_id,
                session_id=session.id,
                rider_id=req.rider_id,
                severity="CRITICAL" if scored.risk_tier == "CRITICAL" else "HIGH",
                status="OPEN",
                threat_summary=f"Automated risk escalation: verdict={scored.verdict}, score={scored.risk_score}",
                created_at=utcnow(),
                updated_at=utcnow(),
            )
            db.add(c)
            db.flush()
            audit_service.log(db, actor, role, "OPEN_CASE", "case", c.id, "Verdict: ESCALATE")

        # Update Session state
        session.current_risk_score = scored.risk_score
        session.current_verdict = scored.verdict
        session.updated_at = utcnow()
        db.commit()

        # Audit log for assessment
        audit_service.log(
            db,
            actor,
            role,
            "ASSESS_SESSION",
            "session",
            session.id,
            f"Risk={scored.risk_score}, Verdict={scored.verdict}",
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
            factors=scored.factors,
            threat_tags=scored.threat_tags,
            challenge=challenge_schema,
            case_id=case_id,
            latency_ms=scored.latency_ms,
            evaluated_at=assessment.created_at.isoformat(),
            change_type=adaptation_res.change_type or scored.change_type,
            adaptation_progress=adaptation_res.adaptation_progress or scored.adaptation_progress,
        )

        # Publish to SSE EventBus
        event_bus.publish(
            "assessment_created",
            {
                "session_id": session.id,
                "assessment_id": assessment.id,
                "verdict": scored.verdict,
                "risk_score": scored.risk_score,
            },
        )

        return session, res_schema

    @classmethod
    def add_session_event(
        cls,
        db: Session,
        session_id: str,
        event_type: str,
        payload: Dict[str, Any],
        actor: str = "system",
        role: str = "system",
    ) -> AssessmentSchema:
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if not session:
            raise KeyError(f"Session '{session_id}' not found")

        # 1. Persist SessionEvent
        event_id = f"ev_{uuid.uuid4().hex[:8]}"
        ev = SessionEvent(
            id=event_id,
            session_id=session.id,
            event_type=event_type,
            payload_json=json.dumps(payload),
            created_at=utcnow(),
        )
        db.add(ev)
        db.flush()

        # 2. Rescore by invoking ONLY score_session
        device = db.query(Device).filter(Device.id == session.device_id).first()
        baseline = (
            db.query(RiderBaseline).filter(RiderBaseline.rider_id == session.rider_id).first()
        )
        policy = db.query(PolicyConfig).filter(PolicyConfig.is_active == True).first()  # noqa: E712

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

        # Query previous session's last location
        prev_session = (
            db.query(SessionModel)
            .filter(SessionModel.rider_id == session.rider_id, SessionModel.id != session.id)
            .order_by(SessionModel.created_at.desc())
            .first()
        )
        previous_location = None
        if prev_session:
            last_ev = (
                db.query(SessionEvent)
                .filter(
                    SessionEvent.session_id == prev_session.id,
                    SessionEvent.event_type == "location_ping",
                )
                .order_by(SessionEvent.created_at.desc())
                .first()
            )
            if last_ev:
                try:
                    previous_location = json.loads(last_ev.payload_json)
                    if (
                        isinstance(previous_location, dict)
                        and "created_at" not in previous_location
                    ):
                        previous_location["created_at"] = last_ev.created_at.isoformat()
                except Exception:
                    pass

        # Check if rider has open case
        has_open_case = (
            db.query(Case)
            .filter(Case.rider_id == session.rider_id, Case.status.in_(["OPEN", "IN_REVIEW"]))
            .count()
            > 0
        )

        ctx = ScoringContext(
            request_or_event={"event_type": event_type, **payload},
            baseline=baseline,
            device_passport=device,
            active_policy=policy,
            location_pings=location_pings if location_pings else None,
            previous_location=previous_location,
            previous_risk_score=session.current_risk_score,
        )
        scored = score_session(ctx)

        from app.services.baseline_service import baseline_service

        event_session_info = {"event_type": event_type, **payload}
        event_session_info["session_id"] = session.id
        event_session_info["device_id"] = device.id if device else None
        adaptation_res = baseline_service.process_session_adaptation(
            baseline=baseline,
            session_info=event_session_info,
            behavior_dev=scored.components.get("pts_behavior", 0.0) / 38.0
            if scored.components.get("pts_behavior")
            else 0.15,
            rule_matches=[f for f in scored.factors if f.category.lower() == "rule"],
            rule_floor=75.0 if scored.classification == "suspected_handoff" else 0.0,
            graph_risk=scored.components.get("pts_graph_risk", 0.0) / 12.0,
            has_open_case=has_open_case,
            timestamp=ev.created_at,
        )

        # 3. Persist new assessment
        assessment_id = f"eval_{uuid.uuid4().hex[:8]}"
        assessment = RiskAssessment(
            id=assessment_id,
            session_id=session.id,
            risk_score=scored.risk_score,
            raw_risk=scored.raw_risk,
            verdict=scored.verdict,
            risk_tier=scored.risk_tier,
            latency_ms=scored.latency_ms,
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

        # 4. Bands logic for rescore
        challenge_schema = None
        case_id = None
        if scored.verdict == "CHALLENGE":
            session.status = "CHALLENGED"
            chlg_id = f"chlg_{uuid.uuid4().hex[:8]}"
            expires = utcnow() + timedelta(minutes=5)
            chlg = Challenge(
                id=chlg_id,
                session_id=session.id,
                challenge_type="FACE_LIVENESS",
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
                db,
                actor,
                role,
                "CREATE_CHALLENGE",
                "challenge",
                chlg.id,
                f"Event {event_type} rescore",
            )
        elif scored.verdict == "ESCALATE":
            session.status = "ESCALATED"
            case_id = f"case_{uuid.uuid4().hex[:8]}"
            c = Case(
                id=case_id,
                session_id=session.id,
                rider_id=session.rider_id,
                severity="HIGH",
                status="OPEN",
                threat_summary=f"Event {event_type} escalated risk to {scored.risk_score}",
                created_at=utcnow(),
                updated_at=utcnow(),
            )
            db.add(c)
            db.flush()
            audit_service.log(
                db, actor, role, "OPEN_CASE", "case", c.id, f"Event {event_type} rescore"
            )

        session.current_risk_score = scored.risk_score
        session.current_verdict = scored.verdict
        session.updated_at = utcnow()
        db.commit()

        audit_service.log(
            db,
            actor,
            role,
            "REASSESS_EVENT",
            "session",
            session.id,
            f"Event={event_type}, Risk={scored.risk_score}",
        )

        event_bus.publish(
            "session_event_scored",
            {
                "session_id": session.id,
                "event_type": event_type,
                "risk_score": scored.risk_score,
                "verdict": scored.verdict,
            },
        )

        return AssessmentSchema(
            assessment_id=assessment.id,
            session_id=session.id,
            rider_id=session.rider_id,
            risk_score=scored.risk_score,
            raw_risk=scored.raw_risk,
            trust_score=scored.trust_score,
            verdict=scored.verdict,
            risk_tier=scored.risk_tier,
            factors=scored.factors,
            threat_tags=scored.threat_tags,
            challenge=challenge_schema,
            case_id=case_id,
            latency_ms=scored.latency_ms,
            evaluated_at=assessment.created_at.isoformat(),
            change_type=adaptation_res.change_type or scored.change_type,
            adaptation_progress=adaptation_res.adaptation_progress or scored.adaptation_progress,
        )

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
