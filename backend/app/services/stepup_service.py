"""
Step-Up Verification Service for TrustJuggler v2.
Implements the multi-tiered challenge ladder, cooldowns, suppression, lazy expiry, and escalation flows.

Ladder Levels:
- Level 0: Passive monitor (MONITOR) -> No challenge issued
- Level 1: OTP (risk 45-59)
- Level 2: Liveness selfie + face match (risk 60-74, payout lock, or OTP failed)
- Level 3: Manual review / document check (ESCALATE, face or liveness failure)

Cooldowns & Suppression:
- cooldown_key = rider_id + reason_code
- After a PASS:
  - Suppress repeat OTP for the same key for 30 minutes
  - Lift Level-2 challenges for 24 hours
- Max 2 liveness challenges per rider per day (rolling 24h)
- Suppressed challenges are stored with status "suppressed"
- Lazy challenge expiry (10 min lifetime) evaluated on read.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.entities import (
    Case,
    Challenge,
    Device,
    DeviceRider,
    LivenessCheck,
    PayoutAccount,
    PayoutRequest,
    Rider,
    RiderBaseline,
    RiderTrustHistory,
    RiderTrustScore,
)
from app.models.entities import (
    Session as SessionModel,
)
from app.schemas.contracts import (
    ChallengeRespondRequest,
    ChallengeResponse,
)
from app.services.audit_service import audit_service


def utcnow() -> datetime:
    """Returns naive UTC datetime matching DB standard."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def compute_cooldown_key(rider_id: str, reason_code: str) -> str:
    """Computes cooldown key: rider_id + reason_code."""
    return f"{rider_id}:{reason_code}"


def _extract_val(obj: Any, key: str, default: Any = None) -> Any:
    """Safely extracts field from dict, Pydantic model, or SQLAlchemy entity."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def derive_reason_code(
    assessment: Any,
    rider_state: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Derives the reason code from the top risk factor, threat tags, or rider state.
    Examples: NEW_DEVICE_BEHAVIOR_SHIFT, IMPOSSIBLE_TRAVEL, PAYOUT_CHANGED.
    """
    state = rider_state or {}

    # Explicit override in state
    if state.get("reason_code"):
        return str(state["reason_code"])

    # High-priority trigger states
    if (
        state.get("payout_lock")
        or state.get("payout_locked")
        or state.get("payout_account_changed")
    ):
        return "PAYOUT_CHANGED"
    if state.get("otp_failed"):
        return "OTP_FAILED"
    if state.get("face_failed") or state.get("liveness_failed"):
        return "FACE_LIVENESS_FAILED"

    # Inspect assessment threat tags
    threat_tags = _extract_val(assessment, "threat_tags", []) or []
    if isinstance(threat_tags, str):
        threat_tags = [threat_tags]

    threat_set = {str(t).upper() for t in threat_tags}
    if "PAYOUT_REDIRECT" in threat_set or "PAYOUT_HIJACK" in threat_set:
        return "PAYOUT_CHANGED"
    if "IMPOSSIBLE_TRAVEL" in threat_set or "GPS_SPOOFING" in threat_set:
        return "IMPOSSIBLE_TRAVEL"
    if "DEVICE_EMULATOR" in threat_set:
        return "DEVICE_EMULATOR"
    if "MOCK_LOCATION" in threat_set:
        return "MOCK_LOCATION"
    if "FRAUD_RING" in threat_set:
        return "FRAUD_RING"

    # Inspect assessment factors
    factors = _extract_val(assessment, "factors", []) or []
    if factors:
        # Filter for negative impact or high weight
        def get_weight(f: Any) -> float:
            w = _extract_val(f, "weight", 0.0)
            pts = _extract_val(f, "points", 0.0)
            return float(w or pts or 0.0)

        def is_negative(f: Any) -> bool:
            imp = str(_extract_val(f, "impact", "")).upper()
            return imp in ("NEGATIVE", "RISK") or get_weight(f) > 0.0

        risk_factors = [f for f in factors if is_negative(f)]
        candidate_factors = risk_factors if risk_factors else factors
        sorted_factors = sorted(candidate_factors, key=get_weight, reverse=True)

        top_f = sorted_factors[0]
        f_code = str(_extract_val(top_f, "code", "") or "").upper()
        f_name = str(_extract_val(top_f, "name", "") or "").upper()
        f_desc = str(_extract_val(top_f, "description", "") or "").upper()

        combined = f"{f_code} {f_name} {f_desc}"

        if "PAYOUT" in combined or "FINANCIAL" in combined or "SENSITIVE_ACTIONS" in combined:
            return "PAYOUT_CHANGED"
        if "TRAVEL" in combined or "GPS" in combined or "SPEED" in combined:
            return "IMPOSSIBLE_TRAVEL"
        if "EMULATOR" in combined:
            return "DEVICE_EMULATOR"
        if "ROOT" in combined:
            return "DEVICE_ROOTED"
        if "MOCK" in combined:
            return "MOCK_LOCATION"
        if "RING" in combined or "MULTI" in combined:
            return "FRAUD_RING"
        if "NEW_DEVICE" in combined or "HANDSET" in combined:
            if (
                "BEHAVIOR" in combined
                or "CADENCE" in combined
                or "TAP" in combined
                or "SPEED" in combined
            ):
                return "NEW_DEVICE_BEHAVIOR_SHIFT"
            return "NEW_DEVICE_BEHAVIOR_SHIFT"
        if "BEHAVIOR" in combined or "BIOMETRIC" in combined or "MOTOR" in combined:
            return "BEHAVIORAL_ANOMALY"

        if f_code and f_code not in ("RULE_HIT", "UNKNOWN", "FACTOR"):
            return f_code

    if state.get("is_new_device"):
        return "NEW_DEVICE_BEHAVIOR_SHIFT"

    return "SUSPICIOUS_BEHAVIOR_SHIFT"


def choose_challenge(
    assessment: Any,
    rider_state: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Selects step-up verification challenge per risk tier and escalation rules:
    - Level 0: Passive monitor (MONITOR, risk < 45 or verdict in ALLOW/MONITOR)
    - Level 1: OTP (risk 45-59)
    - Level 2: Liveness selfie + face match (risk 60-74, payout lock, or OTP failed)
    - Level 3: Manual review / document check (ESCALATE, face or liveness failure)

    Proportionality: Never challenge when decision is ALLOW or MONITOR.
    Returns: {"type": str, "reason_code": str, "level": int}
    """
    state = rider_state or {}
    verdict = str(_extract_val(assessment, "verdict", "") or "").upper()
    risk_score = float(_extract_val(assessment, "risk_score", 0.0) or 0.0)

    # 1. Proportionality: Never challenge when decision is ALLOW or MONITOR
    if verdict in ("ALLOW", "MONITOR"):
        reason_code = derive_reason_code(assessment, state)
        return {
            "type": "MONITOR",
            "reason_code": reason_code,
            "level": 0,
        }

    # 2. Derive reason code from top factor / state
    reason_code = derive_reason_code(assessment, state)

    # 3. Escalation and Level determination
    # Level 3: ESCALATE verdict, face/liveness failure, or explicit level 3
    if (
        verdict == "ESCALATE"
        or risk_score >= 75.0
        or bool(state.get("face_failed"))
        or bool(state.get("liveness_failed"))
        or bool(state.get("level_2_failed"))
        or state.get("level") == 3
    ):
        return {
            "type": "MANUAL_REVIEW",
            "reason_code": reason_code,
            "level": 3,
        }

    # Level 2: Risk 60-74, payout lock, or OTP failed
    if (
        bool(state.get("payout_lock"))
        or bool(state.get("payout_locked"))
        or bool(state.get("otp_failed"))
        or bool(state.get("level_1_failed"))
        or (60.0 <= risk_score <= 74.9)
    ):
        return {
            "type": "FACE_LIVENESS",
            "reason_code": reason_code,
            "level": 2,
        }

    # Level 1: Risk 45-59
    if 45.0 <= risk_score <= 59.9 or verdict == "CHALLENGE":
        return {
            "type": "OTP",
            "reason_code": reason_code,
            "level": 1,
        }

    # Fallback: Passive Monitor
    return {
        "type": "MONITOR",
        "reason_code": reason_code,
        "level": 0,
    }


class StepUpService:
    """Manages challenge lifecycle, cooldown enforcement, lazy expiry, and escalation."""

    def lazy_check_expiry(self, challenge: Challenge, db: Optional[Session] = None) -> Challenge:
        """
        Lazily evaluates challenge expiry on read (10 min lifetime).
        Marks PENDING challenges as EXPIRED if current time exceeds expires_at.
        """
        if challenge.status == "PENDING" and challenge.expires_at <= utcnow():
            challenge.status = "EXPIRED"
            if db:
                db.flush()
        return challenge

    def check_cooldown_and_limits(
        self,
        db: Session,
        rider_id: str,
        challenge_choice: Dict[str, Any],
    ) -> Tuple[bool, Optional[str]]:
        """
        Evaluates cooldown suppression rules:
        1. Max 2 liveness challenges per rider per day (24h window).
        2. Suppress repeat OTP for same key (rider_id + reason_code) for 30 min after PASS.
        3. Lift Level-2 liveness challenge for 24h after PASS.

        Returns: (is_suppressed, suppression_reason)
        """
        level = int(challenge_choice.get("level", 0))
        chlg_type = challenge_choice.get("type")
        reason_code = challenge_choice.get("reason_code", "UNKNOWN")
        cooldown_key = compute_cooldown_key(rider_id, reason_code)

        now = utcnow()

        # Rule 1: Max 2 liveness challenges per rider per day
        if level == 2 or chlg_type == "FACE_LIVENESS":
            day_ago = now - timedelta(days=1)
            liveness_count = (
                db.query(Challenge)
                .filter(
                    Challenge.rider_id == rider_id,
                    Challenge.challenge_type == "FACE_LIVENESS",
                    Challenge.status != "suppressed",
                    Challenge.created_at >= day_ago,
                )
                .count()
            )
            if liveness_count >= 2:
                return True, "Maximum liveness challenges (2/day) reached for rider"

        # Rule 2: Suppress repeat OTP for same cooldown_key for 30 min after PASS
        if level == 1 or chlg_type == "OTP":
            thirty_min_ago = now - timedelta(minutes=30)
            passed_otp = (
                db.query(Challenge)
                .filter(
                    Challenge.rider_id == rider_id,
                    Challenge.challenge_type == "OTP",
                    Challenge.status == "PASSED",
                    Challenge.resolved_at >= thirty_min_ago,
                    (
                        (Challenge.cooldown_key == cooldown_key)
                        | (Challenge.cooldown_key == f"{rider_id}{reason_code}")
                        | (Challenge.reason_code == reason_code)
                    ),
                )
                .first()
            )
            if passed_otp:
                return (
                    True,
                    f"OTP challenge suppressed due to active 30m cooldown for key {cooldown_key}",
                )

        # Rule 3: Lift Level-2 for 24h after PASS
        if level == 2 or chlg_type == "FACE_LIVENESS":
            twenty_four_hours_ago = now - timedelta(hours=24)
            passed_liveness = (
                db.query(Challenge)
                .filter(
                    Challenge.rider_id == rider_id,
                    Challenge.status == "PASSED",
                    Challenge.resolved_at >= twenty_four_hours_ago,
                    (
                        (Challenge.level >= 2)
                        | (Challenge.challenge_type == "FACE_LIVENESS")
                        | (Challenge.cooldown_key == cooldown_key)
                    ),
                )
                .first()
            )
            if passed_liveness:
                return (
                    True,
                    "Level-2 liveness challenge lifted for 24h following verified pass",
                )

        return False, None

    def create_or_suppress_challenge(
        self,
        db: Session,
        session: SessionModel,
        assessment: Any,
        rider: Rider,
        rider_state: Optional[Dict[str, Any]] = None,
        actor: str = "system",
        role: str = "system",
    ) -> Tuple[Optional[Challenge], Optional[str]]:
        """
        Creates an active challenge or records a suppressed challenge record.
        Returns: (challenge_record, suppression_reason)
        """
        choice = choose_challenge(assessment, rider_state)
        level = choice["level"]
        chlg_type = choice["type"]
        reason_code = choice["reason_code"]
        cooldown_key = compute_cooldown_key(rider.id, reason_code)

        # Level 0 = MONITOR -> Never challenge
        if level == 0 or chlg_type == "MONITOR":
            return None, None

        # Check cooldowns and limits
        is_suppressed, suppression_reason = self.check_cooldown_and_limits(db, rider.id, choice)

        chlg_id = f"chlg_{uuid.uuid4().hex[:8]}"
        expires_at = utcnow() + timedelta(minutes=10)

        if is_suppressed:
            chlg = Challenge(
                id=chlg_id,
                session_id=session.id,
                rider_id=rider.id,
                challenge_type=chlg_type,
                status="suppressed",
                level=level,
                reason_code=reason_code,
                cooldown_key=cooldown_key,
                expires_at=expires_at,
                resolved_at=utcnow(),
                created_at=utcnow(),
            )
            db.add(chlg)
            db.flush()

            audit_service.log(
                db,
                actor,
                role,
                "CHALLENGE_SUPPRESSED",
                "challenge",
                chlg.id,
                f"Suppressed {chlg_type} (level {level}, key={cooldown_key}): {suppression_reason}",
            )
            return chlg, suppression_reason

        # Not suppressed: Create pending challenge
        chlg = Challenge(
            id=chlg_id,
            session_id=session.id,
            rider_id=rider.id,
            challenge_type=chlg_type,
            status="PENDING",
            level=level,
            reason_code=reason_code,
            cooldown_key=cooldown_key,
            expires_at=expires_at,
            created_at=utcnow(),
        )
        db.add(chlg)
        session.status = "CHALLENGED"
        db.flush()

        audit_service.log(
            db,
            actor,
            role,
            "CREATE_CHALLENGE",
            "challenge",
            chlg.id,
            f"Issued level {level} challenge ({chlg_type}, reason={reason_code}, key={cooldown_key})",
        )
        return chlg, None

    def handle_challenge_response(
        self,
        db: Session,
        challenge_id: str,
        payload: ChallengeRespondRequest,
        actor: str = "rider",
        role: str = "rider",
    ) -> ChallengeResponse:
        """
        Processes step-up verification response (OTP, Face Liveness, Manual).
        Pass handling: Re-scores with verification flags, trusts device, updates trust history, restores session.
        Fail handling: Escalates OTP -> Level 2; Level 2 -> Level 3 plus Case.
        """
        chlg = db.query(Challenge).filter(Challenge.id == challenge_id).first()
        if not chlg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Challenge '{challenge_id}' not found",
            )

        # Lazy check on read
        self.lazy_check_expiry(chlg, db)

        if chlg.status == "EXPIRED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Challenge '{challenge_id}' has expired",
            )

        if chlg.status in ("PASSED", "FAILED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Challenge '{challenge_id}' has already been resolved with status '{chlg.status}'",
            )

        session = db.query(SessionModel).filter(SessionModel.id == chlg.session_id).first()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{chlg.session_id}' not found",
            )

        rider = db.query(Rider).filter(Rider.id == (chlg.rider_id or session.rider_id)).first()

        # Determine verification result
        is_passed = bool(payload.passed)
        if chlg.level == 1 or chlg.challenge_type == "OTP":
            if payload.otp_code is not None:
                is_passed = is_passed and (
                    payload.otp_code.strip() in ("123456", "valid_otp", "OK")
                )
        elif chlg.level == 2 or chlg.challenge_type == "FACE_LIVENESS":
            # Record liveness check
            lc = LivenessCheck(
                id=f"live_{chlg.id[:8]}",
                challenge_id=chlg.id,
                liveness_score=payload.liveness_score,
                confidence=payload.confidence,
                passed=is_passed and (payload.liveness_score >= 0.80),
                created_at=utcnow(),
            )
            db.add(lc)
            is_passed = lc.passed

        chlg.resolved_at = utcnow()

        from app.services.session_service import session_service

        if is_passed:
            # ------------------------------------------------------------------
            # PASS HANDLING
            # ------------------------------------------------------------------
            chlg.status = "PASSED"

            # 1. Trust Device
            device = db.query(Device).filter(Device.id == session.device_id).first()
            if device:
                device.trust_level = "trusted"
                device.trust_rating = 1.0
                device.streak_count = getattr(device, "streak_count", 0) + 1
                link = (
                    db.query(DeviceRider)
                    .filter(
                        DeviceRider.device_id == device.id,
                        DeviceRider.rider_id == session.rider_id,
                    )
                    .first()
                )
                if link:
                    link.is_primary = True

                baseline = (
                    db.query(RiderBaseline)
                    .filter(RiderBaseline.rider_id == session.rider_id)
                    .first()
                )
                if baseline:
                    from app.services.baseline_service import baseline_service

                    if hasattr(baseline_service, "handle_otp_passed"):
                        baseline_service.handle_otp_passed(baseline, device.fingerprint)

            # 2. Update Rider Trust Score & History
            if rider:
                trust_score_row = (
                    db.query(RiderTrustScore).filter(RiderTrustScore.rider_id == rider.id).first()
                )
                old_trust = trust_score_row.trust_score if trust_score_row else 75.0
                new_trust = min(100.0, old_trust + 15.0)

                if trust_score_row:
                    trust_score_row.trust_score = new_trust
                    trust_score_row.last_calculated_at = utcnow()
                else:
                    trust_score_row = RiderTrustScore(
                        id=f"ts_{uuid.uuid4().hex[:8]}",
                        rider_id=rider.id,
                        trust_score=new_trust,
                        trend="IMPROVING",
                        confidence=0.95,
                        last_calculated_at=utcnow(),
                    )
                    db.add(trust_score_row)

                # Record history entry
                hist_entry = RiderTrustHistory(
                    id=f"th_{uuid.uuid4().hex[:8]}",
                    rider_id=rider.id,
                    trust_score=new_trust,
                    reason=f"Step-up challenge passed ({chlg.challenge_type})",
                    created_at=utcnow(),
                )
                db.add(hist_entry)

                # Restore rider account status
                if rider.status in ("under_review", "restricted"):
                    rider.status = "active"
                    rider.updated_at = utcnow()

            # 3. Re-score session with verification flags
            session, assessment = session_service.handle(
                db=db,
                session_or_event=payload.proof_payload or {},
                session_id=session.id,
                actor=actor,
                role=role,
                otp_passed=True,
                trigger="challenge_result",
            )
            session.status = "IN_PROGRESS"
            session.current_verdict = "ALLOW"
            new_verdict = assessment.verdict
            msg = f"Challenge {chlg.challenge_type} passed successfully. Device trusted and session restored."

            audit_service.log(
                db,
                actor,
                role,
                "CHALLENGE_PASSED",
                "challenge",
                chlg.id,
                f"Result: PASSED, Level={chlg.level}, Restored verdict={new_verdict}",
            )

        else:
            # ------------------------------------------------------------------
            # FAIL HANDLING & ESCALATION
            # ------------------------------------------------------------------
            chlg.status = "FAILED"

            if chlg.level == 1 or chlg.challenge_type == "OTP":
                # Level 1 failure -> Escalate to Level 2 (Face Liveness)
                next_chlg_id = f"chlg_{uuid.uuid4().hex[:8]}"
                next_expires = utcnow() + timedelta(minutes=10)
                level2_chlg = Challenge(
                    id=next_chlg_id,
                    session_id=session.id,
                    rider_id=session.rider_id,
                    challenge_type="FACE_LIVENESS",
                    status="PENDING",
                    level=2,
                    reason_code="OTP_FAILED",
                    cooldown_key=compute_cooldown_key(session.rider_id, "OTP_FAILED"),
                    expires_at=next_expires,
                    created_at=utcnow(),
                )
                db.add(level2_chlg)
                session.status = "CHALLENGED"

                session, assessment = session_service.handle(
                    db=db,
                    session_or_event=payload.proof_payload or {},
                    session_id=session.id,
                    actor=actor,
                    role=role,
                    challenge_failed=True,
                    trigger="otp_failed_escalate",
                )
                session.status = "CHALLENGED"
                new_verdict = "CHALLENGE"
                msg = f"OTP challenge failed. Escalated to Level 2 (Face Liveness challenge {next_chlg_id})."

                audit_service.log(
                    db,
                    actor,
                    role,
                    "ESCALATE_CHALLENGE_LEVEL2",
                    "challenge",
                    chlg.id,
                    f"OTP failed. Issued Level 2 face liveness challenge {next_chlg_id}",
                )

            else:
                # Level 2 or Level 3 failure -> Escalate to Level 3 Manual Review plus Case
                session.status = "ESCALATED"
                case_id = f"case_{uuid.uuid4().hex[:8]}"
                c = Case(
                    id=case_id,
                    session_id=session.id,
                    rider_id=session.rider_id,
                    severity="CRITICAL",
                    status="OPEN",
                    threat_summary=(
                        f"Step-up verification failed ({chlg.challenge_type}, level {chlg.level}): "
                        "biometric/identity mismatch. Escalated to Level 3 security investigation."
                    ),
                    created_at=utcnow(),
                    updated_at=utcnow(),
                )
                db.add(c)

                if rider:
                    rider.status = "restricted"
                    rider.updated_at = utcnow()

                # Flag payouts
                payout_accounts = (
                    db.query(PayoutAccount).filter(PayoutAccount.rider_id == session.rider_id).all()
                )
                for pa in payout_accounts:
                    pa.is_flagged = True

                payout_reqs = (
                    db.query(PayoutRequest)
                    .filter(
                        PayoutRequest.rider_id == session.rider_id,
                        PayoutRequest.status == "RELEASED",
                    )
                    .all()
                )
                for pr in payout_reqs:
                    pr.status = "HELD"
                    pr.hold_reason = f"Security escalation: Level {chlg.level} challenge failed"

                session, assessment = session_service.handle(
                    db=db,
                    session_or_event=payload.proof_payload or {},
                    session_id=session.id,
                    actor=actor,
                    role=role,
                    challenge_failed=True,
                    trigger="liveness_failed_escalate",
                )
                new_verdict = assessment.verdict
                msg = f"Challenge failed. Escalated to Level 3 manual review and opened Security Case {case_id}."

                audit_service.log(
                    db,
                    actor,
                    role,
                    "ESCALATE_TO_CASE",
                    "case",
                    case_id,
                    f"Level {chlg.level} challenge failed. Rider restricted, payouts held.",
                )

        db.commit()

        return ChallengeResponse(
            challenge_id=chlg.id,
            session_id=chlg.session_id,
            rider_id=chlg.rider_id or session.rider_id,
            challenge_type=chlg.challenge_type,
            status=chlg.status,
            level=chlg.level,
            reason_code=chlg.reason_code,
            cooldown_key=chlg.cooldown_key,
            expires_at=chlg.expires_at.isoformat() if chlg.expires_at else None,
            created_at=chlg.created_at.isoformat() if chlg.created_at else None,
            resolved_at=chlg.resolved_at.isoformat() if chlg.resolved_at else None,
            verified=is_passed,
            new_verdict=new_verdict,
            message=msg,
        )


stepup_service = StepUpService()
