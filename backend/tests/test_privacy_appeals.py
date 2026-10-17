"""
TrustJuggler Privacy-Preserving Architecture & Appeals Workflow Test Suite (V1).

Validates:
1. Data Minimization & Physical SQLite Scan:
   - Zero raw IPv4/IPv6 addresses or raw device fingerprints appear in SQLite physical file or tables.
2. Analyst API Response Masking:
   - Role=analyst automatically masks rider display names and phone numbers across endpoints.
   - Role=admin receives unmasked data.
3. Cross-Rider Access Isolation:
   - Role=rider cannot read or appeal another rider's session, case, or appeal (HTTP 403 Forbidden).
4. Automated Data Retention Purge:
   - Purge removes behavior_snapshots and session_events older than N days.
   - Purge removes expired face_templates past retention_until.
   - Aggregated features (rider_baselines) and compliance audit_logs are preserved.
   - Generates immutable audit log entry.
5. Human-in-the-Loop Appeal Overturn:
   - Overturning an appeal lifts rider restrictions (status='active').
   - Marks linked case as false_positive (RESOLVED_FALSE_POSITIVE).
   - Releases eligible held payouts (status='RELEASED').
   - Restores rider trust history (+10 bonus points).
   - Records reviewer feedback snapshot for adaptive policy tuning.
   - Requires non-empty reviewer note (HTTP 400 if empty).
6. Rider-Safe Explanations:
   - GET /rider-view/sessions/{id} returns headline, plain reasons, and what_you_can_do.
   - Text contains strictly ZERO numeric thresholds, internal risk scores, or model mechanics.
7. Consent Minimal Mode:
   - Sessions for riders without consent (consent_version/consent_at is null) are scored with
     minimal feature sets, motor kinematics neutral, risk capped <= 55, and tagged CONSENT_MINIMAL_MODE.
"""

import json
import re
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.main import app
from app.models.entities import (
    Appeal,
    AuditLog,
    BehaviorSnapshot,
    Case,
    Device,
    FaceTemplate,
    PayoutAccount,
    PayoutRequest,
    ReviewerAction,
    Rider,
    RiderBaseline,
    RiderTrustHistory,
    RiderTrustScore,
    RiskAssessment,
    RiskFactor,
    SessionEvent,
)
from app.models.entities import (
    Session as SessionModel,
)
from app.services.privacy import (
    is_token,
    mask_name,
    mask_phone,
    scan_db_for_raw_pii,
    scan_sqlite_file_for_pii,
    tokenize,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# In-memory test DB engine
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
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

    # Seed initial test identities
    # Rider A: Alice (consented, active)
    rider_a = Rider(
        id="rider_alice",
        display_name="Alice Sharma",
        phone_number="+91-9876-123456",
        email="alice@trustjuggler.test",
        status="active",
        consent_version="v1.0",
        consent_at=utcnow() - timedelta(days=60),
        created_at=utcnow() - timedelta(days=60),
    )
    # Rider B: Bob (consented, restricted)
    rider_b = Rider(
        id="rider_bob",
        display_name="Bob Verma",
        phone_number="+91-9876-234567",
        email="bob@trustjuggler.test",
        status="restricted",
        consent_version="v1.0",
        consent_at=utcnow() - timedelta(days=30),
        created_at=utcnow() - timedelta(days=30),
    )
    # Rider C: Charlie (unconsented)
    rider_c = Rider(
        id="rider_charlie",
        display_name="Charlie Rao",
        phone_number="+91-9876-345678",
        email="charlie@trustjuggler.test",
        status="active",
        consent_version=None,
        consent_at=None,
        created_at=utcnow() - timedelta(days=10),
    )
    db.add_all([rider_a, rider_b, rider_c])

    # Trust scores
    db.add(RiderTrustScore(id="ts_alice", rider_id="rider_alice", trust_score=92.0))
    db.add(RiderTrustScore(id="ts_bob", rider_id="rider_bob", trust_score=55.0))
    db.add(RiderTrustScore(id="ts_charlie", rider_id="rider_charlie", trust_score=85.0))

    # Baseline for Alice
    db.add(
        RiderBaseline(
            id="base_alice",
            rider_id="rider_alice",
            avg_speed_kmh=36.0,
            avg_cadence_cpm=225.0,
        )
    )

    db.commit()
    yield
    db.close()
    Base.metadata.drop_all(bind=test_engine)


def test_data_minimization_and_physical_sqlite_scan():
    """
    Test 1: Verify that when creating sessions and events with raw IPs and fingerprints,
    they are tokenized at the edge and never stored in the database.
    Scans physical SQLite file bytes and verifies 0 occurrences of raw IP strings.
    """
    with tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False) as tmp:
        tmp_db_path = tmp.name

    file_engine = None
    try:
        file_engine = create_engine(f"sqlite:///{tmp_db_path}")
        Base.metadata.create_all(bind=file_engine)
        FileSessionLocal = sessionmaker(bind=file_engine)
        db = FileSessionLocal()

        raw_ip_1 = "192.168.1.105"
        raw_ip_2 = "10.0.0.45"
        raw_fp = "device_hardware_fingerprint_xyz_999"

        # 1. Insert session through model validation
        sess = SessionModel(
            id="sess_min_01",
            rider_id="rider_alice",
            driver_id="driver_01",
            device_id="dev_01",
            status="active",
            ip_address=raw_ip_1,  # Automatically tokenized by @validates
            raw_context_json=json.dumps({"ip": raw_ip_1, "client_fp": raw_fp}),
            created_at=utcnow(),
        )
        db.add(sess)

        # 2. Insert device through model validation
        dev = Device(
            id="dev_01",
            fingerprint=raw_fp,  # Automatically tokenized by @validates
            created_at=utcnow(),
            last_seen_at=utcnow(),
        )
        db.add(dev)

        # 3. Insert session event with raw payload
        ev = SessionEvent(
            id="ev_min_01",
            session_id="sess_min_01",
            event_type="heartbeat",
            payload_json=json.dumps({"remote_addr": raw_ip_2, "hw_fp": raw_fp}),
            created_at=utcnow(),
        )
        db.add(ev)

        # 4. Insert audit log
        audit = AuditLog(
            id="aud_min_01",
            actor="system",
            role="system",
            action="CHECK",
            entity_type="session",
            entity_id="sess_min_01",
            detail=f"Connection attempt from {raw_ip_1} device {raw_fp}",
            created_at=utcnow(),
        )
        db.add(audit)
        db.commit()

        # Verify DB in-memory inspection
        findings = scan_db_for_raw_pii(db)
        assert len(findings) == 0, f"Expected 0 raw PII findings in DB, got: {findings}"

        # Verify tokenized columns
        db.refresh(sess)
        assert sess.ip_address != raw_ip_1
        assert is_token(sess.ip_address)
        assert raw_ip_1 not in sess.raw_context_json

        db.refresh(dev)
        assert dev.fingerprint != raw_fp
        assert is_token(dev.fingerprint)

        db.close()
        file_engine.dispose()

        # Verify physical SQLite file bytes scan
        file_findings = scan_sqlite_file_for_pii(tmp_db_path)
        assert len(file_findings) == 0, f"Expected 0 raw PII in physical file, found: {file_findings}"

    finally:
        if file_engine:
            file_engine.dispose()
        Path(tmp_db_path).unlink(missing_ok=True)


def test_analyst_api_masks_names_and_phones():
    """
    Test 2: Analyst API masks rider names and phone numbers; Admin receives unmasked data.
    """
    client = TestClient(app)

    # 1. Analyst query on /riders
    res_analyst = client.get("/api/v1/riders", headers={"X-Role": "analyst"})
    assert res_analyst.status_code == 200
    riders_analyst = res_analyst.json()
    assert len(riders_analyst) >= 3

    alice = next(r for r in riders_analyst if r["id"] == "rider_alice")
    assert alice["display_name"] == mask_name("Alice Sharma")
    assert alice["phone_number"] == mask_phone("+91-9876-123456")
    assert "*" in alice["display_name"]
    assert "*" in alice["phone_number"]

    # 2. Analyst query on single rider
    res_single = client.get("/api/v1/riders/rider_bob", headers={"X-Role": "analyst"})
    assert res_single.status_code == 200
    bob_analyst = res_single.json()
    assert bob_analyst["display_name"] == mask_name("Bob Verma")
    assert bob_analyst["phone_number"] == mask_phone("+91-9876-234567")

    # 3. Admin query receives unmasked data
    res_admin = client.get("/api/v1/riders/rider_alice", headers={"X-Role": "admin"})
    assert res_admin.status_code == 200
    alice_admin = res_admin.json()
    assert alice_admin["display_name"] == "Alice Sharma"
    assert alice_admin["phone_number"] == "+91-9876-123456"


def test_rider_cannot_read_other_riders_data():
    """
    Test 3: Enforces cross-rider data isolation (403 Forbidden).
    A rider cannot read other riders' session explanations or appeals.
    """
    db = TestingSessionLocal()
    sess_alice = SessionModel(
        id="sess_alice_secret",
        rider_id="rider_alice",
        driver_id="drv_01",
        device_id="dev_01",
        status="active",
        ip_address=tokenize("1.2.3.4"),
        created_at=utcnow(),
    )
    db.add(sess_alice)

    app_alice = Appeal(
        id="app_alice_01",
        rider_id="rider_alice",
        reason="Alice appeal reason",
        status="PENDING",
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(app_alice)
    db.commit()
    db.close()

    client = TestClient(app)

    # 1. Bob attempts to access Alice's session explanation -> 403 Forbidden
    res_sess_cross = client.get(
        "/api/v1/rider-view/sessions/sess_alice_secret",
        headers={"X-Role": "rider", "X-Rider-Id": "rider_bob"},
    )
    assert res_sess_cross.status_code == 403
    assert "Forbidden" in res_sess_cross.json()["detail"]

    # 2. Bob attempts to view Alice's appeal -> 403 Forbidden
    res_app_cross = client.get(
        "/api/v1/appeals/app_alice_01",
        headers={"X-Role": "rider", "X-Rider-Id": "rider_bob"},
    )
    assert res_app_cross.status_code == 403
    assert "Forbidden" in res_app_cross.json()["detail"]

    # 3. Bob attempts to file an appeal claiming to be Alice -> 403 Forbidden
    res_submit_cross = client.post(
        "/api/v1/appeals",
        json={"rider_id": "rider_alice", "reason": "Spoofed appeal"},
        headers={"X-Role": "rider", "X-Rider-Id": "rider_bob"},
    )
    assert res_submit_cross.status_code == 403

    # 4. Alice accesses her own session explanation -> 200 OK
    res_alice_own = client.get(
        "/api/v1/rider-view/sessions/sess_alice_secret",
        headers={"X-Role": "rider", "X-Rider-Id": "rider_alice"},
    )
    assert res_alice_own.status_code == 200
    assert res_alice_own.json()["session_id"] == "sess_alice_secret"


def test_retention_purge_removes_expired_rows_and_keeps_audit_logs():
    """
    Test 4: Retention purge deletes behavior_snapshots and session_events older than N days,
    deletes face_templates past retention_until, and keeps aggregated features and audit logs.
    """
    db = TestingSessionLocal()
    now = utcnow()
    old_time = now - timedelta(days=120)
    recent_time = now - timedelta(days=10)

    # 1. BehaviorSnapshots: 1 expired (120d old), 1 recent (10d old)
    db.add(BehaviorSnapshot(id="snap_old", session_id="s1", created_at=old_time))
    db.add(BehaviorSnapshot(id="snap_recent", session_id="s2", created_at=recent_time))

    # 2. SessionEvents: 1 expired (120d old), 1 recent (10d old)
    db.add(SessionEvent(id="ev_old", session_id="s1", event_type="touch", payload_json="{}", created_at=old_time))
    db.add(SessionEvent(id="ev_recent", session_id="s2", event_type="touch", payload_json="{}", created_at=recent_time))

    # 3. FaceTemplates: 1 expired (retention_until in past), 1 active (retention_until in future)
    db.add(
        FaceTemplate(
            id="face_expired",
            rider_id="rider_alice",
            template_version="v1",
            model_name="simulated",
            embedding_hash="hash_01",
            retention_until=now - timedelta(days=5),
            created_at=old_time,
        )
    )
    db.add(
        FaceTemplate(
            id="face_active",
            rider_id="rider_alice",
            template_version="v1",
            model_name="simulated",
            embedding_hash="hash_02",
            retention_until=now + timedelta(days=90),
            created_at=recent_time,
        )
    )

    # 4. Compliance Audit Log
    db.add(
        AuditLog(
            id="aud_retention_keep",
            actor="admin",
            role="admin",
            action="EXISTING_ACTION",
            entity_type="session",
            entity_id="s1",
            detail="Important historical compliance log",
            created_at=old_time,
        )
    )
    db.commit()
    db.close()

    client = TestClient(app)

    # Non-admin cannot execute purge -> 403 Forbidden
    res_forbidden = client.post("/api/v1/admin/retention/purge?days=90", headers={"X-Role": "analyst"})
    assert res_forbidden.status_code == 403

    # Admin executes purge
    res = client.post("/api/v1/admin/retention/purge?days=90", headers={"X-Role": "admin"})
    assert res.status_code == 200
    data = res.json()
    assert data["snapshots_deleted"] >= 1
    assert data["session_events_deleted"] >= 1
    assert data["face_templates_deleted"] >= 1
    assert data["audit_logs_retained"] >= 1
    assert data["baselines_retained"] >= 1

    # Verify DB state
    db = TestingSessionLocal()
    assert db.query(BehaviorSnapshot).filter(BehaviorSnapshot.id == "snap_old").first() is None
    assert db.query(BehaviorSnapshot).filter(BehaviorSnapshot.id == "snap_recent").first() is not None

    assert db.query(SessionEvent).filter(SessionEvent.id == "ev_old").first() is None
    assert db.query(SessionEvent).filter(SessionEvent.id == "ev_recent").first() is not None

    assert db.query(FaceTemplate).filter(FaceTemplate.id == "face_expired").first() is None
    assert db.query(FaceTemplate).filter(FaceTemplate.id == "face_active").first() is not None

    # Audit logs and baselines are intact
    assert db.query(AuditLog).filter(AuditLog.id == "aud_retention_keep").first() is not None
    assert db.query(RiderBaseline).filter(RiderBaseline.id == "base_alice").first() is not None

    # An audit log entry for the purge action itself was created
    purge_log = db.query(AuditLog).filter(AuditLog.action == "RETENTION_PURGE_EXECUTED").first()
    assert purge_log is not None
    assert "Purged" in purge_log.detail
    db.close()


def test_appeal_overturn_lifts_restrictions_end_to_end():
    """
    Test 5: Overturned appeals lift restrictions, mark case false_positive,
    release eligible held payouts, restore trust history, record feedback, and write audit logs.
    """
    db = TestingSessionLocal()
    # 1. Rider Bob is restricted with trust score 55
    bob = db.query(Rider).filter(Rider.id == "rider_bob").first()
    bob.status = "restricted"

    # 2. Open case for Bob
    case = Case(
        id="case_bob_fraud",
        rider_id="rider_bob",
        status="OPEN",
        severity="HIGH",
        threat_tag="ACCOUNT_TAKEOVER",
        threat_summary="Unusual velocity detected",
        risk_score=78.0,
        created_at=utcnow(),
    )
    db.add(case)

    # 3. Payout account and held payout for Bob
    acct = PayoutAccount(
        id="acct_bob_01",
        rider_id="rider_bob",
        account_number_token=tokenize("acct_12345"),
        is_current=True,
    )
    db.add(acct)

    payout = PayoutRequest(
        id="payout_bob_held",
        rider_id="rider_bob",
        amount=145.0,
        currency="USD",
        status="HELD",
        hold_reason="Security check pending",
        created_at=utcnow(),
    )
    db.add(payout)
    db.commit()
    db.close()

    client = TestClient(app)

    # 1. Rider Bob submits appeal
    res_submit = client.post(
        "/api/v1/appeals",
        json={
            "case_id": "case_bob_fraud",
            "rider_id": "rider_bob",
            "reason": "Legitimate phone replacement verified by courier depot receipt.",
            "supporting_text": "I purchased an iPhone 14 yesterday and transferred SIM.",
        },
        headers={"X-Role": "rider", "X-Rider-Id": "rider_bob"},
    )
    assert res_submit.status_code == 201
    appeal_id = res_submit.json()["id"]
    assert res_submit.json()["status"] == "PENDING"

    # 2. Overturn without note fails -> 400 Bad Request
    res_no_note = client.patch(
        f"/api/v1/appeals/{appeal_id}",
        json={"action": "overturned", "note": ""},
        headers={"X-Role": "analyst"},
    )
    assert res_no_note.status_code == 400

    # 3. Rider cannot resolve appeal -> 403 Forbidden
    res_rider_resolve = client.patch(
        f"/api/v1/appeals/{appeal_id}",
        json={"action": "overturned", "note": "Trying to resolve self"},
        headers={"X-Role": "rider"},
    )
    assert res_rider_resolve.status_code == 403

    # 4. Analyst resolves appeal as OVERTURNED
    res_overturn = client.patch(
        f"/api/v1/appeals/{appeal_id}",
        json={
            "action": "overturned",
            "note": "Hardware upgrade receipt confirmed with courier operations manager.",
        },
        headers={"X-Role": "analyst", "X-Actor": "analyst_dave"},
    )
    assert res_overturn.status_code == 200
    updated_appeal = res_overturn.json()
    assert updated_appeal["status"] == "OVERTURNED"
    assert updated_appeal["reviewer_id"] == "analyst_dave"

    # Verify side-effects in DB
    db = TestingSessionLocal()
    # 1. Rider Bob status is active
    bob = db.query(Rider).filter(Rider.id == "rider_bob").first()
    assert bob.status == "active"

    # 2. Linked case is RESOLVED_FALSE_POSITIVE
    c = db.query(Case).filter(Case.id == "case_bob_fraud").first()
    assert c.status == "RESOLVED_FALSE_POSITIVE"

    # 3. Held payout is RELEASED
    p = db.query(PayoutRequest).filter(PayoutRequest.id == "payout_bob_held").first()
    assert p.status == "RELEASED"

    # 4. Trust score restored (+10 pts bonus: 55 + 10 = 65)
    ts = db.query(RiderTrustScore).filter(RiderTrustScore.rider_id == "rider_bob").first()
    assert ts.trust_score == 65.0

    # 5. Trust history delta recorded
    history = (
        db.query(RiderTrustHistory)
        .filter(RiderTrustHistory.rider_id == "rider_bob")
        .order_by(RiderTrustHistory.created_at.desc())
        .first()
    )
    assert history is not None
    assert history.delta == 10.0
    assert "overturn" in history.reason.lower()

    # 6. Reviewer action feedback recorded
    action = db.query(ReviewerAction).filter(ReviewerAction.case_id == "case_bob_fraud").first()
    assert action is not None
    assert action.action_type in ("appeal_overturned", "false_positive")
    assert "Hardware upgrade receipt" in action.notes

    # 7. Audit log recorded
    audit = db.query(AuditLog).filter(AuditLog.action == "APPEAL_OVERTURNED").first()
    assert audit is not None
    assert audit.actor == "analyst_dave"
    db.close()


def test_rider_view_text_contains_no_numeric_thresholds():
    """
    Test 6: GET /rider-view/sessions/{id} returns headline, plain reasons, and what_you_can_do.
    Guarantees text contains strictly ZERO numeric thresholds, risk scores, or model internals.
    """
    db = TestingSessionLocal()
    sess = SessionModel(
        id="sess_explain_01",
        rider_id="rider_alice",
        driver_id="drv_01",
        device_id="dev_01",
        status="active",
        ip_address=tokenize("5.6.7.8"),
        created_at=utcnow(),
    )
    db.add(sess)

    eval_record = RiskAssessment(
        id="eval_exp_01",
        session_id="sess_explain_01",
        risk_score=72.0,
        raw_risk=72.0,
        verdict="CHALLENGE",
        risk_tier="HIGH",
        classification="account_takeover",
        created_at=utcnow(),
    )
    db.add(eval_record)

    f1 = RiskFactor(
        id="rf_01",
        assessment_id="eval_exp_01",
        name="BEHAVIOR_DEV",
        category="behavior",
        impact="NEGATIVE",
        weight=0.38,
        score=38.0,
        description="Motor dynamics divergence",
    )
    f2 = RiskFactor(
        id="rf_02",
        assessment_id="eval_exp_01",
        name="ENV_CHANGE",
        category="environment",
        impact="NEGATIVE",
        weight=0.26,
        score=26.0,
        description="Hardware environment shift",
    )
    db.add_all([f1, f2])
    db.commit()
    db.close()

    client = TestClient(app)
    res = client.get(
        "/api/v1/rider-view/sessions/sess_explain_01",
        headers={"X-Role": "rider", "X-Rider-Id": "rider_alice"},
    )
    assert res.status_code == 200
    data = res.json()

    assert "headline" in data
    assert "plain_reasons" in data
    assert "rider_safe_text" in data
    assert "what_you_can_do" in data

    headline = data["headline"]
    safe_text = data["rider_safe_text"]
    plain_reasons = data["plain_reasons"]

    # 1. Verify headline has no numeric values
    assert not re.search(r"\b\d+(\.\d+)?\b", headline), f"Headline contains digits: {headline}"

    # 2. Verify rider_safe_text has no numeric values or threshold words
    assert not re.search(r"\b\d+(\.\d+)?\b", safe_text), f"Safe text contains digits: {safe_text}"
    for prohibited in ["threshold", "score", "points", "percent", "weight", "model", "cutoff", "auc"]:
        assert prohibited not in safe_text.lower(), f"Prohibited word '{prohibited}' in safe_text: {safe_text}"

    # 3. Verify plain_reasons list has no numeric values
    assert len(plain_reasons) > 0
    for reason in plain_reasons:
        assert not re.search(r"\b\d+(\.\d+)?\b", reason), f"Reason contains digits: {reason}"
        for prohibited in ["threshold", "score", "points", "percent", "weight", "cutoff"]:
            assert prohibited not in reason.lower(), f"Prohibited word '{prohibited}' in reason: {reason}"

    # 4. Verify what_you_can_do options
    actions = [a["action"] for a in data["what_you_can_do"]]
    assert "selfie" in actions
    assert "appeal" in actions
    assert "support" in actions


def test_consent_minimal_mode_and_scoring_clamp():
    """
    Test 7: Sessions for riders without consent (consent_version/consent_at is null)
    are scored with minimal feature sets, motor kinematics neutral, risk capped <= 55,
    and tagged CONSENT_MINIMAL_MODE.
    """
    db = TestingSessionLocal()
    charlie = db.query(Rider).filter(Rider.id == "rider_charlie").first()
    assert charlie.consent_version is None
    assert charlie.consent_at is None
    db.close()

    client = TestClient(app)
    raw_ip = "198.51.100.12"
    res = client.post(
        "/api/v1/sessions",
        json={
            "session_id": "sess_charlie_unconsented",
            "rider_id": "rider_charlie",
            "device_passport": {
                "ip_address": raw_ip,
                "fingerprint": "fp_charlie_dev_999",
                "device_model": "Pixel 7",
            },
            "telemetry": {
                "speed_kmh": 65.0,
                "acceleration_variance": 0.45,
            },
        },
        headers={"X-Role": "rider", "X-Rider-Id": "rider_charlie"},
    )
    assert res.status_code == 201
    data = res.json()
    sess_info = data.get("session") or data
    assert sess_info.get("id") == "sess_charlie_unconsented" or sess_info.get("session_id") == "sess_charlie_unconsented"

    # Risk score must be capped <= 55 to avoid punitive friction without consent
    assessment = data.get("assessment") or data.get("latest_assessment")
    assert assessment is not None
    assert assessment["risk_score"] <= 55.0

    # Factors must contain CONSENT_MINIMAL_MODE
    factor_names = [f.get("name") or f.get("code") for f in assessment.get("factors", [])]
    assert any("CONSENT" in (fn or "") for fn in factor_names)

    # Verify IP address in database is tokenized (never raw)
    db = TestingSessionLocal()
    db_sess = db.query(SessionModel).filter(SessionModel.id == "sess_charlie_unconsented").first()
    assert db_sess.ip_address != raw_ip
    assert is_token(db_sess.ip_address)
    db.close()
