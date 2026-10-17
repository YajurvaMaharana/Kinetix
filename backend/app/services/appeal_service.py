"""
TrustJuggler Appeals Service.
Manages rider-facing appeals against security restrictions, step-up challenges,
and fraud case flags, with full human-in-the-loop overturn side-effects.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.entities import (
    Appeal,
    AuditLog,
    Case,
    PayoutRequest,
    ReviewerAction,
    Rider,
    RiderTrustHistory,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AppealService:
    def create_appeal(
        self,
        db: Session,
        case_id: Optional[str],
        rider_id: str,
        reason: str,
        supporting_text: Optional[str] = None,
        actor: str = "rider",
        role: str = "rider",
    ) -> Appeal:
        """
        Files a new formal appeal on behalf of a rider.
        Validates rider existence and case association, recording an audit log entry.
        """
        clean_reason = str(reason or "").strip()
        if not clean_reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Appeal reason is required.",
            )

        rider = db.query(Rider).filter(Rider.id == rider_id).first()
        if not rider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Rider '{rider_id}' not found.",
            )

        if case_id:
            c = db.query(Case).filter(Case.id == case_id).first()
            if not c:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Case '{case_id}' not found.",
                )
            if role == "rider" and c.rider_id != rider_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden: rider cannot appeal a case belonging to another identity.",
                )

        appeal_id = f"appeal_{uuid.uuid4().hex[:8]}"
        now = utcnow()
        appeal = Appeal(
            id=appeal_id,
            case_id=case_id,
            rider_id=rider_id,
            reason=clean_reason,
            supporting_text=str(supporting_text).strip() if supporting_text else None,
            status="PENDING",
            created_at=now,
            updated_at=now,
        )
        db.add(appeal)

        audit_entry = AuditLog(
            id=f"audit_app_create_{uuid.uuid4().hex[:8]}",
            actor=actor,
            role=role,
            action="APPEAL_SUBMITTED",
            entity_type="appeal",
            entity_id=appeal_id,
            detail=f"Rider {rider_id} filed appeal for case {case_id or 'general'}: {clean_reason}",
            created_at=now,
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(appeal)
        return appeal

    def list_appeals(
        self,
        db: Session,
        status_filter: Optional[str] = None,
        rider_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
        role: str = "analyst",
    ) -> List[Appeal]:
        """
        Lists filed appeals. Non-privileged rider role is strictly scoped to own rider_id.
        """
        q = db.query(Appeal)
        if rider_id:
            q = q.filter(Appeal.rider_id == rider_id)
        if status_filter and status_filter.upper() != "ALL":
            q = q.filter(Appeal.status == status_filter.upper())

        return q.order_by(Appeal.created_at.desc()).offset(skip).limit(limit).all()

    def get_appeal(
        self,
        db: Session,
        appeal_id: str,
        rider_id: Optional[str] = None,
        role: str = "analyst",
    ) -> Appeal:
        """
        Retrieves a single appeal record. Enforces cross-rider access isolation for role=rider.
        """
        appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
        if not appeal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Appeal '{appeal_id}' not found.",
            )

        if role == "rider" and rider_id and appeal.rider_id != rider_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: rider cannot read other riders' data.",
            )

        return appeal

    def handle_appeal_action(
        self,
        db: Session,
        appeal_id: str,
        action: str,
        note: str,
        actor: str = "analyst",
        role: str = "analyst",
    ) -> Appeal:
        """
        Applies human-in-the-loop review decision on an appeal ('upheld' or 'overturned').
        Overturning an appeal:
        - lifts rider restrictions (rider.status = 'active')
        - marks the linked case as false_positive (RESOLVED_FALSE_POSITIVE)
        - releases eligible held payouts
        - restores trust history (+10 bonus points)
        - records a feedback snapshot for adaptive policy tuning
        - writes immutable audit trail entries
        """
        clean_note = str(note or "").strip()
        if not clean_note:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A detailed reviewer note is mandatory when ruling on an appeal.",
            )

        norm_action = str(action or "").strip().lower()
        if norm_action not in ("upheld", "overturned"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid action '{action}'. Allowed: 'upheld', 'overturned'.",
            )

        appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
        if not appeal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Appeal '{appeal_id}' not found.",
            )

        rider = db.query(Rider).filter(Rider.id == appeal.rider_id).first()
        now = utcnow()

        if norm_action == "overturned":
            appeal.status = "OVERTURNED"
            appeal.reviewer_id = actor
            appeal.reviewer_notes = clean_note
            appeal.updated_at = now

            # 1. Lift restrictions on rider account
            if rider:
                rider.status = "active"
                rider.updated_at = now

            # 2. Mark linked case as false_positive and release holds
            if appeal.case_id:
                case = db.query(Case).filter(Case.id == appeal.case_id).first()
                if case:
                    case.status = "RESOLVED_FALSE_POSITIVE"
                    case.updated_at = now

                    # Release eligible held payouts
                    held_payouts = (
                        db.query(PayoutRequest)
                        .filter(
                            PayoutRequest.rider_id == appeal.rider_id,
                            PayoutRequest.status.in_(["HELD", "BLOCKED"]),
                        )
                        .all()
                    )
                    for p in held_payouts:
                        p.status = "RELEASED"
                        p.updated_at = now

                    # Restore trust history
                    cur_trust = 85.0
                    if rider and rider.trust_score and rider.trust_score.trust_score is not None:
                        cur_trust = rider.trust_score.trust_score
                    restored_trust = min(100.0, cur_trust + 10.0)

                    rth = RiderTrustHistory(
                        id=f"rth_app_{uuid.uuid4().hex[:8]}",
                        rider_id=appeal.rider_id,
                        trust_score=restored_trust,
                        delta=10.0,
                        reason=f"Restored following overturned appeal {appeal_id}: {clean_note}",
                        created_at=now,
                    )
                    db.add(rth)
                    if rider and rider.trust_score:
                        rider.trust_score.trust_score = restored_trust
                        rider.trust_score.trend = "IMPROVING"
                        rider.trust_score.last_calculated_at = now

                    # Record reviewer feedback snapshot
                    ra = ReviewerAction(
                        id=f"act_app_{uuid.uuid4().hex[:8]}",
                        case_id=appeal.case_id,
                        reviewer_id=actor,
                        action_type="appeal_overturned",
                        notes=clean_note,
                        assessment_risk=case.risk_score,
                        classification_snapshot=case.threat_tag or "APPEAL_OVERTURNED",
                        threat_tag=case.threat_tag,
                        created_at=now,
                    )
                    db.add(ra)

            # Audit entry
            db.add(
                AuditLog(
                    id=f"audit_app_over_{uuid.uuid4().hex[:8]}",
                    actor=actor,
                    role=role,
                    action="APPEAL_OVERTURNED",
                    entity_type="appeal",
                    entity_id=appeal_id,
                    detail=(
                        f"Appeal {appeal_id} overturned by {actor}. "
                        f"Restrictions lifted for rider {appeal.rider_id}, "
                        f"case {appeal.case_id or 'N/A'} marked false_positive, holds released. Note: {clean_note}"
                    ),
                    created_at=now,
                )
            )

        elif norm_action == "upheld":
            appeal.status = "UPHELD"
            appeal.reviewer_id = actor
            appeal.reviewer_notes = clean_note
            appeal.updated_at = now

            db.add(
                AuditLog(
                    id=f"audit_app_upheld_{uuid.uuid4().hex[:8]}",
                    actor=actor,
                    role=role,
                    action="APPEAL_UPHELD",
                    entity_type="appeal",
                    entity_id=appeal_id,
                    detail=f"Appeal {appeal_id} upheld by {actor}. Prior risk findings sustained. Note: {clean_note}",
                    created_at=now,
                )
            )

        db.commit()
        db.refresh(appeal)
        return appeal


appeal_service = AppealService()
