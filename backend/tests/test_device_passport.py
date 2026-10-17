"""
Unit & Integration Tests for TrustJuggler Device Trust Passport & Hardware Attestation Engine.
Tests:
- emulator or rooted raises device_risk
- one device with 3 riders gives 1.0 and MULTI_ACCOUNT factor
- mock-location flag is sticky
- trust lifecycle transitions (new -> provisional -> trusted -> blocked) with audit logging
- passport endpoint masks PII for analyst
- scenario: new phone -> provisional -> trusted after streak of 3 sessions
- /devices endpoint filters by trust_level and linked_riders>1
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.main import app
from app.models.entities import AuditLog, DeviceRider, Rider, utcnow
from app.scoring.device import (
    device_risk,
    evaluate_device,
    get_device_factors,
    trusted_device_signal,
)
from app.services.device_service import device_service

# In-memory SQLite with StaticPool for isolated in-memory test execution
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine, future=True)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_passport_test_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=test_engine)
    db = TestingSession()

    # Seed riders
    for rid in ["rider_dev_01", "rider_dev_02", "rider_dev_03"]:
        r = Rider(
            id=rid,
            display_name=f"John Doe {rid[-2:]}",
            phone_number="+1-555-0199",
            email=f"{rid}@example.com",
            status="active",
        )
        db.add(r)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)


# ==============================================================================
# 1. Pure Scoring Tests
# ==============================================================================
def test_emulator_or_rooted_raises_device_risk():
    """Validation: emulator or rooted raises device_risk; attaches factor records."""
    clean_passport = {
        "is_emulator": False,
        "is_rooted": False,
        "mock_location_seen": False,
        "linked_rider_count": 1,
        "network_reputation": 1.0,
    }
    clean_score = device_risk(clean_passport)
    assert clean_score == 0.0
    assert len(clean_score.factors) == 0
    assert trusted_device_signal(clean_passport) == 1.0

    # Emulator: 0.5 * 1.0 = 0.5
    emu_passport = {**clean_passport, "is_emulator": True}
    emu_score = device_risk(emu_passport)
    assert emu_score >= 0.5
    assert any(f.code == "DEVICE_EMULATOR" for f in emu_score.factors)
    assert trusted_device_signal(emu_passport) == 0.0

    # Rooted: 0.4 * 1.0 = 0.4
    root_passport = {**clean_passport, "is_rooted": True}
    root_score = device_risk(root_passport)
    assert root_score >= 0.4
    assert any(f.code == "DEVICE_ROOTED" for f in root_score.factors)
    assert trusted_device_signal(root_passport) == 0.0

    # Both emulator and rooted: 0.5 + 0.4 = 0.9
    combo_passport = {**clean_passport, "is_emulator": True, "is_rooted": True}
    combo_score = device_risk(combo_passport)
    assert combo_score >= 0.9
    codes = [f.code for f in combo_score.factors]
    assert "DEVICE_EMULATOR" in codes
    assert "DEVICE_ROOTED" in codes


def test_one_device_with_three_riders_gives_one_and_multi_account_factor():
    """
    Validation: One device with 3 riders gives device_risk == 1.0
    and attaches MULTI_ACCOUNT factor.
    """
    shared_3_passport = {
        "is_emulator": False,
        "is_rooted": False,
        "mock_location_seen": False,
        "linked_rider_count": 3,
        "network_reputation": 1.0,
    }
    score = device_risk(shared_3_passport)
    assert score == 1.0

    factors = get_device_factors(shared_3_passport)
    assert any("MULTI_ACCOUNT" in f.code for f in factors)
    match = next(f for f in factors if "MULTI_ACCOUNT" in f.code)
    assert match.code == "DEVICE_MULTI_ACCOUNT"
    assert match.impact == "CRITICAL"
    assert "3 distinct rider accounts" in match.explanation


def test_device_two_riders_collision_score():
    """Validation: 2 riders on 1 device gives linked risk 0.6."""
    shared_2_passport = {
        "is_emulator": False,
        "is_rooted": False,
        "mock_location_seen": False,
        "linked_rider_count": 2,
        "network_reputation": 1.0,
    }
    score = device_risk(shared_2_passport)
    assert score == 0.6
    factors = get_device_factors(shared_2_passport)
    assert any("MULTI_ACCOUNT" in f.code for f in factors)


def test_poor_network_reputation_factor():
    """Validation: Low network reputation raises risk and attaches factor."""
    low_net_passport = {
        "is_emulator": False,
        "is_rooted": False,
        "mock_location_seen": False,
        "linked_rider_count": 1,
        "network_reputation": 0.20,
    }
    score = device_risk(low_net_passport)
    assert score > 0.0
    factors = get_device_factors(low_net_passport)
    assert any(f.code == "POOR_NETWORK_REPUTATION" for f in factors)


# ==============================================================================
# 2. Service & Lifecycle Tests
# ==============================================================================
def test_mock_location_flag_is_sticky():
    """
    Validation: Mock location flag is sticky once seen on a device.
    Subsequent sessions with clean telemetry do NOT clear the flag.
    """
    db = TestingSession()
    device_token = "hw_sticky_test_99"

    # 1. First session flags mock location
    dev1 = device_service.upsert_passport(
        db=db,
        session_ctx={
            "rider_id": "rider_dev_01",
            "raw_fingerprint": device_token,
            "mock_location_detected": True,
        },
    )
    db.commit()
    assert dev1.mock_location_seen is True

    # 2. Subsequent session without mock location flag
    dev2 = device_service.upsert_passport(
        db=db,
        session_ctx={
            "rider_id": "rider_dev_01",
            "raw_fingerprint": device_token,
            "mock_location_detected": False,
        },
    )
    db.commit()
    # MUST REMAIN TRUE
    assert dev2.mock_location_seen is True

    # Evaluates device risk including MOCK_LOCATION factor
    eval_res = evaluate_device(dev2)
    assert eval_res.device_risk >= 0.5
    assert any(f.code == "MOCK_LOCATION" for f in eval_res.factors)
    db.close()


def test_trust_lifecycle_transitions():
    """
    Validation: Trust lifecycle transitions:
    new -> provisional (seen, no risk flags) -> trusted (OTP, selfie, or streak) -> blocked (analyst)
    All recorded in audit log.
    """
    db = TestingSession()
    device_token = "hw_lifecycle_test_01"

    # Step 1: New clean device registers -> automatically transitions to provisional
    dev = device_service.upsert_passport(
        db=db,
        session_ctx={
            "rider_id": "rider_dev_01",
            "raw_fingerprint": device_token,
            "is_emulator": False,
            "is_rooted": False,
        },
    )
    db.commit()
    assert dev.trust_level == "provisional"

    # Verify audit log recorded transition
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.entity_id == dev.id, AuditLog.action == "DEVICE_TRUST_TRANSITION")
        .all()
    )
    assert len(logs) >= 1
    assert "new -> provisional" in logs[0].detail

    # Step 2: Challenge OTP passed -> transitions to trusted
    dev = device_service.upsert_passport(
        db=db,
        session_ctx={
            "rider_id": "rider_dev_01",
            "raw_fingerprint": device_token,
            "otp_passed": True,
        },
    )
    db.commit()
    assert dev.trust_level == "trusted"
    assert dev.trust_rating == 1.0

    # Step 3: Security Analyst blocks device
    dev = device_service.block_device(
        db=db,
        device_id=dev.id,
        reason="Detected emulator farm connection",
        actor="analyst_alice",
        role="analyst",
    )
    db.commit()
    assert dev.trust_level == "blocked"
    assert dev.passport_score == 0.0
    assert dev.trust_rating == 0.0

    logs_after = (
        db.query(AuditLog)
        .filter(AuditLog.entity_id == dev.id, AuditLog.action == "DEVICE_TRUST_TRANSITION")
        .all()
    )
    assert any("-> blocked" in log_item.detail for log_item in logs_after)
    db.close()


def test_scenario_new_phone_to_provisional_to_trusted_streak():
    """
    Validation Scenario: New phone starts 'new', automatically transitions to 'provisional',
    and graduates to 'trusted' after a streak of 3 clean consistent sessions.
    """
    db = TestingSession()
    phone_token = "hw_streak_test_grad_01"

    # Session 1: Clean session
    dev = device_service.upsert_passport(
        db=db,
        session_ctx={
            "rider_id": "rider_dev_01",
            "raw_fingerprint": phone_token,
            "is_emulator": False,
            "is_rooted": False,
        },
    )
    db.commit()
    assert dev.trust_level == "provisional"
    assert dev.streak_count == 1

    # Session 2: Second clean session
    dev = device_service.upsert_passport(
        db=db,
        session_ctx={
            "rider_id": "rider_dev_01",
            "raw_fingerprint": phone_token,
            "is_emulator": False,
            "is_rooted": False,
        },
    )
    db.commit()
    assert dev.trust_level == "provisional"
    assert dev.streak_count == 2

    # Session 3: Third clean session -> graduates to trusted!
    dev = device_service.upsert_passport(
        db=db,
        session_ctx={
            "rider_id": "rider_dev_01",
            "raw_fingerprint": phone_token,
            "is_emulator": False,
            "is_rooted": False,
        },
    )
    db.commit()
    assert dev.trust_level == "trusted"
    assert dev.streak_count >= 3
    assert dev.trust_rating == 1.0

    db.close()


# ==============================================================================
# 3. REST API Endpoint Tests
# ==============================================================================
@pytest.mark.anyio
async def test_passport_endpoint_masks_pii_for_analyst():
    """
    Validation: GET /devices/{id}/passport returns passport details and masks
    PII on linked riders for role=analyst, while admin sees unmasked data.
    """
    # 1. Setup a device with linked rider
    db = TestingSession()
    token = "hw_analyst_mask_test_01"
    dev = device_service.upsert_passport(
        db=db,
        session_ctx={
            "rider_id": "rider_dev_01",
            "raw_fingerprint": token,
            "is_emulator": False,
            "is_rooted": False,
        },
    )
    db.commit()
    dev_id = dev.id
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Analyst request (default role or X-Role: analyst)
        resp_analyst = await client.get(
            f"/api/v1/devices/{dev_id}/passport",
            headers={"X-Role": "analyst"},
        )
        assert resp_analyst.status_code == 200
        data_analyst = resp_analyst.json()

        assert "linked_riders" in data_analyst
        assert len(data_analyst["linked_riders"]) >= 1
        analyst_rider = data_analyst["linked_riders"][0]

        # Display name and phone MUST be masked for analyst
        assert "*" in analyst_rider["display_name"]
        assert "*" in analyst_rider["phone_number"]
        assert analyst_rider["display_name"] != "John Doe 01"

        # Admin request (X-Role: admin)
        resp_admin = await client.get(
            f"/api/v1/devices/{dev_id}/passport",
            headers={"X-Role": "admin"},
        )
        assert resp_admin.status_code == 200
        data_admin = resp_admin.json()

        admin_rider = data_admin["linked_riders"][0]
        # Admin sees raw unmasked PII
        assert admin_rider["display_name"] == "John Doe 01"
        assert admin_rider["phone_number"] == "+1-555-0199"


@pytest.mark.anyio
async def test_devices_list_and_filters():
    """
    Validation: GET /devices supports filters:
    - trust_level
    - linked_riders>1
    """
    db = TestingSession()
    # Device A: Single rider, trusted
    dev_a = device_service.upsert_passport(
        db=db,
        session_ctx={
            "rider_id": "rider_dev_01",
            "raw_fingerprint": "hw_filter_single_trusted",
            "otp_passed": True,
        },
    )
    # Device B: 2 riders (collision)
    dev_b = device_service.upsert_passport(
        db=db,
        session_ctx={
            "rider_id": "rider_dev_01",
            "raw_fingerprint": "hw_filter_shared_collision",
        },
    )
    # Link second rider to Device B
    link2 = DeviceRider(
        id="dr_shared_b_2",
        device_id=dev_b.id,
        rider_id="rider_dev_02",
        is_primary=False,
        first_used_at=utcnow(),
        last_used_at=utcnow(),
    )
    db.add(link2)
    db.commit()
    dev_a_id = dev_a.id
    dev_b_id = dev_b.id
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Filter by trust_level=trusted
        res_trusted = await client.get("/api/v1/devices?trust_level=trusted")
        assert res_trusted.status_code == 200
        trusted_ids = [d["id"] for d in res_trusted.json()]
        assert dev_a_id in trusted_ids

        # Filter by linked_riders>1=true
        res_collision = await client.get("/api/v1/devices?linked_riders>1=true")
        assert res_collision.status_code == 200
        collision_ids = [d["id"] for d in res_collision.json()]
        assert dev_b_id in collision_ids
        assert dev_a_id not in collision_ids
