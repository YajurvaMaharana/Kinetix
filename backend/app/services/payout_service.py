"""
TrustJuggler v2 Payout Protection Service.

Responsibilities:
1. Payout Account Tracking:
   - Tracks payout_accounts (account_token, set_at, is_current).
   - Starts 24-hour protection window upon account update or creation.
2. Payout Risk Evaluation:
   - evaluate_payout(request, assessment, rider_state) -> APPROVED | HELD | BLOCKED.
   - APPROVED: risk < 45 and no protection window.
   - HELD: risk 45-74, protection window active, unusually high amount vs median, or new destination.
   - BLOCKED: ESCALATE verdict, open fraud case, or syndicate cluster membership.
   - Plain-language explanations for all hold and block rationales.
3. Two-Phase Release Protocol:
   - Held payouts release after passed liveness selfie AND (for window/blocked cases) analyst approval.
   - PATCH /payouts/{id} (action: release | block) with role enforcement.
   - Immutable audit log entry for every state transition.
"""

import statistics
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.entities import (
    Case,
    Challenge,
    FraudCluster,
    PayoutAccount,
    PayoutRequest,
    Rider,
)
from app.models.entities import (
    Session as SessionModel,
)
from app.schemas.contracts import (
    PayoutActionRequest,
    PayoutRequestCreate,
    PayoutResponse,
)
from app.services.audit_service import audit_service


def utcnow() -> datetime:
    """Returns naive UTC datetime matching DB timestamp conventions."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PayoutService:
    """Core domain service orchestrating payout evaluation, escrow gating, and release."""

    PROTECTION_WINDOW_HOURS: int = 24
    HIGH_RISK_THRESHOLD: float = 75.0
    CHALLENGE_RISK_THRESHOLD: float = 45.0
    UNUSUAL_AMOUNT_MULTIPLIER: float = 2.5
    DEFAULT_MEDIAN_AMOUNT: float = 45.0

    # --------------------------------------------------------------------------
    # 1. Payout Account Tracking & Protection Window
    # --------------------------------------------------------------------------

    def set_payout_account(
        self,
        db: Session,
        rider_id: str,
        account_token: str,
        routing_token: Optional[str] = None,
        account_type: str = "checking",
        actor: str = "system",
        role: str = "rider",
        now: Optional[datetime] = None,
    ) -> PayoutAccount:
        """
        Registers or updates a rider's destination payout account.
        Starts the 24-hour protection window upon any modification.
        """
        current_time = now or utcnow()

        # Check existing active account
        current_acct = (
            db.query(PayoutAccount)
            .filter(PayoutAccount.rider_id == rider_id, PayoutAccount.is_current.is_(True))
            .first()
        )

        if current_acct and current_acct.account_number_token == account_token:
            return current_acct

        # Deactivate existing current account
        if current_acct:
            current_acct.is_current = False
            audit_service.log(
                db=db,
                actor=actor,
                role=role,
                action="PAYOUT_ACCOUNT_DEACTIVATED",
                entity_type="payout_account",
                entity_id=current_acct.id,
                detail=f"Deactivated previous account token {current_acct.account_number_token[:8]}... for rider {rider_id}.",
            )

        # Create new active payout account record
        new_id = f"pacct_{uuid.uuid4().hex[:10]}"
        new_acct = PayoutAccount(
            id=new_id,
            rider_id=rider_id,
            account_number_token=account_token,
            routing_token=routing_token,
            account_type=account_type,
            set_at=current_time,
            is_current=True,
            is_flagged=False,
            created_at=current_time,
        )
        db.add(new_acct)
        db.commit()

        audit_service.log(
            db=db,
            actor=actor,
            role=role,
            action="PAYOUT_ACCOUNT_UPDATED",
            entity_type="payout_account",
            entity_id=new_id,
            detail=(
                f"Payout destination account updated for rider {rider_id}. "
                f"24h protection window activated until {(current_time + timedelta(hours=self.PROTECTION_WINDOW_HOURS)).isoformat()}."
            ),
        )

        return new_acct

    def get_protection_window(
        self,
        db: Session,
        rider_id: str,
        now: Optional[datetime] = None,
    ) -> Tuple[bool, Optional[datetime]]:
        """
        Determines whether the rider is currently within the 24-hour protection window
        following a destination account change.
        """
        current_time = now or utcnow()
        current_acct = (
            db.query(PayoutAccount)
            .filter(PayoutAccount.rider_id == rider_id, PayoutAccount.is_current.is_(True))
            .order_by(PayoutAccount.set_at.desc())
            .first()
        )

        if not current_acct:
            return False, None

        window_expires = current_acct.set_at + timedelta(hours=self.PROTECTION_WINDOW_HOURS)
        is_active = current_time < window_expires
        return is_active, window_expires if is_active else None

    # --------------------------------------------------------------------------
    # 2. Historical Baseline & Destination Intelligence
    # --------------------------------------------------------------------------

    def get_rider_median_payout(self, db: Session, rider_id: str) -> float:
        """Computes rider's historical median payout amount from released disbursements."""
        past_payouts = (
            db.query(PayoutRequest)
            .filter(
                PayoutRequest.rider_id == rider_id,
                PayoutRequest.status.in_(["RELEASED", "APPROVED"]),
            )
            .all()
        )
        amounts = [float(p.amount) for p in past_payouts if p.amount and p.amount > 0]
        if len(amounts) >= 3:
            return round(statistics.median(amounts), 2)
        return self.DEFAULT_MEDIAN_AMOUNT

    def is_destination_new(
        self,
        db: Session,
        rider_id: str,
        destination_token: Optional[str],
        now: Optional[datetime] = None,
    ) -> bool:
        """Returns True if this destination account is new or has never received a successful payout."""
        if not destination_token:
            return True

        current_time = now or utcnow()

        # Check if the account was registered within the protection window
        acct = (
            db.query(PayoutAccount)
            .filter(
                PayoutAccount.rider_id == rider_id,
                PayoutAccount.account_number_token == destination_token,
            )
            .first()
        )
        if acct and (current_time - acct.set_at) < timedelta(hours=self.PROTECTION_WINDOW_HOURS):
            return True

        # Check historical completed disbursements to this destination
        completed_count = (
            db.query(PayoutRequest)
            .filter(
                PayoutRequest.rider_id == rider_id,
                PayoutRequest.status.in_(["RELEASED", "APPROVED"]),
                PayoutRequest.payout_account_id == (acct.id if acct else None),
            )
            .count()
        )
        return completed_count == 0

    # --------------------------------------------------------------------------
    # 3. Core Evaluation Engine: evaluate_payout
    # --------------------------------------------------------------------------

    def evaluate_payout(
        self,
        db: Session,
        request: PayoutRequestCreate,
        assessment: Optional[Any] = None,
        rider_state: Optional[Dict[str, Any]] = None,
        now: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates a payout request against the three-tier policy:
        - APPROVED: risk < 45 and no protection window
        - HELD: risk 45-74, protection window active, unusually high amount, or new destination
        - BLOCKED: ESCALATE verdict, open case, or cluster membership
        """
        current_time = now or utcnow()
        state = dict(rider_state or {})
        rider_id = request.rider_id
        amount = float(request.amount)

        # 1. Resolve Session Risk & Verdict
        risk_score = 15.0
        verdict = "ALLOW"
        if assessment:
            risk_score = getattr(assessment, "risk_score", 15.0)
            verdict = getattr(assessment, "verdict", "ALLOW")
        elif request.session_id:
            sess = db.query(SessionModel).filter(SessionModel.id == request.session_id).first()
            if sess:
                risk_score = float(sess.current_risk_score)
                verdict = str(sess.current_verdict)
        elif state.get("risk_score") is not None:
            risk_score = float(state["risk_score"])
            verdict = state.get("verdict", "ALLOW")

        # 2. Check Syndicate Cluster Membership
        in_cluster = bool(state.get("in_cluster", False))
        if not in_cluster:
            cluster_count = (
                db.query(FraudCluster)
                .filter(
                    FraudCluster.shared_identifiers.like(f"%{rider_id}%"),
                    FraudCluster.status.in_(["ACTIVE", "MONITORED"]),
                )
                .count()
            )
            in_cluster = cluster_count > 0

        # 3. Check Open Fraud Cases
        open_case = (
            db.query(Case)
            .filter(Case.rider_id == rider_id, Case.status.in_(["OPEN", "open"]))
            .first()
        )

        # 4. Protection Window & Account Age
        in_window, window_expires = self.get_protection_window(db, rider_id, now=current_time)
        session_verified = bool(
            state.get("session_verified")
            or state.get("is_verified")
            or state.get("face_verified")
            or state.get("otp_passed")
        )

        # 5. Median Payout & Magnitude Analysis
        median_amount = self.get_rider_median_payout(db, rider_id)
        is_unusually_high = amount > (median_amount * self.UNUSUAL_AMOUNT_MULTIPLIER) and amount >= 100.0

        # 6. Destination Account Intelligence
        dest_token = request.destination_account_token
        if not dest_token:
            curr_acct = (
                db.query(PayoutAccount)
                .filter(PayoutAccount.rider_id == rider_id, PayoutAccount.is_current.is_(True))
                .first()
            )
            dest_token = curr_acct.account_number_token if curr_acct else None

        is_new_dest = self.is_destination_new(db, rider_id, dest_token, now=current_time)

        # ----------------------------------------------------------------------
        # Decision Matrix Gating
        # ----------------------------------------------------------------------

        # TIER 1: BLOCKED (Non-negotiable security blocks)
        if verdict in ("ESCALATE", "BLOCK") or risk_score >= self.HIGH_RISK_THRESHOLD:
            return {
                "status": "BLOCKED",
                "risk_at_request": risk_score,
                "reason": (
                    f"Payout blocked: Session risk is in the critical escalation tier (score: {risk_score:.1f}). "
                    "All disbursements are locked pending Trust & Safety review."
                ),
                "release_requires": "analyst_approval",
                "destination_token": dest_token,
            }

        if open_case:
            return {
                "status": "BLOCKED",
                "risk_at_request": risk_score,
                "reason": (
                    f"Payout blocked: Rider has an active fraud investigation case ({open_case.id}). "
                    "Funds cannot be released until the case is resolved."
                ),
                "release_requires": "analyst_approval",
                "destination_token": dest_token,
            }

        if in_cluster:
            return {
                "status": "BLOCKED",
                "risk_at_request": risk_score,
                "reason": (
                    "Payout blocked: Account or destination instrument is associated with an organized syndicate fraud ring."
                ),
                "release_requires": "analyst_approval",
                "destination_token": dest_token,
            }

        # TIER 2: HELD (Escrow Protection Gating)
        if in_window and not session_verified:
            exp_str = window_expires.strftime("%Y-%m-%d %H:%M UTC") if window_expires else "24 hours"
            return {
                "status": "HELD",
                "risk_at_request": risk_score,
                "reason": (
                    f"Payout held: Payout account was updated within the 24-hour protection window (active until {exp_str}). "
                    "Requires facial liveness verification and analyst clearance."
                ),
                "release_requires": "liveness_selfie+analyst_approval",
                "destination_token": dest_token,
            }

        if is_unusually_high:
            return {
                "status": "HELD",
                "risk_at_request": risk_score,
                "reason": (
                    f"Payout held: Requested disbursement of ${amount:.2f} is unusually high versus "
                    f"rider historical median of ${median_amount:.2f} (>{self.UNUSUAL_AMOUNT_MULTIPLIER}x). "
                    "Requires biometric liveness re-verification."
                ),
                "release_requires": "liveness_selfie",
                "destination_token": dest_token,
            }

        if is_new_dest and not session_verified:
            return {
                "status": "HELD",
                "risk_at_request": risk_score,
                "reason": (
                    "Payout held: First disbursement to a newly registered destination account. "
                    "Requires facial liveness verification."
                ),
                "release_requires": "liveness_selfie",
                "destination_token": dest_token,
            }

        if risk_score >= self.CHALLENGE_RISK_THRESHOLD:
            return {
                "status": "HELD",
                "risk_at_request": risk_score,
                "reason": (
                    f"Payout held: Session risk score of {risk_score:.1f} is in the step-up challenge band. "
                    "Requires biometric verification before funds release."
                ),
                "release_requires": "liveness_selfie",
                "destination_token": dest_token,
            }

        # TIER 3: APPROVED (Standard low-friction clearance)
        return {
            "status": "APPROVED",
            "risk_at_request": risk_score,
            "reason": "Payout approved: Routine withdrawal within established baseline risk parameters.",
            "release_requires": "none",
            "destination_token": dest_token,
        }

    # --------------------------------------------------------------------------
    # 4. Request Lifecycle & Endpoints
    # --------------------------------------------------------------------------

    def request_payout(
        self,
        db: Session,
        payload: PayoutRequestCreate,
        actor: str = "rider",
        role: str = "rider",
        now: Optional[datetime] = None,
    ) -> PayoutResponse:
        """
        Processes a payout request, executes the protection evaluation,
        persists the payout record, and creates a step-up challenge when required.
        """
        current_time = now or utcnow()

        # Validate Rider
        rider = db.query(Rider).filter(Rider.id == payload.rider_id).first()
        if not rider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Rider '{payload.rider_id}' not found.",
            )

        # Run Evaluation
        eval_result = self.evaluate_payout(db=db, request=payload, now=current_time)

        # Find or link current PayoutAccount
        acct = (
            db.query(PayoutAccount)
            .filter(
                PayoutAccount.rider_id == payload.rider_id,
                PayoutAccount.is_current.is_(True),
            )
            .first()
        )
        if not acct and eval_result.get("destination_token"):
            acct = self.set_payout_account(
                db=db,
                rider_id=payload.rider_id,
                account_token=eval_result["destination_token"],
                actor=actor,
                role=role,
                now=current_time,
            )

        payout_id = f"pay_{uuid.uuid4().hex[:10]}"
        challenge_id = None

        # If payout is HELD and requires liveness selfie, link/create Challenge
        if eval_result["status"] == "HELD" and "liveness_selfie" in eval_result["release_requires"]:
            challenge_id = f"chlg_pay_{uuid.uuid4().hex[:8]}"
            chlg = Challenge(
                id=challenge_id,
                session_id=payload.session_id or f"sess_payout_{payload.rider_id[:8]}",
                rider_id=payload.rider_id,
                challenge_type="face_liveness",
                status="PENDING",
                level=2,
                reason_code="PAYOUT_CHANGED",
                created_at=current_time,
                expires_at=current_time + timedelta(minutes=15),
            )
            db.add(chlg)

        payout_req = PayoutRequest(
            id=payout_id,
            payout_account_id=acct.id if acct else None,
            rider_id=payload.rider_id,
            session_id=payload.session_id,
            amount=payload.amount,
            currency=payload.currency,
            status=eval_result["status"],
            risk_at_request=eval_result["risk_at_request"],
            reason=eval_result["reason"],
            hold_reason=eval_result["reason"],
            release_requires=eval_result["release_requires"],
            challenge_id=challenge_id,
            created_at=current_time,
            updated_at=current_time,
        )
        db.add(payout_req)
        db.commit()

        # Audit payout request
        audit_service.log(
            db=db,
            actor=actor,
            role=role,
            action=f"PAYOUT_{eval_result['status']}",
            entity_type="payout_request",
            entity_id=payout_id,
            detail=(
                f"Payout requested: ${payload.amount:.2f} {payload.currency}. "
                f"Status={eval_result['status']}. Risk={eval_result['risk_at_request']:.1f}. "
                f"Reason: {eval_result['reason']}"
            ),
        )

        return PayoutResponse(
            payout_id=payout_id,
            rider_id=payload.rider_id,
            amount=payload.amount,
            currency=payload.currency,
            status=eval_result["status"],
            risk_at_request=eval_result["risk_at_request"],
            reason=eval_result["reason"],
            release_requires=eval_result["release_requires"],
            destination_account_token=eval_result.get("destination_token"),
            challenge_id=challenge_id,
            session_id=payload.session_id,
            created_at=current_time.isoformat(),
            updated_at=current_time.isoformat(),
        )

    # --------------------------------------------------------------------------
    # 5. Payout Release & Analyst Review Action: PATCH /payouts/{id}
    # --------------------------------------------------------------------------

    def handle_payout_action(
        self,
        db: Session,
        payout_id: str,
        action_req: PayoutActionRequest,
        actor: str = "analyst_system",
        role: str = "analyst",
        now: Optional[datetime] = None,
    ) -> PayoutResponse:
        """
        Applies an analyst clearance or block action to a payout request.
        Validates two-phase release constraints:
        - If release_requires includes 'liveness_selfie', liveness verification must be completed
          before release, OR analyst explicitly clears it with audit trail.
        """
        current_time = now or utcnow()
        payout = db.query(PayoutRequest).filter(PayoutRequest.id == payout_id).first()
        if not payout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Payout '{payout_id}' not found.",
            )

        action = action_req.action.strip().lower()

        if action == "release":
            # Check two-phase release requirements
            reqs = (payout.release_requires or "").lower()
            if "liveness_selfie" in reqs and payout.liveness_verified_at is None:
                # Disallow release without completed biometric verification
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Cannot release payout '{payout_id}': Required facial liveness verification "
                        "has not been completed by the rider."
                    ),
                )

            payout.status = "RELEASED"
            payout.analyst_approved_at = current_time
            payout.analyst_id = actor
            payout.reason = (
                f"Disbursement released after verification clearance. Notes: {action_req.notes or 'None'}"
            )
            payout.updated_at = current_time
            db.commit()

            audit_service.log(
                db=db,
                actor=actor,
                role=role,
                action="PAYOUT_RELEASED",
                entity_type="payout_request",
                entity_id=payout_id,
                detail=f"Payout {payout_id} released by analyst {actor}. Notes: {action_req.notes}",
            )

        elif action == "block":
            payout.status = "BLOCKED"
            payout.analyst_id = actor
            payout.reason = (
                f"Payout permanently blocked by analyst review. Notes: {action_req.notes or 'Confirmed fraud risk'}"
            )
            payout.updated_at = current_time
            db.commit()

            audit_service.log(
                db=db,
                actor=actor,
                role=role,
                action="PAYOUT_BLOCKED",
                entity_type="payout_request",
                entity_id=payout_id,
                detail=f"Payout {payout_id} blocked by analyst {actor}. Notes: {action_req.notes}",
            )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid payout action '{action_req.action}'. Expected 'release' or 'block'.",
            )

        dest_token = (
            payout.payout_account.account_number_token if payout.payout_account else None
        )

        return PayoutResponse(
            payout_id=payout.id,
            rider_id=payout.rider_id,
            amount=payout.amount,
            currency=payout.currency,
            status=payout.status,
            risk_at_request=payout.risk_at_request or 0.0,
            reason=payout.reason or "",
            release_requires=payout.release_requires or "none",
            destination_account_token=dest_token,
            challenge_id=payout.challenge_id,
            session_id=payout.session_id,
            created_at=payout.created_at.isoformat(),
            updated_at=payout.updated_at.isoformat(),
        )

    # --------------------------------------------------------------------------
    # 6. Biometric Liveness Verification Cascade Hook
    # --------------------------------------------------------------------------

    def handle_liveness_verified(
        self,
        db: Session,
        rider_id: str,
        challenge_id: Optional[str] = None,
        now: Optional[datetime] = None,
    ) -> List[PayoutRequest]:
        """
        Invoked when a rider successfully completes a biometric face liveness challenge.
        Updates held payout records:
        - If release_requires == 'liveness_selfie': automatically releases payout.
        - If release_requires == 'liveness_selfie+analyst_approval': records liveness_verified_at,
          keeping status HELD until analyst signs off.
        """
        current_time = now or utcnow()
        query = db.query(PayoutRequest).filter(
            PayoutRequest.rider_id == rider_id,
            PayoutRequest.status == "HELD",
        )
        if challenge_id:
            query = query.filter(PayoutRequest.challenge_id == challenge_id)

        held_payouts = query.all()
        released_payouts: List[PayoutRequest] = []

        for p in held_payouts:
            p.liveness_verified_at = current_time
            reqs = (p.release_requires or "").lower()

            if reqs == "liveness_selfie":
                # Single-factor hold can be automatically released upon verified liveness
                p.status = "RELEASED"
                p.reason = "Payout released: Facial liveness verification successfully confirmed."
                p.updated_at = current_time
                released_payouts.append(p)

                audit_service.log(
                    db=db,
                    actor="system",
                    role="system",
                    action="PAYOUT_RELEASED",
                    entity_type="payout_request",
                    entity_id=p.id,
                    detail=f"Payout {p.id} automatically released after verified facial liveness.",
                )
            else:
                # Multi-factor hold (protection window or prior block) requires analyst sign-off
                p.reason = (
                    "Facial liveness verified. Awaiting mandatory analyst review under 24h protection window."
                )
                p.updated_at = current_time

                audit_service.log(
                    db=db,
                    actor="system",
                    role="system",
                    action="PAYOUT_LIVENESS_VERIFIED",
                    entity_type="payout_request",
                    entity_id=p.id,
                    detail=f"Payout {p.id} liveness verified. Awaiting analyst sign-off.",
                )

        db.commit()
        return released_payouts


payout_service = PayoutService()
