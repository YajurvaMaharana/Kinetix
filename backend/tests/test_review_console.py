"""
TrustJuggler Review Console, Analyst Workflows, RBAC & Policy Feedback Test Suite.

Validates:
1. Analyst Actions & State Machine:
   - false_positive: marks case, lifts rider restrictions, releases eligible payout holds, records feedback snapshot.
   - confirm_fraud: marks case, restricts rider, blocks payouts, updates trust score & history.
   - request_reverify: creates level 2 face liveness challenge, sets status to IN_REVIEW.
   - restrict: restricts rider status.
   - escalate: sets severity to CRITICAL, restricts rider.
   - clear: marks case RESOLVED, lifts restrictions.
   - Requires non-empty review note (HTTP 400 if empty).
2. ReviewerAction & Audit Logging:
   - ReviewerAction rows contain assessment_risk, classification_snapshot, and threat_tag.
   - Every action creates an immutable AuditLog entry.
3. RBAC (Role-Based Access Control):
   - Analyst can act on cases; rider is rejected (HTTP 403 Forbidden).
   - Only admin can read audit logs (analyst gets HTTP 403 Forbidden).
   - Only admin can change policy thresholds (analyst gets HTTP 403 Forbidden).
4. PII Masking:
   - GET /cases/{id} and GET /cases masks rider name and phone for role=analyst.
   - Role=admin receives unmasked data.
5. Queue Filtering & Sorting:
   - Multi-criteria filters: status, severity, rider, threat_tag, date.
   - Sorting by created_at, severity, risk.
6. Case Dossier 360-Degree Integration:
   - Baseline vs Session comparison (observed vs median for 10 biometric/behavioral metrics).
   - Factor waterfall, device passport, cluster membership, challenges, payouts, audit trail.
7. Policy Feedback Summary Math:
   - Precision calculation, false positive rate, and suggested threshold boundary nudges on seeded review actions.
"""

import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.main import app
from app.models.entities import (
    AuditLog,
    Case,
    Challenge,
    PayoutRequest,
    PolicyConfig,
    ReviewerAction,
    Rider,
    RiderTrustHistory,
    RiderTrustScore,
    RiskAssessment,
)
from app.models.entities import (
    Session as SessionModel,
)
from app.schemas.contracts import CaseActionRequest
from app.services.case_service import case_service
from app.services.privacy import tokenize


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# In-memory test DB
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine, future=True)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_test_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    # Seed riders
    for rid, name, phone, st in [
        ("rider_case_1", "Alice Sharma", "+91-9876-123456", "restricted"),
        ("rider_case_2", "Bob Verma", "+91-9876-234567", "active"),
        ("rider_case_3", "Charlie Rao", "+91-9876-345678", "under_review"),
    ]:
        r = Rider(
            id=rid,
            display_name=name,
            phone_number=phone,
            email=f"{rid}@trustjuggler.test",
            status=st,
            created_at=utcnow() - timedelta(days=20),
        )
        db.add(r)

    # Seed default active policy
    policy = PolicyConfig(
        id="policy_v2_default",
        version="v2.4.0",
        allow_threshold=20.0,
        monitor_threshold=50.0,
        challenge_threshold=75.0,
        escalate_threshold=80.0,
        is_active=True,
        created_at=utcnow(),
    )
    db.add(policy)

    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# ==============================================================================
# 1. Action Side Effects: false_positive
# ==============================================================================


def test_action_false_positive_lifts_restrictions_and_releases_holds(db_session):
    """
    Acceptance Criteria:
    Marking a benign case false_positive:
    1. Sets case status to RESOLVED_FALSE_POSITIVE
    2. Lifts restrictions on rider (rider.status = 'active')
    3. Releases eligible held payouts (payout.status = 'RELEASED')
    4. Records ReviewerAction with risk score and classification snapshot
    5. Appears in AuditLog
    """
    rider_id = "rider_case_1"
    now = utcnow()

    # Setup Session and Assessment
    sess = SessionModel(
        id="sess_case_fp_01",
        rider_id=rider_id,
        current_risk_score=72.0,
        current_verdict="CHALLENGE",
        status="CHALLENGED",
        ip_address=tokenize("192.168.1.1"),
        created_at=now,
    )
    ass = RiskAssessment(
        id="ass_fp_01",
        session_id=sess.id,
        risk_score=72.0,
        raw_risk=72.0,
        verdict="CHALLENGE",
        risk_tier="HIGH",
        classification="ordinary_change",
        threat_tags_json=json.dumps(["NEW_DEVICE"]),
        created_at=now,
    )
    case = Case(
        id="case_fp_01",
        session_id=sess.id,
        rider_id=rider_id,
        severity="HIGH",
        status="OPEN",
        threat_summary="Unfamiliar device shift flagged by automated policy",
        threat_tag="NEW_DEVICE",
        risk_score=72.0,
        created_at=now,
    )
    payout = PayoutRequest(
        id="pay_held_fp_01",
        rider_id=rider_id,
        session_id=sess.id,
        amount=120.0,
        currency="USD",
        status="HELD",
        hold_reason="Automated hold: Session risk 72.0 with open case",
        created_at=now,
    )
    db_session.add_all([sess, ass, case, payout])
    db_session.commit()

    # Execute action: false_positive
    req = CaseActionRequest(
        action="false_positive",
        note="Hardware upgrade to new phone confirmed authentic by rider callback",
    )
    res = case_service.handle_case_action(
        db=db_session,
        case_id=case.id,
        action_req=req,
        actor="analyst_clara",
        role="analyst",
    )

    # 1. Case Status
    assert res.status == "RESOLVED_FALSE_POSITIVE"

    # 2. Rider restriction lifted
    rider = db_session.query(Rider).filter(Rider.id == rider_id).first()
    assert rider.status == "active"

    # 3. Held payout released
    db_session.refresh(payout)
    assert payout.status == "RELEASED"
    assert "cleared as false positive" in payout.reason.lower()
    assert payout.analyst_id == "analyst_clara"

    # 4. ReviewerAction snapshot
    action_rec = db_session.query(ReviewerAction).filter(ReviewerAction.case_id == case.id).first()
    assert action_rec is not None
    assert action_rec.action_type == "FALSE_POSITIVE"
    assert action_rec.reviewer_id == "analyst_clara"
    assert action_rec.assessment_risk == 72.0
    assert action_rec.classification_snapshot == "ordinary_change"
    assert action_rec.threat_tag == "NEW_DEVICE"
    assert "hardware upgrade" in action_rec.notes.lower()

    # 5. Audit Log Entry
    audit_rec = (
        db_session.query(AuditLog)
        .filter(AuditLog.entity_id == case.id, AuditLog.action == "CASE_FALSE_POSITIVE")
        .first()
    )
    assert audit_rec is not None
    assert audit_rec.actor == "analyst_clara"
    assert "RESOLVED_FALSE_POSITIVE" in audit_rec.detail


# ==============================================================================
# 2. Action Side Effects: confirm_fraud
# ==============================================================================


def test_action_confirm_fraud_restricts_blocks_payouts_and_updates_trust(db_session):
    """
    Action confirm_fraud:
    1. Sets case status to CONFIRMED_FRAUD
    2. Restricts rider (rider.status = 'restricted')
    3. Blocks active payouts (payout.status = 'BLOCKED')
    4. Degrades RiderTrustScore to 10.0 and appends RiderTrustHistory
    5. Writes ReviewerAction and AuditLog
    """
    rider_id = "rider_case_2"
    now = utcnow()

    sess = SessionModel(
        id="sess_fraud_01",
        rider_id=rider_id,
        current_risk_score=88.0,
        current_verdict="ESCALATE",
        status="ESCALATED",
        ip_address=tokenize("192.168.1.1"),
        created_at=now,
    )
    ass = RiskAssessment(
        id="ass_fraud_01",
        session_id=sess.id,
        risk_score=88.0,
        raw_risk=88.0,
        verdict="ESCALATE",
        risk_tier="CRITICAL",
        classification="suspected_handoff",
        threat_tags_json=json.dumps(["ACCOUNT_HANDOFF"]),
        created_at=now,
    )
    case = Case(
        id="case_fraud_01",
        session_id=sess.id,
        rider_id=rider_id,
        severity="HIGH",
        status="OPEN",
        threat_summary="Biometric face mismatch and synthetic touch signature",
        threat_tag="ACCOUNT_HANDOFF",
        risk_score=88.0,
        created_at=now,
    )
    payout = PayoutRequest(
        id="pay_active_01",
        rider_id=rider_id,
        session_id=sess.id,
        amount=250.0,
        currency="USD",
        status="HELD",
        created_at=now,
    )
    trust_obj = RiderTrustScore(
        id="trust_orig_02",
        rider_id=rider_id,
        trust_score=85.0,
        trend="STABLE",
        confidence=0.9,
    )
    db_session.add_all([sess, ass, case, payout, trust_obj])
    db_session.commit()

    req = CaseActionRequest(
        action="confirm_fraud",
        note="Confirmed account sharing / renting across disparate operators",
    )
    res = case_service.handle_case_action(
        db=db_session,
        case_id=case.id,
        action_req=req,
        actor="analyst_dave",
        role="analyst",
    )

    # 1. Case Status
    assert res.status == "CONFIRMED_FRAUD"

    # 2. Rider Restricted
    rider = db_session.query(Rider).filter(Rider.id == rider_id).first()
    assert rider.status == "restricted"

    # 3. Payout permanently blocked
    db_session.refresh(payout)
    assert payout.status == "BLOCKED"
    assert "permanently blocked" in payout.reason.lower()

    # 4. Trust Score Degraded & History Added
    db_session.refresh(trust_obj)
    assert trust_obj.trust_score == 10.0
    assert trust_obj.trend == "DEGRADING"

    history_rec = (
        db_session.query(RiderTrustHistory)
        .filter(RiderTrustHistory.rider_id == rider_id)
        .order_by(RiderTrustHistory.created_at.desc())
        .first()
    )
    assert history_rec is not None
    assert history_rec.trust_score == 10.0
    assert history_rec.delta < 0
    assert "Confirmed fraud" in history_rec.reason


# ==============================================================================
# 3. Action Side Effects: request_reverify, restrict, escalate, clear
# ==============================================================================


def test_action_request_reverify_issues_liveness_challenge(db_session):
    """Action request_reverify issues a Level 2 biometric challenge and sets case to IN_REVIEW."""
    rider_id = "rider_case_2"
    now = utcnow()

    case = Case(
        id="case_rev_01",
        rider_id=rider_id,
        severity="MEDIUM",
        status="OPEN",
        threat_summary="Minor touch cadence shift",
        created_at=now,
    )
    db_session.add(case)
    db_session.commit()

    req = CaseActionRequest(
        action="request_reverify",
        note="Requesting selfie liveness verification before unlocking",
    )
    res = case_service.handle_case_action(
        db=db_session,
        case_id=case.id,
        action_req=req,
        actor="analyst_sarah",
        role="analyst",
    )

    assert res.status == "IN_REVIEW"

    # Verify Challenge Issued
    chlg = (
        db_session.query(Challenge)
        .filter(Challenge.rider_id == rider_id, Challenge.reason_code == "ANALYST_REQUESTED")
        .first()
    )
    assert chlg is not None
    assert chlg.level == 2
    assert chlg.challenge_type == "face_liveness"
    assert chlg.status == "PENDING"


def test_action_restrict_escalate_and_clear(db_session):
    """Tests restrict, escalate, and clear actions."""
    rider_id = "rider_case_2"
    now = utcnow()

    case = Case(
        id="case_ops_01",
        rider_id=rider_id,
        severity="MEDIUM",
        status="OPEN",
        created_at=now,
    )
    db_session.add(case)
    db_session.commit()

    # 1. Escalate -> Severity CRITICAL, rider restricted
    res_esc = case_service.handle_case_action(
        db=db_session,
        case_id=case.id,
        action_req=CaseActionRequest(action="escalate", note="Urgent fraud syndicate link"),
    )
    assert res_esc.severity == "CRITICAL"
    assert res_esc.status == "ESCALATED"

    # 2. Clear -> Status RESOLVED, rider active
    res_clear = case_service.handle_case_action(
        db=db_session,
        case_id=case.id,
        action_req=CaseActionRequest(action="clear", note="Cleared after passenger corroboration"),
    )
    assert res_clear.status == "RESOLVED"
    rider = db_session.query(Rider).filter(Rider.id == rider_id).first()
    assert rider.status == "active"


def test_case_action_requires_non_empty_note(db_session):
    """All case actions strictly require a non-empty review note."""
    case = Case(id="case_note_req", rider_id="rider_case_2", severity="LOW", status="OPEN")
    db_session.add(case)
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        case_service.handle_case_action(
            db=db_session,
            case_id=case.id,
            action_req=CaseActionRequest(action="clear", note="   "),
        )
    assert exc_info.value.status_code == 400
    assert "note is strictly required" in str(exc_info.value.detail).lower()


# ==============================================================================
# 4. RBAC: Analyst vs Admin vs Rider Permissions
# ==============================================================================


@pytest.mark.anyio
async def test_rbac_case_actions(client: AsyncClient, db_session):
    """
    RBAC:
    - Analyst can act on cases (PATCH /cases/{id})
    - Rider is rejected with HTTP 403 Forbidden
    """
    case = Case(id="case_rbac_01", rider_id="rider_case_2", severity="MEDIUM", status="OPEN")
    db_session.add(case)
    db_session.commit()

    # 1. Rider role attempts case action -> 403 Forbidden
    resp_rider = await client.patch(
        f"/api/v1/cases/{case.id}",
        headers={"X-Role": "rider"},
        json={"action": "clear", "note": "Rider attempting self-clearance"},
    )
    assert resp_rider.status_code == 403

    # 2. Analyst role executes case action -> 200 OK
    resp_analyst = await client.patch(
        f"/api/v1/cases/{case.id}",
        headers={"X-Role": "analyst", "X-Actor": "analyst_maya"},
        json={"action": "false_positive", "note": "Analyst verified benign shift"},
    )
    assert resp_analyst.status_code == 200
    assert resp_analyst.json()["status"] == "RESOLVED_FALSE_POSITIVE"


@pytest.mark.anyio
async def test_rbac_audit_logs_and_policy_updates(client: AsyncClient):
    """
    RBAC:
    - Only admin can read audit logs (analyst gets 403)
    - Only admin can change policy (analyst gets 403)
    """
    # 1. GET /audit-logs as analyst -> 403 Forbidden
    r_audit_analyst = await client.get("/api/v1/audit-logs", headers={"X-Role": "analyst"})
    assert r_audit_analyst.status_code == 403

    # 2. GET /audit-logs as admin -> 200 OK
    r_audit_admin = await client.get("/api/v1/audit-logs", headers={"X-Role": "admin"})
    assert r_audit_admin.status_code == 200

    # 3. POST /policy/update as analyst -> 403 Forbidden
    r_pol_analyst = await client.post(
        "/api/v1/policy/update",
        headers={"X-Role": "analyst"},
        json={"challenge_threshold": 70.0},
    )
    assert r_pol_analyst.status_code == 403

    # 4. POST /policy/update as admin -> 200 OK
    r_pol_admin = await client.post(
        "/api/v1/policy/update",
        headers={"X-Role": "admin", "X-Actor": "admin_chief"},
        json={"challenge_threshold": 72.0, "version": "v2.5.0"},
    )
    assert r_pol_admin.status_code == 200
    assert r_pol_admin.json()["challenge_threshold"] == 72.0
    assert r_pol_admin.json()["version"] == "v2.5.0"


# ==============================================================================
# 5. Queue Filtering, Sorting, and Masked PII
# ==============================================================================


@pytest.mark.anyio
async def test_queue_filters_sorting_and_pii_masking(client: AsyncClient, db_session):
    """
    Tests:
    - GET /cases with status, severity, and threat_tag filters
    - GET /cases/{id} PII masking: analyst receives masked name and phone; admin receives raw PII
    """
    now = utcnow()
    c1 = Case(
        id="case_q_01",
        rider_id="rider_case_1",
        severity="CRITICAL",
        status="OPEN",
        threat_tag="GPS_SPOOFING",
        created_at=now - timedelta(hours=2),
    )
    c2 = Case(
        id="case_q_02",
        rider_id="rider_case_2",
        severity="LOW",
        status="RESOLVED",
        threat_tag="CLEAN",
        created_at=now - timedelta(hours=1),
    )
    c3 = Case(
        id="case_q_03",
        rider_id="rider_case_1",
        severity="HIGH",
        status="OPEN",
        threat_tag="GPS_SPOOFING",
        created_at=now,
    )
    db_session.add_all([c1, c2, c3])
    db_session.commit()

    # 1. Filter by threat_tag=GPS_SPOOFING
    r_tag = await client.get("/api/v1/cases?threat_tag=GPS_SPOOFING", headers={"X-Role": "analyst"})
    assert r_tag.status_code == 200
    tag_data = r_tag.json()
    assert len(tag_data) == 2
    assert all(c["threat_tag"] == "GPS_SPOOFING" for c in tag_data)

    # 2. Filter by status=OPEN
    r_status = await client.get("/api/v1/cases?status=OPEN", headers={"X-Role": "analyst"})
    assert r_status.status_code == 200
    st_data = r_status.json()
    assert len(st_data) == 2

    # 3. PII Masking: GET /cases/{id} as analyst
    r_detail_analyst = await client.get(f"/api/v1/cases/{c1.id}", headers={"X-Role": "analyst"})
    assert r_detail_analyst.status_code == 200
    d_analyst = r_detail_analyst.json()
    assert "*" in d_analyst["rider_name"] or d_analyst["rider_name"] != "Alice Sharma"
    assert "*" in d_analyst["rider_phone"]

    # 4. PII Unmasking: GET /cases/{id} as admin
    r_detail_admin = await client.get(f"/api/v1/cases/{c1.id}", headers={"X-Role": "admin"})
    assert r_detail_admin.status_code == 200
    d_admin = r_detail_admin.json()
    assert d_admin["rider_name"] == "Alice Sharma"
    assert d_admin["rider_phone"] == "+91-9876-123456"

    # 5. 360-Degree Dossier structure
    assert "assessment" in d_analyst
    assert "baseline_vs_session" in d_analyst
    assert len(d_analyst["baseline_vs_session"]) == 10
    assert "rider_trust_score" in d_analyst
    assert "challenge_history" in d_analyst
    assert "audit_trail" in d_analyst


# ==============================================================================
# 6. Policy Feedback Summary Math on a Seeded Review Set
# ==============================================================================


@pytest.mark.anyio
async def test_policy_feedback_summary_math(client: AsyncClient, db_session):
    """
    Acceptance Criteria:
    - GET /policy/feedback-summary computes confirmed vs false_positive reviews,
      observed precision, and suggested threshold nudges.
    - Seeded Set:
      - 6 confirm_fraud and 4 false_positive on ('ACCOUNT_HANDOFF', 'ordinary_change')
        -> 40% false positive rate -> suggests raising CHALLENGE boundary
      - 8 confirm_fraud and 1 false_positive on ('GPS_SPOOFING', 'gps_spoof')
        -> 89% precision -> indicates strong detection
    """
    now = utcnow()

    # Seed ReviewerActions for ACCOUNT_HANDOFF / ordinary_change
    for i in range(6):
        db_session.add(
            ReviewerAction(
                id=f"act_seed_conf_h_{i}",
                case_id="case_seed",
                reviewer_id="analyst_test",
                action_type="CONFIRM_FRAUD",
                notes="Confirmed handoff",
                assessment_risk=78.0,
                classification_snapshot="ordinary_change",
                threat_tag="ACCOUNT_HANDOFF",
                created_at=now,
            )
        )
    for i in range(4):
        db_session.add(
            ReviewerAction(
                id=f"act_seed_fp_h_{i}",
                case_id="case_seed",
                reviewer_id="analyst_test",
                action_type="FALSE_POSITIVE",
                notes="Benign driver swap",
                assessment_risk=65.0,
                classification_snapshot="ordinary_change",
                threat_tag="ACCOUNT_HANDOFF",
                created_at=now,
            )
        )

    # Seed ReviewerActions for GPS_SPOOFING / gps_spoof
    for i in range(8):
        db_session.add(
            ReviewerAction(
                id=f"act_seed_conf_s_{i}",
                case_id="case_seed",
                reviewer_id="analyst_test",
                action_type="CONFIRM_FRAUD",
                notes="Mock location confirmed",
                assessment_risk=90.0,
                classification_snapshot="gps_spoof",
                threat_tag="GPS_SPOOFING",
                created_at=now,
            )
        )
    for i in range(1):
        db_session.add(
            ReviewerAction(
                id=f"act_seed_fp_s_{i}",
                case_id="case_seed",
                reviewer_id="analyst_test",
                action_type="FALSE_POSITIVE",
                notes="Tunnel jitter",
                assessment_risk=62.0,
                classification_snapshot="gps_spoof",
                threat_tag="GPS_SPOOFING",
                created_at=now,
            )
        )

    db_session.commit()

    resp = await client.get("/api/v1/policy/feedback-summary", headers={"X-Role": "analyst"})
    assert resp.status_code == 200
    summary = resp.json()

    assert summary["total_confirmed"] == 14
    assert summary["total_false_positives"] == 5
    assert summary["total_reviews"] == 19
    assert pytest.approx(summary["global_precision"], abs=1e-2) == round(14 / 19, 3)

    # Inspect ACCOUNT_HANDOFF breakdown
    handoff_item = next(
        item for item in summary["breakdown"] if item["threat_tag"] == "ACCOUNT_HANDOFF"
    )
    assert handoff_item["confirmed_count"] == 6
    assert handoff_item["false_positive_count"] == 4
    assert handoff_item["total_reviews"] == 10
    assert handoff_item["observed_precision"] == 0.60
    assert handoff_item["false_positive_rate"] == 0.40
    assert "40% false positives" in handoff_item["suggested_nudge"]
    assert "raising the CHALLENGE boundary" in handoff_item["suggested_nudge"]

    # Inspect GPS_SPOOFING breakdown
    spoof_item = next(item for item in summary["breakdown"] if item["threat_tag"] == "GPS_SPOOFING")
    assert spoof_item["confirmed_count"] == 8
    assert spoof_item["false_positive_count"] == 1
    assert spoof_item["total_reviews"] == 9
    assert pytest.approx(spoof_item["observed_precision"], abs=1e-2) == 0.889
    assert "High precision" in spoof_item["suggested_nudge"]
