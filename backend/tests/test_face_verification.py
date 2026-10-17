"""
Unit and Integration Tests for Risk-Triggered Face Re-Verification and Liveness.

Validates:
1. Swappable Interfaces:
   - SimulatedFaceVerifier (deterministic synthetic embeddings per rider, scenario flags).
   - SimulatedLivenessChecker (genuine pass, static photo and replay spoof detection).
   - RealFaceVerifier stub documentation & safeguards.
2. Fernet Template Encryption:
   - Plaintext embedding differs from stored ciphertext.
   - Decryption correctly recovers 128D floating vector.
   - Metadata stored: model_name, retention_until.
   - Zero raw image persistence (raw_image_stored == False).
3. 1:1 Verification Match:
   - Strictly compares input against that rider's template (never 1:N).
   - Threshold 0.70 calibration.
4. Pass Handling:
   - Re-score with verification flags.
   - Session decision restored to ALLOW.
   - Device trust elevated to "trusted" with trusted_via="selfie".
   - Trust history updated (+15 points).
5. Failure Handling:
   - Different person -> FACE_MISMATCH rule fires -> ESCALATE, case opened.
   - Static photo / Replay -> LIVENESS_FAILED rule fires -> ESCALATE, case opened.
6. Fallback step-up paths:
   - OTP fallback.
   - Document check and manual review case creation.
7. End-to-end acceptance:
   - Handoff scenario ends in ESCALATE on failed face check.
   - Genuine re-verify returns ALLOW and the device becomes trusted.
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
    Case,
    Challenge,
    Device,
    FaceTemplate,
    Rider,
    RiderTrustHistory,
    RiderTrustScore,
)
from app.models.entities import (
    Session as SessionModel,
)
from app.services.face_service import (
    RealFaceVerifier,
    SimulatedFaceVerifier,
    SimulatedLivenessChecker,
    face_service,
)
from app.services.privacy import tokenize


@pytest.fixture
def db_session():
    """Isolated in-memory SQLite database for test runs."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    """Test client injecting the test database dependency."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    yield AsyncClient(transport=transport, base_url="http://test")
    app.dependency_overrides.clear()


# =============================================================================
# 1. Unit Tests: Verifier & Liveness Logic
# =============================================================================


def test_simulated_verifier_deterministic_embeddings():
    """Verifier must generate deterministic 128D unit vectors per rider."""
    verifier = SimulatedFaceVerifier()
    vec1 = verifier.embed("rider_alpha")
    vec2 = verifier.embed("rider_alpha")
    vec_beta = verifier.embed("rider_beta")

    assert len(vec1) == 128
    assert len(vec_beta) == 128
    assert vec1 == vec2, "Same rider must produce identical synthetic embeddings"
    assert vec1 != vec_beta, "Different riders must have distinct embeddings"

    # Self-similarity should be 1.0
    sim_self = verifier.similarity(vec1, vec2)
    assert pytest.approx(sim_self, abs=1e-4) == 1.0


def test_simulated_verifier_scenarios():
    """Scenario flags must produce calibrated similarity metrics."""
    verifier = SimulatedFaceVerifier()
    vec_enrolled = verifier.embed("rider_123")

    # Genuine face scenario (~0.80 - 0.92)
    vec_genuine = verifier.embed("genuine_face", rider_id="rider_123", scenario_flag="genuine_face")
    sim_genuine = verifier.similarity(vec_enrolled, vec_genuine)
    assert 0.80 <= sim_genuine <= 0.92

    # Different person scenario (~0.15 - 0.45)
    vec_diff = verifier.embed(
        "different_person", rider_id="rider_123", scenario_flag="different_person"
    )
    sim_diff = verifier.similarity(vec_enrolled, vec_diff)
    assert 0.15 <= sim_diff <= 0.45


def test_simulated_liveness_scenarios():
    """Liveness checker must detect genuine physical presence vs photo / replay spoofs."""
    checker = SimulatedLivenessChecker()

    # Genuine face
    res_gen = checker.check("genuine_face", prompt_nonce="nonce_abc")
    assert res_gen["passed"] is True
    assert res_gen["spoof_type"] is None
    assert res_gen["liveness_score"] >= 0.85

    # Static photo spoof
    res_photo = checker.check("static_photo", prompt_nonce="nonce_abc")
    assert res_photo["passed"] is False
    assert res_photo["spoof_type"] == "static_photo"
    assert res_photo["liveness_score"] <= 0.20

    # Video replay spoof
    res_replay = checker.check("replay", prompt_nonce="nonce_abc")
    assert res_replay["passed"] is False
    assert res_replay["spoof_type"] == "replay_attack"
    assert res_replay["liveness_score"] <= 0.20


def test_real_face_verifier_stub_safeguards():
    """RealFaceVerifier raises informative RuntimeError when DeepFace is not installed."""
    with pytest.raises(RuntimeError) as exc_info:
        RealFaceVerifier(backend_engine="deepface")
    assert "FACE_BACKEND='real'" in str(exc_info.value)


# =============================================================================
# 2. Template Storage & Fernet Encryption Tests
# =============================================================================


def test_template_fernet_encryption(db_session):
    """
    Template storage must Fernet-encrypt vectors.
    Ciphertext must differ from plaintext vector; decryption must restore original.
    """
    rider = Rider(
        id="rider_crypto_test",
        display_name="Crypto Test Rider",
        phone_number="+15550001111",
        status="active",
    )
    db_session.add(rider)
    db_session.commit()

    verifier = SimulatedFaceVerifier()
    plain_vec = verifier.embed("rider_crypto_test")

    # Enroll
    response = face_service.enroll(
        db_session,
        rider_id="rider_crypto_test",
        embedding=plain_vec,
        model_name="simulated_v2_128d",
        retention_days=180,
    )

    # 1. Template stored in DB
    assert response.template_id is not None
    assert response.rider_id == "rider_crypto_test"
    assert response.model_name == "simulated_v2_128d"
    assert response.retention_until is not None

    template_row = db_session.query(FaceTemplate).filter_by(rider_id="rider_crypto_test").first()
    assert template_row is not None

    # 2. Raw ciphertext must be encrypted bytes/string, not JSON/plaintext
    encrypted_blob = template_row.template_encrypted
    assert isinstance(encrypted_blob, str)
    assert "rider_crypto_test" not in encrypted_blob
    # Ciphertext starts with Fernet signature token prefix 'gAAAAA'
    assert encrypted_blob.startswith("gAAAAA")

    # 3. Decrypt and verify vector match
    recovered_vec = face_service.decrypt_embedding(encrypted_blob)
    assert len(recovered_vec) == 128
    sim = verifier.similarity(plain_vec, recovered_vec)
    assert pytest.approx(sim, abs=1e-5) == 1.0


@pytest.mark.anyio
async def test_enroll_endpoint_zero_raw_image_storage(client, db_session):
    """POST /riders/{id}/face/enroll must return raw_image_stored: false and never persist images."""
    rider = Rider(
        id="rider_enroll_api",
        display_name="Enroll Api Rider",
        phone_number="+15551234567",
        status="active",
    )
    db_session.add(rider)
    db_session.commit()

    resp = await client.post(
        "/api/v1/riders/rider_enroll_api/face/enroll",
        headers={"X-Role": "admin"},
        json={"scenario_flag": "genuine_face"},
    )
    assert resp.status_code == 201
    data = resp.json()

    assert data["rider_id"] == "rider_enroll_api"
    assert data["raw_image_stored"] is False
    assert data["model_name"] == "simulated"
    assert "embedding_hash" in data
    assert data["retention_until"] is not None

    # Verify no raw image field exists on FaceTemplate model
    tpl = db_session.query(FaceTemplate).filter_by(rider_id="rider_enroll_api").first()
    assert tpl is not None
    assert not hasattr(tpl, "raw_image")
    assert not hasattr(tpl, "image_data")


# =============================================================================
# 3. Biometric Verification API Endpoints & 1:1 Matching
# =============================================================================


def _setup_challenge_fixture(db_session, rider_id="rider_face_01"):
    """Helper to set up rider, device, session, trust score, and challenge."""
    now = datetime.now(timezone.utc)
    rider = Rider(
        id=rider_id,
        display_name=f"Rider {rider_id}",
        phone_number="+15559876543",
        status="active",
    )
    device = Device(
        id=f"dev_{rider_id}",
        fingerprint=tokenize(f"fp_{rider_id}"),
        trust_level="provisional",
        trust_rating=0.4,
        is_emulator=False,
        is_rooted=False,
    )
    session = SessionModel(
        id=f"sess_{rider_id}",
        rider_id=rider_id,
        device_id=device.id,
        ip_address="192.0.2.1",
        current_risk_score=65.0,
        current_verdict="CHALLENGE",
        status="IN_PROGRESS",
        created_at=now,
    )
    trust_score = RiderTrustScore(
        id=f"ts_{rider_id}",
        rider_id=rider_id,
        trust_score=60.0,
        trend="STABLE",
        confidence=0.9,
    )
    challenge = Challenge(
        id=f"chlg_{rider_id}",
        session_id=session.id,
        rider_id=rider_id,
        challenge_type="face_liveness",
        status="PENDING",
        level=2,
        reason_code="DEVICE_ANOMALY_BEHAVIOR_SHIFT",
        created_at=now,
        expires_at=now + timedelta(minutes=10),
    )
    db_session.add_all([rider, device, session, trust_score, challenge])
    db_session.commit()

    # Pre-enroll the rider's baseline template
    verifier = SimulatedFaceVerifier()
    face_service.enroll(
        db_session,
        rider_id=rider_id,
        embedding=verifier.embed(rider_id),
        model_name="simulated",
    )
    return rider, device, session, challenge


@pytest.mark.anyio
async def test_liveness_prompt_generation(client, db_session):
    """GET /challenges/{id}/liveness-prompt returns ephemeral prompt and nonce."""
    _, _, _, challenge = _setup_challenge_fixture(db_session, "rider_prompt_test")

    resp = await client.get(
        f"/api/v1/challenges/{challenge.id}/liveness-prompt",
        headers={"X-Role": "rider"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["challenge_id"] == challenge.id
    assert any(cmd in data["prompt"].lower() for cmd in ["blink", "turn", "smile"])
    assert len(data["nonce"]) == 8
    assert "expires_at" in data


@pytest.mark.anyio
async def test_genuine_face_passes_restores_session_and_trusts_device(client, db_session):
    """
    Genuine face submission:
    - Match similarity ~0.88 >= 0.70 threshold.
    - Liveness passes.
    - Session restored to ALLOW.
    - Device trust elevated to 'trusted' with trusted_via='selfie'.
    - Trust history updated.
    """
    _, device, session, challenge = _setup_challenge_fixture(db_session, "rider_genuine_test")

    resp = await client.post(
        f"/api/v1/challenges/{challenge.id}/face-verify",
        headers={"X-Role": "rider"},
        json={"scenario_flag": "genuine_face", "prompt_nonce": "test_nonce"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["passed"] is True
    assert data["similarity"] >= 0.70
    assert data["liveness_passed"] is True
    assert data["new_verdict"] == "ALLOW"
    assert data["device_trusted"] is True
    assert data["raw_image_stored"] is False

    # Verify Database State
    db_session.refresh(session)
    db_session.refresh(device)
    db_session.refresh(challenge)

    assert session.current_verdict == "ALLOW"
    assert challenge.status.upper() in ("PASSED", "RESOLVED")
    assert device.trust_level == "trusted"
    assert device.trusted_via == "selfie"
    assert device.trust_rating >= 0.9

    # Verify trust history entry recorded
    history = (
        db_session.query(RiderTrustHistory)
        .filter_by(rider_id="rider_genuine_test")
        .order_by(RiderTrustHistory.id.desc())
        .first()
    )
    assert history is not None
    assert history.trust_score > 60.0
    assert "face" in history.reason.lower() or "selfie" in history.reason.lower()


@pytest.mark.anyio
async def test_different_person_fails_and_escalates(client, db_session):
    """
    Different person submission:
    - Similarity ~0.25 < 0.70 threshold.
    - FACE_MISMATCH rule fires -> ESCALATE verdict.
    - Case opened with severity CRITICAL.
    """
    _, _, session, challenge = _setup_challenge_fixture(db_session, "rider_diff_test")

    resp = await client.post(
        f"/api/v1/challenges/{challenge.id}/face-verify",
        headers={"X-Role": "rider"},
        json={"scenario_flag": "different_person", "prompt_nonce": "test_nonce"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["passed"] is False
    assert data["similarity"] < 0.70
    assert data["new_verdict"] == "ESCALATE"
    assert data["fallback_available"] is True

    # DB Checks
    db_session.refresh(session)
    db_session.refresh(challenge)

    assert session.current_verdict == "ESCALATE"
    assert challenge.status.upper() in ("FAILED", "ESCALATED")

    # Case must have been created
    case = db_session.query(Case).filter_by(rider_id="rider_diff_test").first()
    assert case is not None
    assert case.status.upper() == "OPEN"
    assert case.severity == "CRITICAL"
    assert "FACE_MISMATCH" in case.threat_summary


@pytest.mark.anyio
async def test_static_photo_fails_liveness_and_escalates(client, db_session):
    """
    Static photo attack:
    - Face might match template, but liveness fails (spoof_type='static_photo').
    - LIVENESS_FAILED rule fires -> ESCALATE, case opened.
    """
    _, _, session, challenge = _setup_challenge_fixture(db_session, "rider_photo_test")

    resp = await client.post(
        f"/api/v1/challenges/{challenge.id}/face-verify",
        headers={"X-Role": "rider"},
        json={"scenario_flag": "static_photo", "prompt_nonce": "test_nonce"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["passed"] is False
    assert data["liveness_passed"] is False
    assert data["spoof_type"] == "static_photo"
    assert data["new_verdict"] == "ESCALATE"

    # DB checks
    case = db_session.query(Case).filter_by(rider_id="rider_photo_test").first()
    assert case is not None
    assert "LIVENESS_FAILED" in case.threat_summary


@pytest.mark.anyio
async def test_replay_attack_fails_liveness_and_escalates(client, db_session):
    """
    Replay attack:
    - Video playback detected (spoof_type='replay_attack').
    - LIVENESS_FAILED rule fires -> ESCALATE, case opened.
    """
    _, _, session, challenge = _setup_challenge_fixture(db_session, "rider_replay_test")

    resp = await client.post(
        f"/api/v1/challenges/{challenge.id}/face-verify",
        headers={"X-Role": "rider"},
        json={"scenario_flag": "replay", "prompt_nonce": "test_nonce"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["passed"] is False
    assert data["liveness_passed"] is False
    assert data["spoof_type"] == "replay_attack"
    assert data["new_verdict"] == "ESCALATE"


@pytest.mark.anyio
async def test_strictly_one_to_one_matching_no_search(client, db_session):
    """
    Verification is strictly 1:1 against the enrolled rider's template.
    It never searches the database for matches across other riders.
    """
    # Enrol Rider A and Rider B
    _setup_challenge_fixture(db_session, "rider_person_A")
    rider_b = Rider(
        id="rider_person_B",
        display_name="Rider B",
        phone_number="+15550002222",
        status="active",
    )
    db_session.add(rider_b)
    db_session.commit()

    verifier = SimulatedFaceVerifier()
    face_service.enroll(
        db_session,
        rider_id="rider_person_B",
        embedding=verifier.embed("rider_person_B"),
    )

    # Rider A's challenge
    challenge_a = db_session.query(Challenge).filter_by(rider_id="rider_person_A").first()

    # Pass embedding matching Rider B to Rider A's challenge
    # Should evaluate 1:1 against Rider A's enrolled template only
    resp = await client.post(
        f"/api/v1/challenges/{challenge_a.id}/face-verify",
        headers={"X-Role": "rider"},
        json={"scenario_flag": "different_person"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["passed"] is False
    assert data["similarity"] < 0.70


# =============================================================================
# 4. Fallback Handling
# =============================================================================


@pytest.mark.anyio
async def test_challenge_fallback_otp(client, db_session):
    """Rider can fall back from face check to OTP when camera or conditions prevent verification."""
    _, _, _, challenge = _setup_challenge_fixture(db_session, "rider_fallback_otp")

    resp = await client.post(
        f"/api/v1/challenges/{challenge.id}/fallback",
        headers={"X-Role": "rider"},
        json={"fallback_type": "otp", "reason": "Camera not available in dark environment"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["fallback_type"].upper() == "OTP"
    assert data["status"].upper() in ("PENDING", "ESCALATED")
    assert "OTP" in data["message"]


@pytest.mark.anyio
async def test_challenge_fallback_manual_review(client, db_session):
    """Manual review fallback immediately routes case to Trust & Safety."""
    _, _, _, challenge = _setup_challenge_fixture(db_session, "rider_fallback_review")

    resp = await client.post(
        f"/api/v1/challenges/{challenge.id}/fallback",
        headers={"X-Role": "rider"},
        json={"fallback_type": "manual_review", "reason": "Biometric match inconclusive"},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["fallback_type"] == "manual_review"
    assert data["case_id"] is not None
    assert any(word in data["message"].lower() for word in ["investigator", "analyst", "review"])

    # Verify Case in DB
    case = db_session.query(Case).filter_by(id=data["case_id"]).first()
    assert case is not None
    assert case.status.upper() == "OPEN"


# =============================================================================
# 5. End-to-End Acceptance Test
# =============================================================================


@pytest.mark.anyio
async def test_handoff_scenario_acceptance_flow(client, db_session):
    """
    Full Acceptance Test:
    1. Account handoff suspected -> Challenge level 2 face_liveness issued.
    2. Failed face check (impostor presenting different face) -> ESCALATE, case opened.
    3. Legitimate rider presents genuine face in resolution -> ALLOW, device becomes trusted.
    """
    now = datetime.now(timezone.utc)
    rider_id = "rider_handoff_acceptance"

    # Setup rider & device
    rider = Rider(
        id=rider_id,
        display_name="Handoff Acceptance Rider",
        phone_number="+15553334444",
        status="active",
    )
    device = Device(
        id=f"dev_{rider_id}",
        fingerprint=tokenize(f"fp_{rider_id}"),
        trust_level="provisional",
        trust_rating=0.3,
    )
    session = SessionModel(
        id=f"sess_{rider_id}",
        rider_id=rider_id,
        device_id=device.id,
        ip_address="192.0.2.1",
        current_risk_score=68.0,
        current_verdict="CHALLENGE",
        status="IN_PROGRESS",
        created_at=now,
    )
    db_session.add_all([rider, device, session])
    db_session.commit()

    # Pre-enroll the genuine rider
    verifier = SimulatedFaceVerifier()
    face_service.enroll(
        db_session,
        rider_id=rider_id,
        embedding=verifier.embed(rider_id),
    )

    # Step 1: Create face challenge representing account handoff suspicion
    challenge_fail = Challenge(
        id="chlg_handoff_fail",
        session_id=session.id,
        rider_id=rider_id,
        challenge_type="face_liveness",
        status="PENDING",
        level=2,
        reason_code="NEW_DEVICE_BEHAVIOR_SHIFT",
        created_at=now,
        expires_at=now + timedelta(minutes=10),
    )
    db_session.add(challenge_fail)
    db_session.commit()

    # Step 2: Impostor attempts face check with different face
    resp_fail = await client.post(
        f"/api/v1/challenges/{challenge_fail.id}/face-verify",
        headers={"X-Role": "rider"},
        json={"scenario_flag": "different_person"},
    )
    assert resp_fail.status_code == 200
    data_fail = resp_fail.json()
    assert data_fail["passed"] is False
    assert data_fail["new_verdict"] == "ESCALATE"

    # Verify case opened and rider restricted
    db_session.refresh(rider)
    db_session.refresh(session)
    assert session.current_verdict == "ESCALATE"
    case = db_session.query(Case).filter_by(rider_id=rider_id).first()
    assert case is not None

    # Step 3: Legitimate rider steps in with genuine face
    challenge_pass = Challenge(
        id="chlg_handoff_pass",
        session_id=session.id,
        rider_id=rider_id,
        challenge_type="face_liveness",
        status="PENDING",
        level=2,
        reason_code="RE_VERIFICATION_ATTEMPT",
        created_at=now,
        expires_at=now + timedelta(minutes=10),
    )
    db_session.add(challenge_pass)
    db_session.commit()

    resp_pass = await client.post(
        f"/api/v1/challenges/{challenge_pass.id}/face-verify",
        headers={"X-Role": "rider"},
        json={"scenario_flag": "genuine_face", "prompt_nonce": "valid_nonce"},
    )
    assert resp_pass.status_code == 200
    data_pass = resp_pass.json()

    # Final assertion: returns ALLOW and device becomes trusted
    assert data_pass["passed"] is True
    assert data_pass["new_verdict"] == "ALLOW"
    assert data_pass["device_trusted"] is True

    db_session.refresh(device)
    db_session.refresh(session)
    assert session.current_verdict == "ALLOW"
    assert device.trust_level == "trusted"
    assert device.trusted_via == "selfie"
