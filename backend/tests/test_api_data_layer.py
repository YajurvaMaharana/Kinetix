import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.main import app
from app.models.entities import Device, Rider
from app.models.entities import Session as SessionModel
from app.services.events_bus import event_bus
from app.services.privacy import tokenize

# In-memory SQLite with StaticPool for isolated in-memory test execution
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
    for rid in ["rider_alice_01", "rider_bob_01", "rider_chlg_01", "rider_esc_01", "rider_priv_01", "rider_audit_01"]:
        r = Rider(
            id=rid,
            display_name=rid,
            phone_number="+1-555-0100",
            email=f"{rid}@example.com",
            status="active",
        )
        db.add(r)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.anyio
async def test_session_happy_path():
    """
    1. Session happy path: POST /sessions creates session with trusted device,
       returns 201 with ALLOW verdict, and GET /sessions/{id} returns details.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "session_id": "sess_happy_01",
            "rider_id": "rider_alice_01",
            "device_passport": {
                "device_id_hash": "raw_device_hash_alice",
                "device_model": "iPhone 15 Pro",
                "is_emulator": False,
                "is_rooted": False,
                "ip_address": "198.51.100.22",
            },
            "telemetry": {"speed_kmh": 35.0},
        }
        res = await client.post("/sessions", json=payload, headers={"X-Role": "admin"})
        assert res.status_code == 201
        data = res.json()
        assert data["session"]["id"] == "sess_happy_01"
        assert data["assessment"]["verdict"] == "ALLOW"
        assert 0.0 <= data["assessment"]["risk_score"] <= 24.0
        assert data["assessment"]["risk_tier"] == "LOW"
        assert data["assessment"]["latency_ms"] > 0

        # Verify GET /sessions/{id}
        get_res = await client.get("/sessions/sess_happy_01")
        assert get_res.status_code == 200
        get_data = get_res.json()
        assert get_data["id"] == "sess_happy_01"
        assert 0.0 <= get_data["current_risk_score"] <= 24.0
        assert get_data["latest_assessment"]["verdict"] == "ALLOW"


@pytest.mark.anyio
async def test_event_rescoring_and_timeline():
    """
    2. Event rescoring: POST /sessions/{id}/events updates risk and registers on timeline.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create session first
        await client.post(
            "/sessions",
            json={"session_id": "sess_event_01", "rider_id": "rider_bob_01"},
            headers={"X-Role": "admin"},
        )

        # Post telemetry event
        ev_payload = {
            "event_type": "telemetry",
            "payload": {"speed_kmh": 42.0, "gyro_stability": 0.95},
        }
        res = await client.post("/sessions/sess_event_01/events", json=ev_payload)
        assert res.status_code == 200
        data = res.json()
        assert data["session_id"] == "sess_event_01"
        assert data["risk_score"] is not None

        # Verify timeline
        tl_res = await client.get("/sessions/sess_event_01/timeline")
        assert tl_res.status_code == 200
        tl_data = tl_res.json()
        assert tl_data["events_count"] >= 2
        types = [item["type"] for item in tl_data["timeline"]]
        assert "SESSION_CREATED" in types
        assert "EVENT_TELEMETRY" in types


@pytest.mark.anyio
async def test_404_handlers():
    """
    3. 404s: Verify not found errors for unknown resources.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await client.get("/sessions/unknown_session_999")
        assert r1.status_code == 404

        r2 = await client.post(
            "/sessions/unknown_session_999/events",
            json={"event_type": "location_ping", "payload": {}},
        )
        assert r2.status_code == 404

        r3 = await client.get("/riders/unknown_rider_999")
        assert r3.status_code == 404

        r3b = await client.post("/sessions", json={"rider_id": "unknown_rider_999"})
        assert r3b.status_code == 404

        r4 = await client.get("/cases/unknown_case_999")
        assert r4.status_code == 404

        r5 = await client.post(
            "/challenges/unknown_chlg_999/respond",
            json={"passed": True},
        )
        assert r5.status_code == 404


@pytest.mark.anyio
async def test_challenge_workflow():
    """
    4. Challenge flow: Anomaly triggers CHALLENGE verdict, creates Challenge record,
       and POST /challenges/{id}/respond resolves it.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Trigger challenge via telemetry mock location (GPS_SPOOFING floor 60 -> CHALLENGE)
        payload = {
            "session_id": "sess_chlg_01",
            "rider_id": "rider_chlg_01",
            "telemetry": {"mock_location_detected": True},
        }
        res = await client.post("/sessions", json=payload, headers={"X-Role": "admin"})
        assert res.status_code == 201
        data = res.json()
        assert data["assessment"]["verdict"] == "CHALLENGE"
        assert data["assessment"]["challenge"] is not None
        chlg_id = data["assessment"]["challenge"]["challenge_id"]

        # Respond to challenge
        resp_res = await client.post(
            f"/challenges/{chlg_id}/respond",
            json={"passed": True, "liveness_score": 0.98},
            headers={"X-Role": "rider"},
        )
        assert resp_res.status_code == 200
        resp_data = resp_res.json()
        assert resp_data["verified"] is True
        assert resp_data["new_verdict"] == "ALLOW"
        assert resp_data["status"] == "PASSED"

        # Verify session is restored to IN_PROGRESS
        sess_res = await client.get("/sessions/sess_chlg_01")
        assert sess_res.json()["status"] == "IN_PROGRESS"


@pytest.mark.anyio
async def test_case_escalation_and_patch():
    """
    5. Case escalation & PATCH: Mock location triggers ESCALATE, opens Case,
       and PATCH /cases/{id} updates case state and reviewer action.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "session_id": "sess_esc_01",
            "rider_id": "rider_esc_01",
            "biometrics": {"face_match_confidence": 0.20},  # FACE_MISMATCH floor 75 -> ESCALATE
        }
        res = await client.post("/sessions", json=payload, headers={"X-Role": "admin"})
        assert res.status_code == 201
        data = res.json()
        assert data["assessment"]["verdict"] == "ESCALATE"
        assert data["assessment"]["case_id"] is not None
        case_id = data["assessment"]["case_id"]

        # PATCH /cases/{id}
        patch_res = await client.patch(
            f"/cases/{case_id}",
            json={
                "status": "RESOLVED_LEGIT",
                "assigned_to": "analyst_clara",
                "notes": "Verified client was in secondary dev environment",
            },
            headers={"X-Role": "analyst", "X-Actor": "analyst_clara"},
        )
        assert patch_res.status_code == 200
        patch_data = patch_res.json()
        assert patch_data["status"] == "RESOLVED_LEGIT"
        assert patch_data["assigned_to"] == "analyst_clara"
        assert "Verified" in patch_data["notes"]


@pytest.mark.anyio
async def test_db_inspection_no_raw_ip_or_fingerprint():
    """
    6. DB inspection proves no raw IP / fingerprint persisted.
       Only 16-hex HMAC tokenized strings exist in DB.
    """
    transport = ASGITransport(app=app)
    raw_secret_fp = "SUPER_SECRET_RAW_IMEI_AND_MAC_ADDR_998811"
    raw_secret_ip = "198.51.100.77"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "session_id": "sess_privacy_01",
            "rider_id": "rider_priv_01",
            "device_passport": {
                "device_id_hash": raw_secret_fp,
                "ip_address": raw_secret_ip,
            },
        }
        res = await client.post("/sessions", json=payload, headers={"X-Role": "admin"})
        assert res.status_code == 201

    # Direct database inspection
    db = TestingSessionLocal()
    try:
        # Check devices table
        devices = db.query(Device).all()
        for d in devices:
            assert raw_secret_fp not in d.fingerprint
            assert d.fingerprint == tokenize(raw_secret_fp)
            assert len(d.fingerprint) == 16

        # Check sessions table
        sess = db.query(SessionModel).filter(SessionModel.id == "sess_privacy_01").first()
        assert sess is not None
        assert raw_secret_ip not in sess.ip_address
        assert sess.ip_address == tokenize(raw_secret_ip)
        assert len(sess.ip_address) == 16
    finally:
        db.close()


@pytest.mark.anyio
async def test_analyst_response_masks_display_name_and_phone():
    """
    7. Privacy masking: role=analyst gets masked name and phone; role=admin gets unmasked.
    """
    # Seed rider directly
    db = TestingSessionLocal()
    try:
        r = Rider(
            id="rider_mask_test_01",
            display_name="Catherine Elizabeth Halsey",
            phone_number="+1-555-0199",
            email="halsey@unsc.gov",
            status="active",
        )
        db.add(r)
        db.commit()
    finally:
        db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Analyst view (Masked)
        analyst_res = await client.get("/riders/rider_mask_test_01", headers={"X-Role": "analyst"})
        assert analyst_res.status_code == 200
        analyst_data = analyst_res.json()
        assert analyst_data["display_name"] != "Catherine Elizabeth Halsey"
        assert "*" in analyst_data["display_name"]
        assert "*" in analyst_data["phone_number"]

        # 2. Admin view (Unmasked)
        admin_res = await client.get("/riders/rider_mask_test_01", headers={"X-Role": "admin"})
        assert admin_res.status_code == 200
        admin_data = admin_res.json()
        assert admin_data["display_name"] == "Catherine Elizabeth Halsey"
        assert admin_data["phone_number"] == "+1-555-0199"


@pytest.mark.anyio
async def test_audit_logs_and_admin_role_restriction():
    """
    8. Audit rows exist & role=admin restriction:
       GET /audit-logs returns 403 for analyst, 200 for admin.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Perform action that creates audit logs
        await client.post(
            "/sessions",
            json={"session_id": "sess_audit_01", "rider_id": "rider_audit_01"},
            headers={"X-Role": "admin", "X-Actor": "admin_user"},
        )

        # Analyst is forbidden from /audit-logs
        analyst_res = await client.get("/audit-logs", headers={"X-Role": "analyst"})
        assert analyst_res.status_code == 403

        # Admin gets logs
        admin_res = await client.get("/audit-logs", headers={"X-Role": "admin"})
        assert admin_res.status_code == 200
        logs = admin_res.json()
        assert len(logs) > 0
        actions = [log["action"] for log in logs]
        assert "ASSESS_SESSION" in actions


@pytest.mark.anyio
async def test_sse_endpoint_yields_event():
    """
    9. SSE: Server-Sent Events stream yields connection ping and events when sessions are created.
    """
    # Test event_bus generator directly
    gen = event_bus.sse_generator()
    first_chunk = await gen.asend(None)
    assert "event: ping" in first_chunk

    # Trigger event publication
    event_bus.publish("test_alert", {"msg": "Fraud ring activity detected"})
    second_chunk = await gen.asend(None)
    assert "event: test_alert" in second_chunk
    assert "Fraud ring" in second_chunk

    await gen.aclose()
