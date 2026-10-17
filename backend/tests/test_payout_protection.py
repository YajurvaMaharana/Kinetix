"""
TrustJuggler Payout Protection & Escrow Gating Test Suite.

Validates:
1. Payout Account Tracking:
   - Tracks payout_accounts (account_token, set_at, is_current).
   - Starts 24-hour protection window upon account update or creation.
2. Payout Risk Evaluation:
   - evaluate_payout(request, assessment, rider_state) -> approved | held | blocked.
   - Normal payout approved: risk < 45, established account outside 24h window, normal amount.
   - Payout change then withdrawal held: 24h window active, status=HELD, release_requires="liveness_selfie+analyst_approval".
   - ESCALATE blocks: risk >= 75 or ESCALATE verdict, status=BLOCKED, release_requires="analyst_approval".
   - Open case blocks: active fraud case blocks payout, status=BLOCKED.
   - Cluster membership blocks: syndicate fraud cluster blocks payout, status=BLOCKED.
   - Unusually large amount held: amount > 2.5x rider historical median, status=HELD.
   - New destination held: first disbursement to unverified destination account, status=HELD.
3. Two-Phase Release Protocol:
   - Held payouts with release_requires="liveness_selfie+analyst_approval" reject release without liveness (HTTP 400).
   - Passing liveness records liveness_verified_at.
   - Analyst sign-off via PATCH /payouts/{id} (action="release") transitions payout to RELEASED.
   - Analyst block via PATCH /payouts/{id} (action="block") transitions payout to BLOCKED.
   - Single-factor holds (e.g. high amount) automatically transition to RELEASED upon liveness verification.
4. Audit Trail:
   - Every state transition produces an immutable AuditLog entry with actor, role, and details.
5. Scenario P1 & Attack Generator:
   - Payout hijack scenario (account swap followed by immediate withdrawal) holds payout live with plain-language reason.
6. REST API Endpoints:
   - POST /payouts/request, GET /payouts (with status filter), PATCH /payouts/{id}, and POST /riders/{id}/payout-account.
"""

from datetime import datetime, timedelta, timezone

import numpy as np
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
    FraudCluster,
    PayoutAccount,
    PayoutRequest,
    Rider,
)
from app.schemas.contracts import (
    PayoutActionRequest,
    PayoutRequestCreate,
)
from app.services.payout_service import payout_service
from app.services.privacy import tokenize
from simulator.attacks import make_payout_hijack
from simulator.personas import generate_persona


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# Isolated SQLite test engine with StaticPool
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
    for rid in [
        "rider_norm_01",
        "rider_hijack_01",
        "rider_case_01",
        "rider_ring_01",
        "rider_esc_01",
    ]:
        r = Rider(
            id=rid,
            display_name=rid,
            phone_number="+1-555-0199",
            email=f"{rid}@trustjuggler.test",
            status="active",
            created_at=utcnow() - timedelta(days=30),
        )
        db.add(r)
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
# 1. Unit Tests: evaluate_payout Decision Matrix
# ==============================================================================


def test_normal_payout_approved(db_session):
    """
    Normal payout:
    - Session risk < 45 (e.g. 15.0, ALLOW)
    - Established account outside the 24-hour protection window (set 48h ago)
    - Normal disbursement amount ($45.00)
    -> Result: APPROVED, plain-language reason, release_requires='none'.
    """
    rider_id = "rider_norm_01"
    now = utcnow()
    old_time = now - timedelta(hours=48)

    # Established payout account set 48 hours ago
    acct = PayoutAccount(
        id="pacct_norm_1",
        rider_id=rider_id,
        account_number_token=tokenize("acc_established_999"),
        set_at=old_time,
        is_current=True,
        is_flagged=False,
        created_at=old_time,
    )
    # Historical released payout to establish destination
    hist_payout = PayoutRequest(
        id="pay_hist_1",
        rider_id=rider_id,
        payout_account_id=acct.id,
        amount=50.0,
        currency="USD",
        status="RELEASED",
        created_at=old_time,
    )
    db_session.add_all([acct, hist_payout])
    db_session.commit()

    req = PayoutRequestCreate(
        rider_id=rider_id,
        amount=45.0,
        currency="USD",
        destination_account_token=acct.account_number_token,
    )

    decision = payout_service.evaluate_payout(
        db=db_session,
        request=req,
        rider_state={"risk_score": 18.0, "verdict": "ALLOW"},
        now=now,
    )

    assert decision["status"] == "APPROVED"
    assert decision["risk_at_request"] == 18.0
    assert "approved" in decision["reason"].lower()
    assert decision["release_requires"] == "none"


def test_payout_change_then_withdrawal_held(db_session):
    """
    Account change starts 24h protection window:
    - Payout destination account modified recently (e.g. 10 minutes ago)
    - Subsequent withdrawal evaluated
    -> Result: HELD, plain language reason mentioning 24h window,
       release_requires='liveness_selfie+analyst_approval'.
    """
    rider_id = "rider_norm_01"
    now = utcnow()

    # Modify payout account (starts 24h window)
    new_token = tokenize("acc_new_attacker_123")
    acct = payout_service.set_payout_account(
        db=db_session,
        rider_id=rider_id,
        account_token=new_token,
        actor="rider_norm_01",
        role="rider",
        now=now - timedelta(minutes=10),
    )
    assert acct.is_current is True

    # Check protection window active
    is_active, expires_at = payout_service.get_protection_window(db_session, rider_id, now=now)
    assert is_active is True
    assert expires_at > now

    # Submit withdrawal request
    req = PayoutRequestCreate(
        rider_id=rider_id,
        amount=120.0,
        currency="USD",
        destination_account_token=new_token,
    )

    decision = payout_service.evaluate_payout(
        db=db_session,
        request=req,
        rider_state={"risk_score": 25.0, "verdict": "ALLOW"},
        now=now,
    )

    assert decision["status"] == "HELD"
    assert "24-hour protection window" in decision["reason"]
    assert decision["release_requires"] == "liveness_selfie+analyst_approval"


def test_escalate_risk_blocks_payout(db_session):
    """
    Critical risk / ESCALATE verdict:
    - Session risk >= 75.0 or verdict == 'ESCALATE'
    -> Result: BLOCKED, plain language reason, release_requires='analyst_approval'.
    """
    rider_id = "rider_esc_01"
    now = utcnow()

    req = PayoutRequestCreate(
        rider_id=rider_id,
        amount=50.0,
        currency="USD",
    )

    decision = payout_service.evaluate_payout(
        db=db_session,
        request=req,
        rider_state={"risk_score": 82.5, "verdict": "ESCALATE"},
        now=now,
    )

    assert decision["status"] == "BLOCKED"
    assert decision["risk_at_request"] == 82.5
    assert "blocked" in decision["reason"].lower()
    assert "critical escalation tier" in decision["reason"].lower()
    assert decision["release_requires"] == "analyst_approval"


def test_open_case_blocks_payout(db_session):
    """
    Active fraud investigation case:
    - Rider has an open fraud case
    -> Result: BLOCKED, plain language reason mentioning the open case ID.
    """
    rider_id = "rider_case_01"
    now = utcnow()

    case = Case(
        id="case_fraud_open_1",
        session_id="sess_suspect_01",
        rider_id=rider_id,
        severity="HIGH",
        status="OPEN",
        threat_summary="Suspected account sharing and GPS manipulation",
        created_at=now,
        updated_at=now,
    )
    db_session.add(case)
    db_session.commit()

    req = PayoutRequestCreate(
        rider_id=rider_id,
        amount=60.0,
        currency="USD",
    )

    # Even with low session risk, open case must block payout
    decision = payout_service.evaluate_payout(
        db=db_session,
        request=req,
        rider_state={"risk_score": 15.0, "verdict": "ALLOW"},
        now=now,
    )

    assert decision["status"] == "BLOCKED"
    assert "active fraud investigation case" in decision["reason"].lower()
    assert "case_fraud_open_1" in decision["reason"]
    assert decision["release_requires"] == "analyst_approval"


def test_cluster_membership_blocks_payout(db_session):
    """
    Syndicate fraud ring cluster membership:
    - Rider is an active member in FraudCluster
    -> Result: BLOCKED, plain language explanation citing organized syndicate fraud ring.
    """
    rider_id = "rider_ring_01"
    now = utcnow()

    cluster = FraudCluster(
        id="cluster_syndicate_99",
        name="Redmi Emulator Mule Cluster",
        shared_identifiers=f"['dev_emu_99', '{rider_id}', 'pacct_mule_99']",
        risk_score=0.95,
        status="ACTIVE",
        created_at=now,
    )
    db_session.add(cluster)
    db_session.commit()

    req = PayoutRequestCreate(
        rider_id=rider_id,
        amount=40.0,
        currency="USD",
    )

    decision = payout_service.evaluate_payout(
        db=db_session,
        request=req,
        rider_state={"risk_score": 20.0, "verdict": "ALLOW"},
        now=now,
    )

    assert decision["status"] == "BLOCKED"
    assert "organized syndicate fraud ring" in decision["reason"].lower()
    assert decision["release_requires"] == "analyst_approval"


def test_unusually_large_amount_held(db_session):
    """
    Unusually high disbursement amount:
    - Historical median payout is $50.00
    - Rider requests $300.00 (> 2.5x median of $50)
    - Account established > 24h ago
    -> Result: HELD, plain language explanation citing historical median,
       release_requires='liveness_selfie'.
    """
    rider_id = "rider_norm_01"
    now = utcnow()
    old_time = now - timedelta(days=10)

    acct = PayoutAccount(
        id="pacct_estab_1",
        rider_id=rider_id,
        account_number_token=tokenize("acc_estab_111"),
        set_at=old_time,
        is_current=True,
        is_flagged=False,
        created_at=old_time,
    )
    # Seed 3 historical payouts: $45, $50, $55 -> median = $50
    p1 = PayoutRequest(
        id="pay_h1",
        rider_id=rider_id,
        payout_account_id=acct.id,
        amount=45.0,
        status="RELEASED",
        created_at=old_time,
    )
    p2 = PayoutRequest(
        id="pay_h2",
        rider_id=rider_id,
        payout_account_id=acct.id,
        amount=50.0,
        status="RELEASED",
        created_at=old_time,
    )
    p3 = PayoutRequest(
        id="pay_h3",
        rider_id=rider_id,
        payout_account_id=acct.id,
        amount=55.0,
        status="RELEASED",
        created_at=old_time,
    )
    db_session.add_all([acct, p1, p2, p3])
    db_session.commit()

    median = payout_service.get_rider_median_payout(db_session, rider_id)
    assert median == 50.0

    # Request $300 (6x median)
    req = PayoutRequestCreate(
        rider_id=rider_id,
        amount=300.0,
        currency="USD",
        destination_account_token=acct.account_number_token,
    )

    decision = payout_service.evaluate_payout(
        db=db_session,
        request=req,
        rider_state={"risk_score": 20.0, "verdict": "ALLOW"},
        now=now,
    )

    assert decision["status"] == "HELD"
    assert "unusually high" in decision["reason"].lower()
    assert "$50.00" in decision["reason"]
    assert decision["release_requires"] == "liveness_selfie"


def test_new_destination_held(db_session):
    """
    New destination account:
    - Account established > 24h ago
    - Disbursement requested to a newly introduced account token
    -> Result: HELD, reason explains newly registered destination,
       release_requires='liveness_selfie'.
    """
    rider_id = "rider_norm_01"
    now = utcnow()
    old_time = now - timedelta(days=5)

    acct = PayoutAccount(
        id="pacct_old_1",
        rider_id=rider_id,
        account_number_token=tokenize("acc_old_primary"),
        set_at=old_time,
        is_current=True,
        created_at=old_time,
    )
    p_old = PayoutRequest(
        id="pay_old_1",
        rider_id=rider_id,
        payout_account_id=acct.id,
        amount=50.0,
        status="RELEASED",
        created_at=old_time,
    )
    db_session.add_all([acct, p_old])
    db_session.commit()

    brand_new_token = tokenize("acc_brand_new_dest_888")
    req = PayoutRequestCreate(
        rider_id=rider_id,
        amount=40.0,
        currency="USD",
        destination_account_token=brand_new_token,
    )

    decision = payout_service.evaluate_payout(
        db=db_session,
        request=req,
        rider_state={"risk_score": 15.0, "verdict": "ALLOW"},
        now=now,
    )

    assert decision["status"] == "HELD"
    assert "newly registered destination account" in decision["reason"].lower()
    assert decision["release_requires"] == "liveness_selfie"


# ==============================================================================
# 2. Integration & Release Protocol Tests
# ==============================================================================


def test_release_needs_verification_plus_analyst(db_session):
    """
    Two-Phase Release Requirement:
    - Payout held under 24h protection window (release_requires="liveness_selfie+analyst_approval")
    1. Analyst cannot release before liveness selfie is completed (HTTP 400).
    2. Completing liveness populates liveness_verified_at but leaves status HELD.
    3. Analyst clearance via handle_payout_action(action="release") transitions status to RELEASED.
    """
    rider_id = "rider_hijack_01"
    now = utcnow()

    # Step 1: Change payout account to activate protection window
    new_token = tokenize("acc_stolen_dest_999")
    payout_service.set_payout_account(
        db=db_session,
        rider_id=rider_id,
        account_token=new_token,
        actor=rider_id,
        role="rider",
        now=now,
    )

    # Step 2: Request payout
    req_payload = PayoutRequestCreate(
        rider_id=rider_id,
        amount=150.0,
        currency="USD",
        destination_account_token=new_token,
    )
    resp = payout_service.request_payout(
        db=db_session,
        payload=req_payload,
        actor=rider_id,
        role="rider",
        now=now,
    )
    payout_id = resp.payout_id
    assert resp.status == "HELD"
    assert resp.release_requires == "liveness_selfie+analyst_approval"
    assert resp.challenge_id is not None

    # Step 3: Attempt release without liveness verification -> Must fail with 400
    with pytest.raises(HTTPException) as exc_info:
        payout_service.handle_payout_action(
            db=db_session,
            payout_id=payout_id,
            action_req=PayoutActionRequest(action="release", notes="Analyst premature release"),
            actor="analyst_alice",
            role="analyst",
            now=now,
        )
    assert exc_info.value.status_code == 400
    assert "facial liveness verification" in str(exc_info.value.detail).lower()

    # Verify payout is still HELD
    p_check = db_session.query(PayoutRequest).filter(PayoutRequest.id == payout_id).first()
    assert p_check.status == "HELD"
    assert p_check.liveness_verified_at is None

    # Step 4: Simulate passed liveness verification
    released = payout_service.handle_liveness_verified(
        db=db_session,
        rider_id=rider_id,
        challenge_id=resp.challenge_id,
        now=now + timedelta(minutes=5),
    )
    # Because it requires analyst approval, it should NOT be auto-released
    assert len(released) == 0

    db_session.refresh(p_check)
    assert p_check.status == "HELD"
    assert p_check.liveness_verified_at is not None
    assert "awaiting mandatory analyst review" in p_check.reason.lower()

    # Step 5: Analyst signs off -> Successfully moves to RELEASED
    final_resp = payout_service.handle_payout_action(
        db=db_session,
        payout_id=payout_id,
        action_req=PayoutActionRequest(
            action="release", notes="Identity confirmed via selfie audit"
        ),
        actor="analyst_alice",
        role="analyst",
        now=now + timedelta(minutes=10),
    )
    assert final_resp.status == "RELEASED"

    db_session.refresh(p_check)
    assert p_check.status == "RELEASED"
    assert p_check.analyst_id == "analyst_alice"
    assert p_check.analyst_approved_at is not None


def test_single_factor_liveness_auto_release(db_session):
    """
    Single-factor hold (e.g. unusually high amount):
    - Payout held with release_requires="liveness_selfie"
    - When handle_liveness_verified is called, status automatically transitions to RELEASED.
    """
    rider_id = "rider_norm_01"
    now = utcnow()
    old_time = now - timedelta(days=10)

    acct = PayoutAccount(
        id="pacct_single_fac",
        rider_id=rider_id,
        account_number_token=tokenize("acc_single_fac"),
        set_at=old_time,
        is_current=True,
        created_at=old_time,
    )
    p_past = PayoutRequest(
        id="pay_prev_1",
        rider_id=rider_id,
        payout_account_id=acct.id,
        amount=40.0,
        status="RELEASED",
        created_at=old_time,
    )
    db_session.add_all([acct, p_past])
    db_session.commit()

    # Request high amount ($500) -> triggers single-factor liveness hold
    req = PayoutRequestCreate(
        rider_id=rider_id,
        amount=500.0,
        currency="USD",
        destination_account_token=acct.account_number_token,
    )
    payout_resp = payout_service.request_payout(
        db=db_session, payload=req, actor=rider_id, role="rider", now=now
    )
    assert payout_resp.status == "HELD"
    assert payout_resp.release_requires == "liveness_selfie"

    # Complete liveness check -> Auto-releases
    released_list = payout_service.handle_liveness_verified(
        db=db_session,
        rider_id=rider_id,
        challenge_id=payout_resp.challenge_id,
        now=now + timedelta(minutes=3),
    )
    assert len(released_list) == 1
    assert released_list[0].id == payout_resp.payout_id
    assert released_list[0].status == "RELEASED"


def test_payout_action_block(db_session):
    """Analyst can permanently block a held payout."""
    rider_id = "rider_norm_01"
    now = utcnow()

    req = PayoutRequestCreate(
        rider_id=rider_id,
        amount=500.0,
        currency="USD",
    )
    resp = payout_service.request_payout(db=db_session, payload=req, now=now)
    assert resp.status == "HELD"

    blocked_resp = payout_service.handle_payout_action(
        db=db_session,
        payout_id=resp.payout_id,
        action_req=PayoutActionRequest(action="block", notes="Fraud syndicate pattern confirmed"),
        actor="analyst_charlie",
        role="analyst",
        now=now,
    )
    assert blocked_resp.status == "BLOCKED"

    p = db_session.query(PayoutRequest).filter(PayoutRequest.id == resp.payout_id).first()
    assert p.status == "BLOCKED"
    assert p.analyst_id == "analyst_charlie"


# ==============================================================================
# 3. Audit Log Entries for All State Transitions
# ==============================================================================


def test_audit_log_entries_for_all_transitions(db_session):
    """
    Every transition must create an immutable AuditLog entry:
    - PAYOUT_ACCOUNT_UPDATED
    - PAYOUT_HELD
    - PAYOUT_LIVENESS_VERIFIED
    - PAYOUT_RELEASED
    - PAYOUT_BLOCKED
    """
    rider_id = "rider_audit_test"
    r = Rider(
        id=rider_id, display_name=rider_id, phone_number="+1-555-0100", email="audit@test.com"
    )
    db_session.add(r)
    db_session.commit()

    now = utcnow()

    # 1. Update payout account -> PAYOUT_ACCOUNT_UPDATED
    acct = payout_service.set_payout_account(
        db=db_session,
        rider_id=rider_id,
        account_token=tokenize("acc_audit_1"),
        actor="rider_audit_test",
        role="rider",
        now=now,
    )
    logs_acct = db_session.query(AuditLog).filter(AuditLog.action == "PAYOUT_ACCOUNT_UPDATED").all()
    assert len(logs_acct) >= 1
    assert "24h protection window activated" in logs_acct[-1].detail

    # 2. Request payout within window -> PAYOUT_HELD
    req = PayoutRequestCreate(
        rider_id=rider_id, amount=100.0, destination_account_token=acct.account_number_token
    )
    p_resp = payout_service.request_payout(db=db_session, payload=req, now=now)
    logs_held = db_session.query(AuditLog).filter(AuditLog.action == "PAYOUT_HELD").all()
    assert len(logs_held) >= 1
    assert p_resp.payout_id in logs_held[-1].entity_id

    # 3. Verify liveness -> PAYOUT_LIVENESS_VERIFIED
    payout_service.handle_liveness_verified(
        db=db_session,
        rider_id=rider_id,
        challenge_id=p_resp.challenge_id,
        now=now + timedelta(minutes=2),
    )
    logs_live = (
        db_session.query(AuditLog).filter(AuditLog.action == "PAYOUT_LIVENESS_VERIFIED").all()
    )
    assert len(logs_live) >= 1

    # 4. Analyst release -> PAYOUT_RELEASED
    payout_service.handle_payout_action(
        db=db_session,
        payout_id=p_resp.payout_id,
        action_req=PayoutActionRequest(action="release", notes="Passed audit verification"),
        actor="analyst_dave",
        role="analyst",
        now=now + timedelta(minutes=5),
    )
    logs_rel = db_session.query(AuditLog).filter(AuditLog.action == "PAYOUT_RELEASED").all()
    assert len(logs_rel) >= 1
    assert "analyst_dave" in logs_rel[-1].actor

    # 5. Block action -> PAYOUT_BLOCKED
    req2 = PayoutRequestCreate(
        rider_id=rider_id, amount=200.0, destination_account_token=acct.account_number_token
    )
    p_resp2 = payout_service.request_payout(db=db_session, payload=req2, now=now)
    payout_service.handle_payout_action(
        db=db_session,
        payout_id=p_resp2.payout_id,
        action_req=PayoutActionRequest(action="block", notes="Fraud confirmed"),
        actor="analyst_dave",
        role="analyst",
        now=now,
    )
    logs_blk = db_session.query(AuditLog).filter(AuditLog.action == "PAYOUT_BLOCKED").all()
    assert len(logs_blk) >= 1


# ==============================================================================
# 4. Attack Generator Hook: P1 Payout Hijack Scenario
# ==============================================================================


def test_payout_hijack_scenario_p1(db_session):
    """
    P1 Attack Generator Scenario:
    - make_payout_hijack produces account change event + immediate withdrawal request.
    - Demonstrates payout held live with clear reason and release path.
    - Confirms that payout cannot move to released without the required steps.
    """
    rng = np.random.RandomState(42)
    persona = generate_persona(1, rng)
    persona.rider_id = "rider_hijack_01"

    hijack_sess = make_payout_hijack(persona=persona, day_idx=36)
    fin_data = hijack_sess["financial"]
    assert fin_data["payout_account_changed"] is True
    assert fin_data["withdrawal_requested"] is True
    new_attacker_token = fin_data["new_payout_token"]
    withdrawal_amt = fin_data["withdrawal_amount"]

    now = utcnow()

    # Step 1: Simulator attack hook executes account swap
    acct = payout_service.set_payout_account(
        db=db_session,
        rider_id=persona.rider_id,
        account_token=new_attacker_token,
        actor="attacker_script",
        role="rider",
        now=now,
    )
    assert acct.account_number_token == new_attacker_token

    # Step 2: Immediate withdrawal request executed
    payout_req = PayoutRequestCreate(
        rider_id=persona.rider_id,
        amount=withdrawal_amt,
        currency="INR",
        destination_account_token=new_attacker_token,
    )

    eval_result = payout_service.evaluate_payout(
        db=db_session,
        request=payout_req,
        rider_state={"risk_score": 68.0, "verdict": "CHALLENGE"},
        now=now + timedelta(seconds=fin_data["withdrawal_time_delta_sec"]),
    )

    # Acceptance: Payout is HELD with plain-language reason and release path
    assert eval_result["status"] == "HELD"
    assert "24-hour protection window" in eval_result["reason"]
    assert eval_result["release_requires"] == "liveness_selfie+analyst_approval"

    # Step 3: Persist request via service
    res = payout_service.request_payout(
        db=db_session,
        payload=payout_req,
        actor="attacker_script",
        role="rider",
        now=now + timedelta(seconds=fin_data["withdrawal_time_delta_sec"]),
    )
    assert res.status == "HELD"
    assert res.challenge_id is not None

    # Step 4: Ensure no payout moves to released without the required steps
    with pytest.raises(HTTPException) as exc_info:
        payout_service.handle_payout_action(
            db=db_session,
            payout_id=res.payout_id,
            action_req=PayoutActionRequest(action="release", notes="Bypass attempt"),
            actor="attacker_bypass",
            role="analyst",
            now=now + timedelta(seconds=60),
        )
    assert exc_info.value.status_code == 400

    # Check status remains HELD
    p_live = db_session.query(PayoutRequest).filter(PayoutRequest.id == res.payout_id).first()
    assert p_live.status == "HELD"


# ==============================================================================
# 5. REST API Endpoints Tests
# ==============================================================================


@pytest.mark.anyio
async def test_api_payout_endpoints(client: AsyncClient, db_session):
    """
    API Endpoints Test:
    - POST /api/v1/riders/{rider_id}/payout-account
    - POST /api/v1/payouts/request
    - GET /api/v1/payouts (filtered by status)
    - PATCH /api/v1/payouts/{id} (403 for rider, 400 without selfie, 200 after selfie)
    - POST /api/v1/payouts/evaluate
    """
    rider_id = "rider_norm_01"

    # 1. Update payout account via API
    resp = await client.post(
        f"/api/v1/riders/{rider_id}/payout-account",
        headers={"X-Role": "rider", "X-Actor": rider_id},
        json={
            "account_token": tokenize("acc_api_test_777"),
            "routing_token": "routing_token_xyz",
            "account_type": "savings",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["protection_window_active"] is True
    assert "protection_window_expires_at" in data

    # 2. Request payout within 24h window -> Returns 201 HELD
    p_resp = await client.post(
        "/api/v1/payouts/request",
        headers={"X-Role": "rider", "X-Actor": rider_id},
        json={
            "rider_id": rider_id,
            "amount": 75.0,
            "currency": "USD",
            "destination_account_token": tokenize("acc_api_test_777"),
        },
    )
    assert p_resp.status_code == 201
    p_data = p_resp.json()
    assert p_data["status"] == "HELD"
    assert "24-hour protection window" in p_data["reason"]
    assert p_data["release_requires"] == "liveness_selfie+analyst_approval"
    payout_id = p_data["payout_id"]
    challenge_id = p_data["challenge_id"]

    # 3. GET /api/v1/payouts with status filter
    list_resp = await client.get("/api/v1/payouts?status=HELD", headers={"X-Role": "analyst"})
    assert list_resp.status_code == 200
    payouts_list = list_resp.json()
    assert any(p["payout_id"] == payout_id for p in payouts_list)

    # 4. PATCH /api/v1/payouts/{id} as rider -> Forbidden 403
    patch_forbidden = await client.patch(
        f"/api/v1/payouts/{payout_id}",
        headers={"X-Role": "rider"},
        json={"action": "release", "notes": "Unauthorized release"},
    )
    assert patch_forbidden.status_code == 403

    # 5. PATCH /api/v1/payouts/{id} as analyst before selfie -> Bad Request 400
    patch_premature = await client.patch(
        f"/api/v1/payouts/{payout_id}",
        headers={"X-Role": "analyst"},
        json={"action": "release", "notes": "Release without selfie"},
    )
    assert patch_premature.status_code == 400
    assert "facial liveness verification" in patch_premature.json()["detail"].lower()

    # 6. Simulate liveness verification
    payout_service.handle_liveness_verified(
        db=db_session,
        rider_id=rider_id,
        challenge_id=challenge_id,
    )

    # 7. PATCH /api/v1/payouts/{id} as analyst after selfie -> Success 200 RELEASED
    patch_ok = await client.patch(
        f"/api/v1/payouts/{payout_id}",
        headers={"X-Role": "analyst", "X-Actor": "analyst_sarah"},
        json={"action": "release", "notes": "Liveness selfie checked and approved"},
    )
    assert patch_ok.status_code == 200
    assert patch_ok.json()["status"] == "RELEASED"

    # 8. POST /api/v1/payouts/evaluate simulation helper
    eval_resp = await client.post(
        "/api/v1/payouts/evaluate",
        headers={"X-Role": "analyst"},
        json={
            "rider_id": rider_id,
            "amount": 5000.0,
            "currency": "USD",
        },
    )
    assert eval_resp.status_code == 200
    eval_data = eval_resp.json()
    assert eval_data["status"] in ("HELD", "BLOCKED")
