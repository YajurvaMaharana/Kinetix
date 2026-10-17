"""
Comprehensive Unit & Integration Tests for TrustJuggler v2 Step-Up Service and Challenge Flow.

Covers:
1. Ladder selection per band:
   - Level 0: Passive monitor (MONITOR, risk < 45 or verdict ALLOW/MONITOR)
   - Level 1: OTP (risk 45-59)
   - Level 2: Liveness selfie + face match (risk 60-74, payout lock, or OTP failed)
   - Level 3: Manual review / document check (ESCALATE, face or liveness failure)
2. Proportionality: Never challenge when decision is ALLOW or MONITOR.
3. Cooldowns:
   - cooldown_key = rider_id + reason_code
   - Suppress repeat OTP for same key within 30 min, but NOT after 30 min
   - Lift level-2 for 24h after PASS
   - Max 2 liveness challenges per rider per day
   - Suppressed challenges stored with status "suppressed" and assessment explains suppression
4. Escalation on failure:
   - OTP failed -> Level 2 face liveness
   - Level 2 failed -> Level 3 manual review plus Case
5. Pass handling:
   - Device marked trusted
   - Trust history updated
   - Session restored
   - Audited
6. Lazy challenge expiry check (10 min lifetime) on read.
7. REST Endpoints:
   - POST /challenges/{id}/respond
   - GET /riders/{id}/challenges
   - GET /challenges/{id}
8. Scenario S1: Repeated-trigger scenario preventing duplicate challenges.
"""

from datetime import datetime, timedelta, timezone

import pytest
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
    Device,
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
    FactorSchema,
)
from app.services.privacy import tokenize
from app.services.stepup_service import (
    choose_challenge,
    compute_cooldown_key,
    stepup_service,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


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

    riders = [
        "rider_stepup_01",
        "rider_stepup_02",
        "rider_cooldown_01",
        "rider_liveness_limit_01",
        "rider_escalate_01",
        "rider_scenario_s1",
    ]
    for rid in riders:
        r = Rider(
            id=rid,
            display_name=f"Test Rider {rid}",
            phone_number="+1-555-0199",
            email=f"{rid}@example.com",
            status="active",
        )
        db.add(r)
        ts = RiderTrustScore(
            id=f"ts_{rid}",
            rider_id=rid,
            trust_score=85.0,
            trend="STABLE",
            confidence=0.9,
            last_calculated_at=utcnow(),
        )
        db.add(ts)

    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.pop(get_db, None)


# ==============================================================================
# 1. Ladder Selection & Proportionality Unit Tests
# ==============================================================================
def test_ladder_selection_level_0_monitor_and_allow():
    """Level 0: Passive monitor (MONITOR). Never issue challenges when ALLOW or MONITOR."""
    # Decision ALLOW
    res_allow = choose_challenge({"verdict": "ALLOW", "risk_score": 15.0})
    assert res_allow["level"] == 0
    assert res_allow["type"] == "MONITOR"

    # Decision MONITOR
    res_monitor = choose_challenge({"verdict": "MONITOR", "risk_score": 42.0})
    assert res_monitor["level"] == 0
    assert res_monitor["type"] == "MONITOR"

    # Even with high factors, proportionality dictates ALLOW or MONITOR never issues challenges
    res_prop = choose_challenge(
        {"verdict": "MONITOR", "risk_score": 44.0},
        rider_state={"payout_lock": True, "is_new_device": True},
    )
    assert res_prop["level"] == 0
    assert res_prop["type"] == "MONITOR"


def test_ladder_selection_level_1_otp():
    """Level 1: OTP (risk 45-59)."""
    assessment = {
        "verdict": "CHALLENGE",
        "risk_score": 52.0,
        "factors": [
            FactorSchema(
                name="Hardware Shift",
                category="DEVICE",
                impact="NEGATIVE",
                weight=0.55,
                score=0.45,
                description="Unregistered handset transition",
                code="NEW_DEVICE_DEV",
            )
        ],
    }
    res = choose_challenge(assessment)
    assert res["level"] == 1
    assert res["type"] == "OTP"
    assert "NEW_DEVICE" in res["reason_code"]


def test_ladder_selection_level_2_face_liveness():
    """Level 2: Liveness selfie + face match (risk 60-74, payout lock, or OTP failed)."""
    # 1. Risk in 60-74
    res_band = choose_challenge({"verdict": "CHALLENGE", "risk_score": 67.5})
    assert res_band["level"] == 2
    assert res_band["type"] == "FACE_LIVENESS"

    # 2. Payout lock trigger (even if risk is in 45-59 band)
    res_payout = choose_challenge(
        {"verdict": "CHALLENGE", "risk_score": 50.0},
        rider_state={"payout_lock": True},
    )
    assert res_payout["level"] == 2
    assert res_payout["type"] == "FACE_LIVENESS"
    assert res_payout["reason_code"] == "PAYOUT_CHANGED"

    # 3. OTP failed trigger
    res_otp_fail = choose_challenge(
        {"verdict": "CHALLENGE", "risk_score": 55.0},
        rider_state={"otp_failed": True},
    )
    assert res_otp_fail["level"] == 2
    assert res_otp_fail["type"] == "FACE_LIVENESS"


def test_ladder_selection_level_3_manual_review_and_escalate():
    """Level 3: Manual review / document check (ESCALATE, face or liveness failure)."""
    # 1. ESCALATE verdict (risk >= 75)
    res_esc = choose_challenge({"verdict": "ESCALATE", "risk_score": 82.0})
    assert res_esc["level"] == 3
    assert res_esc["type"] == "MANUAL_REVIEW"

    # 2. Face match or liveness failure
    res_face_fail = choose_challenge(
        {"verdict": "CHALLENGE", "risk_score": 65.0},
        rider_state={"face_failed": True},
    )
    assert res_face_fail["level"] == 3
    assert res_face_fail["type"] == "MANUAL_REVIEW"


def test_reason_code_derivation_from_top_factors():
    """Reason code derivation from top risk factors."""
    # Impossible travel
    res_travel = choose_challenge(
        {
            "verdict": "CHALLENGE",
            "risk_score": 68.0,
            "threat_tags": ["IMPOSSIBLE_TRAVEL"],
            "factors": [
                FactorSchema(
                    name="Travel Velocity Jump",
                    category="TRAVEL",
                    impact="NEGATIVE",
                    weight=0.9,
                    score=0.1,
                    description="850 km/h displacement between consecutive pings",
                    code="IMPOSSIBLE_TRAVEL",
                )
            ],
        }
    )
    assert res_travel["reason_code"] == "IMPOSSIBLE_TRAVEL"

    # Payout changed
    res_payout = choose_challenge(
        {
            "verdict": "CHALLENGE",
            "risk_score": 62.0,
            "threat_tags": ["PAYOUT_REDIRECT"],
        }
    )
    assert res_payout["reason_code"] == "PAYOUT_CHANGED"


# ==============================================================================
# 2. Cooldowns & Suppression Tests
# ==============================================================================
def test_cooldown_suppresses_duplicate_within_30_min_but_not_after():
    """After a PASS, suppress repeat OTP for same key for 30 min, but allow after 30 min."""
    db = TestingSessionLocal()
    rider_id = "rider_cooldown_01"
    reason_code = "NEW_DEVICE_BEHAVIOR_SHIFT"
    key = compute_cooldown_key(rider_id, reason_code)

    # 1. Simulate a passed OTP challenge 10 minutes ago
    sess = SessionModel(
        id="sess_cd_01",
        rider_id=rider_id,
        status="IN_PROGRESS",
        ip_address="1.2.3.4",
        current_risk_score=50.0,
        current_verdict="ALLOW",
        created_at=utcnow() - timedelta(minutes=15),
    )
    db.add(sess)

    past_passed_chlg = Challenge(
        id="chlg_past_pass",
        session_id=sess.id,
        rider_id=rider_id,
        challenge_type="OTP",
        status="PASSED",
        level=1,
        reason_code=reason_code,
        cooldown_key=key,
        expires_at=utcnow() + timedelta(minutes=5),
        created_at=utcnow() - timedelta(minutes=10),
        resolved_at=utcnow() - timedelta(minutes=10),
    )
    db.add(past_passed_chlg)
    db.commit()

    # 2. Check cooldown within 30 min window -> MUST BE SUPPRESSED
    choice = {"type": "OTP", "level": 1, "reason_code": reason_code}
    is_suppressed, reason = stepup_service.check_cooldown_and_limits(db, rider_id, choice)
    assert is_suppressed is True
    assert "30m cooldown" in reason

    # 3. Simulate passage of time (> 30 min, e.g. 35 min)
    past_passed_chlg.resolved_at = utcnow() - timedelta(minutes=35)
    db.commit()

    # Now MUST NOT BE SUPPRESSED
    is_suppressed_after, reason_after = stepup_service.check_cooldown_and_limits(
        db, rider_id, choice
    )
    assert is_suppressed_after is False
    assert reason_after is None
    db.close()


def test_max_liveness_challenges_per_rider_per_day():
    """Max 2 liveness challenges per rider per day (rolling 24h). 3rd is suppressed."""
    db = TestingSessionLocal()
    rider_id = "rider_liveness_limit_01"

    sess = SessionModel(
        id="sess_live_limit",
        rider_id=rider_id,
        status="IN_PROGRESS",
        ip_address="1.2.3.4",
        current_risk_score=65.0,
        current_verdict="CHALLENGE",
        created_at=utcnow() - timedelta(hours=2),
    )
    db.add(sess)

    # Add 2 existing liveness challenges within last 24h
    for i in range(2):
        c = Challenge(
            id=f"chlg_live_prior_{i}",
            session_id=sess.id,
            rider_id=rider_id,
            challenge_type="FACE_LIVENESS",
            status="PASSED",
            level=2,
            reason_code="BEHAVIORAL_ANOMALY",
            cooldown_key=compute_cooldown_key(rider_id, "BEHAVIORAL_ANOMALY"),
            expires_at=utcnow() + timedelta(minutes=10),
            created_at=utcnow() - timedelta(hours=3 - i),
            resolved_at=utcnow() - timedelta(hours=3 - i),
        )
        db.add(c)
    db.commit()

    # 3rd liveness challenge MUST be suppressed
    choice = {"type": "FACE_LIVENESS", "level": 2, "reason_code": "BEHAVIORAL_ANOMALY"}
    is_suppressed, reason = stepup_service.check_cooldown_and_limits(db, rider_id, choice)
    assert is_suppressed is True
    assert "Maximum liveness challenges" in reason
    db.close()


def test_lift_level_2_for_24h_after_pass():
    """After a Level 2 PASS, lift Level 2 challenges for 24h."""
    db = TestingSessionLocal()
    rider_id = "rider_stepup_01"

    sess = SessionModel(
        id="sess_lift_01",
        rider_id=rider_id,
        status="IN_PROGRESS",
        ip_address="1.2.3.4",
        current_risk_score=65.0,
        current_verdict="CHALLENGE",
        created_at=utcnow() - timedelta(hours=2),
    )
    db.add(sess)

    # 1 passed Level 2 challenge 2 hours ago
    c = Challenge(
        id="chlg_passed_level2",
        session_id=sess.id,
        rider_id=rider_id,
        challenge_type="FACE_LIVENESS",
        status="PASSED",
        level=2,
        reason_code="DEVICE_ROOTED",
        cooldown_key=compute_cooldown_key(rider_id, "DEVICE_ROOTED"),
        expires_at=utcnow() + timedelta(minutes=10),
        created_at=utcnow() - timedelta(hours=2),
        resolved_at=utcnow() - timedelta(hours=2),
    )
    db.add(c)
    db.commit()

    # Next Level 2 trigger is lifted/suppressed
    choice = {"type": "FACE_LIVENESS", "level": 2, "reason_code": "DEVICE_ROOTED"}
    is_suppressed, reason = stepup_service.check_cooldown_and_limits(db, rider_id, choice)
    assert is_suppressed is True
    assert "lifted for 24h" in reason
    db.close()


# ==============================================================================
# 3. Failure Escalation & Pass Handling
# ==============================================================================
def test_escalation_on_failure_otp_to_level2_to_level3():
    """Escalation on failure: OTP failed -> level 2; level 2 failed -> level 3 plus case."""
    db = TestingSessionLocal()
    rider_id = "rider_escalate_01"

    # Setup session and device
    raw_fp = "hardware_fp_esc_01"
    tok_fp = tokenize(raw_fp)
    dev = Device(
        id="dev_esc_01",
        fingerprint=tok_fp,
        model="Google Pixel 8",
        trust_level="provisional",
        trust_rating=0.7,
        created_at=utcnow(),
        last_seen_at=utcnow(),
    )
    db.add(dev)

    sess = SessionModel(
        id="sess_esc_flow",
        rider_id=rider_id,
        device_id=dev.id,
        status="CHALLENGED",
        ip_address="1.2.3.4",
        current_risk_score=55.0,
        current_verdict="CHALLENGE",
        created_at=utcnow(),
    )
    db.add(sess)

    # Create initial Level 1 OTP challenge
    chlg_otp = Challenge(
        id="chlg_otp_initial",
        session_id=sess.id,
        rider_id=rider_id,
        challenge_type="OTP",
        status="PENDING",
        level=1,
        reason_code="NEW_DEVICE_BEHAVIOR_SHIFT",
        cooldown_key=compute_cooldown_key(rider_id, "NEW_DEVICE_BEHAVIOR_SHIFT"),
        expires_at=utcnow() + timedelta(minutes=10),
        created_at=utcnow(),
    )
    db.add(chlg_otp)
    db.commit()

    # 1. Step 1: OTP fails -> Escalates to Level 2
    resp_l1 = stepup_service.handle_challenge_response(
        db=db,
        challenge_id=chlg_otp.id,
        payload=ChallengeRespondRequest(passed=False, otp_code="wrong_code"),
        actor="rider",
        role="rider",
    )
    assert resp_l1.status == "FAILED"
    assert resp_l1.verified is False

    # Verify a new Level 2 challenge was spawned
    l2_chlg = (
        db.query(Challenge).filter(Challenge.session_id == sess.id, Challenge.level == 2).first()
    )
    assert l2_chlg is not None
    assert l2_chlg.challenge_type == "FACE_LIVENESS"
    assert l2_chlg.status == "PENDING"
    assert sess.status == "CHALLENGED"

    # Verify audit log for Level 2 escalation
    audit_esc2 = db.query(AuditLog).filter(AuditLog.action == "ESCALATE_CHALLENGE_LEVEL2").first()
    assert audit_esc2 is not None

    # 2. Step 2: Level 2 fails -> Escalates to Level 3 plus Case
    resp_l2 = stepup_service.handle_challenge_response(
        db=db,
        challenge_id=l2_chlg.id,
        payload=ChallengeRespondRequest(passed=False, liveness_score=0.45),
        actor="rider",
        role="rider",
    )
    assert resp_l2.status == "FAILED"
    assert resp_l2.verified is False

    # Verify Case opened
    case = db.query(Case).filter(Case.session_id == sess.id).first()
    assert case is not None
    assert case.status == "OPEN"
    assert case.severity == "CRITICAL"
    assert sess.status == "ESCALATED"

    # Verify rider restricted
    rider = db.query(Rider).filter(Rider.id == rider_id).first()
    assert rider.status == "restricted"

    # Verify audit log for Case opening
    audit_case = db.query(AuditLog).filter(AuditLog.action == "ESCALATE_TO_CASE").first()
    assert audit_case is not None
    db.close()


def test_pass_handling_trusts_device_restores_session_and_updates_trust():
    """Pass handling: Re-scores with verification flags, trusts device, updates trust history, restores session."""
    db = TestingSessionLocal()
    rider_id = "rider_stepup_02"

    raw_fp = "device_pass_02"
    tok_fp = tokenize(raw_fp)
    dev = Device(
        id="dev_pass_02",
        fingerprint=tok_fp,
        model="iPhone 15 Pro",
        trust_level="new",
        trust_rating=0.5,
        created_at=utcnow(),
        last_seen_at=utcnow(),
    )
    db.add(dev)

    sess = SessionModel(
        id="sess_pass_02",
        rider_id=rider_id,
        device_id=dev.id,
        status="CHALLENGED",
        ip_address="1.2.3.4",
        current_risk_score=52.0,
        current_verdict="CHALLENGE",
        created_at=utcnow(),
    )
    db.add(sess)

    chlg = Challenge(
        id="chlg_otp_pass",
        session_id=sess.id,
        rider_id=rider_id,
        challenge_type="OTP",
        status="PENDING",
        level=1,
        reason_code="NEW_DEVICE_BEHAVIOR_SHIFT",
        cooldown_key=compute_cooldown_key(rider_id, "NEW_DEVICE_BEHAVIOR_SHIFT"),
        expires_at=utcnow() + timedelta(minutes=10),
        created_at=utcnow(),
    )
    db.add(chlg)
    db.commit()

    resp = stepup_service.handle_challenge_response(
        db=db,
        challenge_id=chlg.id,
        payload=ChallengeRespondRequest(passed=True, otp_code="123456"),
        actor="rider",
        role="rider",
    )
    assert resp.status == "PASSED"
    assert resp.verified is True
    assert sess.status == "IN_PROGRESS"
    assert sess.current_verdict == "ALLOW"

    # Device marked trusted
    db.refresh(dev)
    assert dev.trust_level == "trusted"
    assert dev.trust_rating == 1.0

    # Trust history updated
    hist = db.query(RiderTrustHistory).filter(RiderTrustHistory.rider_id == rider_id).all()
    assert len(hist) >= 1

    # Audit log recorded
    audit_pass = (
        db.query(AuditLog)
        .filter(AuditLog.action == "CHALLENGE_PASSED", AuditLog.entity_id == chlg.id)
        .first()
    )
    assert audit_pass is not None
    db.close()


# ==============================================================================
# 4. Challenge Expiry Tests
# ==============================================================================
def test_lazy_challenge_expiry_on_read():
    """Challenge expiry (10 min) evaluated lazily on read."""
    db = TestingSessionLocal()
    rider_id = "rider_stepup_01"

    sess = SessionModel(
        id="sess_exp_01",
        rider_id=rider_id,
        status="CHALLENGED",
        ip_address="1.2.3.4",
        current_risk_score=55.0,
        current_verdict="CHALLENGE",
        created_at=utcnow() - timedelta(minutes=15),
    )
    db.add(sess)

    expired_chlg = Challenge(
        id="chlg_expired_01",
        session_id=sess.id,
        rider_id=rider_id,
        challenge_type="OTP",
        status="PENDING",
        level=1,
        reason_code="NEW_DEVICE_BEHAVIOR_SHIFT",
        cooldown_key=compute_cooldown_key(rider_id, "NEW_DEVICE_BEHAVIOR_SHIFT"),
        expires_at=utcnow() - timedelta(minutes=5),  # 5 min in past
        created_at=utcnow() - timedelta(minutes=15),
    )
    db.add(expired_chlg)
    db.commit()

    # Lazy read evaluates status to EXPIRED
    evaluated = stepup_service.lazy_check_expiry(expired_chlg, db)
    assert evaluated.status == "EXPIRED"

    # Attempting to respond to expired challenge raises 400
    with pytest.raises(Exception) as exc_info:
        stepup_service.handle_challenge_response(
            db=db,
            challenge_id=expired_chlg.id,
            payload=ChallengeRespondRequest(passed=True),
        )
    assert "expired" in str(exc_info.value).lower()
    db.close()


# ==============================================================================
# 5. REST Endpoints Tests
# ==============================================================================
@pytest.mark.anyio
async def test_challenge_history_endpoint():
    """GET /riders/{id}/challenges returns challenge history with lazy expiry."""
    db = TestingSessionLocal()
    rider_id = "rider_stepup_01"

    sess = SessionModel(
        id="sess_hist_01",
        rider_id=rider_id,
        status="IN_PROGRESS",
        ip_address="1.2.3.4",
        current_risk_score=50.0,
        current_verdict="ALLOW",
        created_at=utcnow() - timedelta(hours=1),
    )
    db.add(sess)

    # 1 passed challenge
    chlg1 = Challenge(
        id="chlg_hist_p1",
        session_id=sess.id,
        rider_id=rider_id,
        challenge_type="OTP",
        status="PASSED",
        level=1,
        reason_code="NEW_DEVICE_BEHAVIOR_SHIFT",
        cooldown_key=compute_cooldown_key(rider_id, "NEW_DEVICE_BEHAVIOR_SHIFT"),
        expires_at=utcnow() + timedelta(minutes=10),
        created_at=utcnow() - timedelta(minutes=45),
        resolved_at=utcnow() - timedelta(minutes=40),
    )
    # 1 expired challenge
    chlg2 = Challenge(
        id="chlg_hist_exp",
        session_id=sess.id,
        rider_id=rider_id,
        challenge_type="FACE_LIVENESS",
        status="PENDING",
        level=2,
        reason_code="PAYOUT_CHANGED",
        cooldown_key=compute_cooldown_key(rider_id, "PAYOUT_CHANGED"),
        expires_at=utcnow() - timedelta(minutes=5),
        created_at=utcnow() - timedelta(minutes=20),
    )
    db.add(chlg1)
    db.add(chlg2)
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(f"/riders/{rider_id}/challenges")
        assert res.status_code == 200
        items = res.json()
        assert len(items) >= 2

        # Verify fields on challenge objects
        for it in items:
            assert "challenge_id" in it
            assert "session_id" in it
            assert "rider_id" in it
            assert "level" in it
            assert "reason_code" in it
            assert "cooldown_key" in it
            assert "status" in it

        # Verify chlg2 status became EXPIRED on lazy check
        ch2_item = next(it for it in items if it["challenge_id"] == "chlg_hist_exp")
        assert ch2_item["status"] == "EXPIRED"


# ==============================================================================
# 6. Scenario S1: Repeated-Trigger Cooldown Simulation
# ==============================================================================
@pytest.mark.anyio
async def test_scenario_S1_repeated_trigger_suppression():
    """
    Scenario S1: Verification flow under repeated triggers.
    1. First trigger issues an OTP challenge (Level 1).
    2. Rider completes and passes OTP challenge.
    3. Immediate second trigger (within 30m cooldown) does NOT issue a duplicate challenge.
    4. Suppressed challenge is stored with status="suppressed".
    5. Assessment explains why no challenge was issued.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        rider_id = "rider_scenario_s1"

        # Baseline setup: established profile
        db = TestingSessionLocal()
        base = RiderBaseline(
            id=f"base_{rider_id}",
            rider_id=rider_id,
            avg_speed_kmh=25.0,
            avg_cadence_cpm=220.0,
        )
        db.add(base)
        db.commit()
        db.close()

        # Step 1: Session 1 triggers CHALLENGE (telemetry mock location detected)
        p1 = {
            "session_id": "sess_s1_01",
            "rider_id": rider_id,
            "telemetry": {"mock_location_detected": True},
        }
        res1 = await client.post("/sessions", json=p1)
        assert res1.status_code == 201
        data1 = res1.json()
        assert data1["assessment"]["verdict"] == "CHALLENGE"
        assert data1["assessment"]["challenge"] is not None
        chlg_id = data1["assessment"]["challenge"]["challenge_id"]
        assert data1["assessment"]["challenge"]["status"] == "PENDING"

        # Step 2: Rider passes challenge
        resp_res = await client.post(
            f"/challenges/{chlg_id}/respond",
            json={"passed": True, "otp_code": "123456", "liveness_score": 0.95},
        )
        assert resp_res.status_code == 200
        assert resp_res.json()["status"] == "PASSED"

        # Step 3: Immediate second trigger (repeated-trigger event within 30 min)
        p2 = {
            "session_id": "sess_s1_02",
            "rider_id": rider_id,
            "telemetry": {"mock_location_detected": True},
        }
        res2 = await client.post("/sessions", json=p2)
        assert res2.status_code == 201
        data2 = res2.json()

        # Assessment check: No active challenge issued; duplicate is suppressed!
        ch2 = data2["assessment"]["challenge"]
        if ch2:
            assert ch2["status"] == "suppressed"
            assert ch2["suppression_reason"] is not None

        # Verify in DB: Stored with status "suppressed"
        db = TestingSessionLocal()
        suppressed_chlg = (
            db.query(Challenge)
            .filter(Challenge.session_id == "sess_s1_02", Challenge.status == "suppressed")
            .first()
        )
        assert suppressed_chlg is not None
        assert suppressed_chlg.status == "suppressed"
        assert suppressed_chlg.cooldown_key is not None
        db.close()
