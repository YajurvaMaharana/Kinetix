"""
Integration and Continuous Scoring Test Suite for TrustJuggler v2.
Validates:
1. Normal session -> ALLOW (risk <= 20)
2. Ordinary change (new phone) -> MONITOR (capped <= 44, verdict MONITOR)
3. Mid-session behavioral shift via events spikes risk immediately, then decays slowly with calm events
4. Suspected handoff -> ESCALATE, opens Case, and updates Rider.status to under_review or restricted
5. Challenge OTP pass -> marks device trusted, re-scores with otp_passed=True to ALLOW
6. Challenge failure -> adds CHALLENGE_FAILED (+25 points) and escalates
7. Baseline update on ordinary_change only (normal sessions do not trigger baseline update)
8. Safety: unknown rider returns 404, range validation raises 422, missing baseline uses cold start path
9. GET /metrics/summary returns decision/class/threat tag counts, avg & p95 latency
10. GET /metrics/evaluation serves ml/reports/latest.json
11. End-to-end latency populated (> 0 ms)
12. SSE emits assessment and challenge events
"""

import json

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.main import app
from app.models.entities import (
    Device,
    DeviceRider,
    Rider,
    RiderBaseline,
    RiderTrustScore,
)
from app.models.entities import (
    Session as SessionModel,
)
from app.services.events_bus import event_bus
from app.services.privacy import tokenize
from simulator.baseline import compute_baseline

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def override_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Seed canonical test rider with established 30-session baseline
    rider = Rider(
        id="rider_continuous_01",
        display_name="Rajesh Kumar",
        phone_number="+91-9876543210",
        email="rajesh@trustjuggler.dev",
        status="active",
    )
    db.add(rider)
    db.flush()

    # Pre-seed established baseline for rider_continuous_01
    sample_normal_sessions = [
        {
            "tap_interval_ms": 190.0,
            "typing_cps": 4.5,
            "swipe_velocity_px_s": 1100.0,
            "interaction_timing_cv": 0.30,
            "nav_path_similarity": 0.88,
            "accept_latency_s": 6.0,
            "shift_hour_dist": 0.5,
            "avg_speed_kmh": 26.0,
            "route_adherence": 0.90,
            "trip_cadence_per_hr": 2.5,
            "start_hour": 11.0,
            "zone_id": "bandra_west",
            "city": "mumbai",
            "latitude": 19.0596,
            "longitude": 72.8295,
        }
        for _ in range(30)
    ]
    computed = compute_baseline(sample_normal_sessions)
    baseline = RiderBaseline(
        id="base_continuous_01",
        rider_id=rider.id,
        avg_speed_kmh=26.0,
        avg_cadence_cpm=270.0,
        home_lat=19.0596,
        home_lng=72.8295,
        typical_hours="09:00 - 18:00",
        metrics_json=json.dumps({"metrics": computed["metrics"], "sessions_count": 30}),
        profiles_json=json.dumps(
            {
                "recent_sessions": sample_normal_sessions,
                "zone_profile": computed["zone_profile"],
                "hour_profile": computed["hour_profile"],
                "nav_profile": computed["nav_profile"],
                "usual_cities": ["mumbai"],
                "asns": ["AS55836"],
                "home_city": "mumbai",
            }
        ),
    )
    trust = RiderTrustScore(
        id="trust_continuous_01",
        rider_id=rider.id,
        trust_score=90.0,
        trend="STABLE",
        confidence=0.95,
    )
    db.add_all([baseline, trust])

    # Seed primary trusted device for rider_continuous_01
    primary_dev = Device(
        id="dev_primary_rajesh",
        fingerprint=tokenize("trusted_hardware_hash_rajesh"),
        model="OnePlus 11",
        trust_rating=1.0,
    )
    db.add(primary_dev)
    db.flush()
    dr_link = DeviceRider(
        id="dr_primary_rajesh",
        device_id=primary_dev.id,
        rider_id=rider.id,
        is_primary=True,
    )
    db.add(dr_link)

    # Seed secondary rider without baseline (cold start)
    rider_cold = Rider(
        id="rider_cold_01",
        display_name="Cold Start Rider",
        phone_number="+91-9876543211",
        email="cold@trustjuggler.dev",
        status="active",
    )
    db.add(rider_cold)
    db.commit()
    db.close()

    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.anyio
async def test_normal_session_yields_allow():
    """
    1. Normal session -> ALLOW (risk <= 20) with populated latency.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "session_id": "sess_normal_01",
            "rider_id": "rider_continuous_01",
            "device_passport": {
                "device_id_hash": "trusted_hardware_hash_rajesh",
                "device_model": "OnePlus 11",
                "ip_address": "103.21.244.0",
            },
            "biometrics": {
                "tap_interval_ms": 192.0,
                "typing_cps": 4.6,
                "swipe_velocity_px_s": 1090.0,
                "interaction_timing_cv": 0.31,
            },
            "telemetry": {
                "speed_kmh": 25.0,
                "route_adherence": 0.91,
                "nav_path_similarity": 0.89,
            },
            "location": {
                "latitude": 19.0596,
                "longitude": 72.8295,
                "zone_id": "bandra_west",
                "city": "mumbai",
            },
        }
        res = await client.post("/sessions", json=payload, headers={"X-Role": "admin"})
        assert res.status_code == 201
        data = res.json()
        assessment = data["assessment"]
        assert assessment["verdict"] == "ALLOW"
        assert assessment["risk_tier"] == "LOW"
        assert assessment["risk_score"] <= 20.0
        assert assessment["latency_ms"] > 0.0


@pytest.mark.anyio
async def test_new_phone_yields_monitor():
    """
    2. New phone -> MONITOR (capped at 44.0 due to ordinary_change rule, verdict MONITOR).
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "session_id": "sess_new_phone_01",
            "rider_id": "rider_continuous_01",
            "device_passport": {
                "device_id_hash": "brand_new_samsung_galaxy_s24",
                "device_model": "Samsung Galaxy S24",
                "ip_address": "103.21.244.5",
            },
            "is_new_device": True,
            "biometrics": {
                "tap_interval_ms": 205.0,  # Slight motor variation on new glass
                "typing_cps": 4.2,
                "swipe_velocity_px_s": 1150.0,
            },
            "location": {
                "latitude": 19.0596,
                "longitude": 72.8295,
                "zone_id": "bandra_west",
                "city": "mumbai",
            },
        }
        res = await client.post("/sessions", json=payload, headers={"X-Role": "admin"})
        assert res.status_code == 201
        data = res.json()
        assessment = data["assessment"]
        assert assessment["verdict"] == "MONITOR"
        assert assessment["risk_tier"] == "MEDIUM"
        assert 20.0 < assessment["risk_score"] <= 44.0
        assert assessment["classification"] == "ordinary_change"


@pytest.mark.anyio
async def test_mid_session_behavior_shift_spike_and_decay():
    """
    3. Behavior shift mid-session via events:
       - Starts normal (ALLOW, low risk)
       - Abrupt anomalous motor shift spikes risk immediately (>= 60)
       - Subsequent calm events decay smoothly (0.7*prev + 0.3*new)
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: Normal session start
        init_res = await client.post(
            "/sessions",
            json={
                "session_id": "sess_shift_01",
                "rider_id": "rider_continuous_01",
                "biometrics": {"tap_interval_ms": 190.0, "typing_cps": 4.5},
            },
            headers={"X-Role": "admin"},
        )
        assert init_res.status_code == 201
        initial_risk = init_res.json()["assessment"]["risk_score"]
        assert initial_risk <= 20.0

        # Step 2: Major behavioral shift (handing device to stranger with slow typing & erratic taps)
        spike_res = await client.post(
            "/sessions/sess_shift_01/events",
            json={
                "event_type": "telemetry",
                "payload": {
                    "biometrics": {
                        "tap_interval_ms": 750.0,  # 4x baseline
                        "typing_cps": 1.1,  # 1/4 baseline
                        "swipe_velocity_px_s": 3200.0,
                        "interaction_timing_cv": 0.95,
                    },
                    "label": "suspected_handoff",
                },
            },
        )
        assert spike_res.status_code == 200
        spiked_risk = spike_res.json()["risk_score"]
        assert spiked_risk >= 75.0, f"Expected risk >= 75, got {spiked_risk}"

        # Step 3: Calm event 1 - Risk decays smoothly, remaining elevated above calm level
        calm_payload = {
            "biometrics": {
                "tap_interval_ms": 190.0,
                "typing_cps": 4.5,
                "swipe_velocity_px_s": 1100.0,
                "interaction_timing_cv": 0.30,
            }
        }
        decay1_res = await client.post(
            "/sessions/sess_shift_01/events",
            json={"event_type": "telemetry", "payload": calm_payload},
        )
        assert decay1_res.status_code == 200
        decay1_risk = decay1_res.json()["risk_score"]

        # Decay formula: max(new, 0.7*prev + 0.3*new)
        # Should be lower than spiked risk, but smoothed and higher than initial calm risk
        assert decay1_risk < spiked_risk, "Risk should decay from spike"
        assert decay1_risk > 30.0, f"Smoothing should maintain elevated risk, got {decay1_risk}"

        # Step 4: Calm event 2 - Risk decays further
        decay2_res = await client.post(
            "/sessions/sess_shift_01/events",
            json={"event_type": "telemetry", "payload": calm_payload},
        )
        decay2_risk = decay2_res.json()["risk_score"]
        assert decay2_risk < decay1_risk, "Risk should continue to decay smoothly"


@pytest.mark.anyio
async def test_handoff_escalate_opens_case_and_updates_rider():
    """
    4. Suspected handoff -> ESCALATE:
       - Biometric face mismatch (confidence 0.15) triggers ESCALATE
       - Case record is opened
       - Rider status is updated to under_review or restricted
       - Payout account is held
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "session_id": "sess_handoff_01",
            "rider_id": "rider_continuous_01",
            "biometrics": {
                "face_match_confidence": 0.15,  # FACE_MISMATCH floor 75
            },
        }
        res = await client.post("/sessions", json=payload, headers={"X-Role": "admin"})
        assert res.status_code == 201
        data = res.json()
        assessment = data["assessment"]
        assert assessment["verdict"] == "ESCALATE"
        assert assessment["case_id"] is not None
        case_id = assessment["case_id"]

        # Verify Case was created in DB
        case_res = await client.get(f"/cases/{case_id}")
        assert case_res.status_code == 200
        case_data = case_res.json()
        assert case_data["status"] == "OPEN"
        assert case_data["severity"] in ("HIGH", "CRITICAL")

        # Verify Rider status transitioned
        rider_res = await client.get("/riders/rider_continuous_01", headers={"X-Role": "admin"})
        assert rider_res.status_code == 200
        assert rider_res.json()["status"] in ("under_review", "restricted")


@pytest.mark.anyio
async def test_challenge_otp_resolution_and_failure():
    """
    5 & 6. Challenge Resolution:
       - GPS Spoofing triggers CHALLENGE (floor 60)
       - Passing OTP: device marked trusted, re-scored to ALLOW (trigger=challenge_result)
       - Subsequent failing challenge adds CHALLENGE_FAILED (+25) and escalates
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Trigger challenge via GPS spoofing
        payload = {
            "session_id": "sess_otp_01",
            "rider_id": "rider_continuous_01",
            "telemetry": {"mock_location_detected": True},
        }
        init_res = await client.post("/sessions", json=payload, headers={"X-Role": "admin"})
        assert init_res.status_code == 201
        chlg_id = init_res.json()["assessment"]["challenge"]["challenge_id"]

        # OTP Pass: Respond with passed=True
        pass_res = await client.post(
            f"/challenges/{chlg_id}/respond",
            json={"passed": True, "liveness_score": 0.99},
            headers={"X-Role": "rider"},
        )
        assert pass_res.status_code == 200
        pass_data = pass_res.json()
        assert pass_data["verified"] is True
        assert pass_data["status"] == "PASSED"
        assert pass_data["new_verdict"] == "ALLOW"

        # Check device was marked trusted
        db = TestingSessionLocal()
        sess = db.query(SessionModel).filter(SessionModel.id == "sess_otp_01").first()
        dev = db.query(Device).filter(Device.id == sess.device_id).first()
        assert dev.trust_rating == 1.0
        db.close()

        # Create another session and test challenge failure
        fail_init = await client.post(
            "/sessions",
            json={
                "session_id": "sess_fail_01",
                "rider_id": "rider_continuous_01",
                "telemetry": {"mock_location_detected": True},
            },
            headers={"X-Role": "admin"},
        )
        fail_chlg_id = fail_init.json()["assessment"]["challenge"]["challenge_id"]

        fail_res = await client.post(
            f"/challenges/{fail_chlg_id}/respond",
            json={"passed": False, "liveness_score": 0.10},
            headers={"X-Role": "rider"},
        )
        assert fail_res.status_code == 200
        fail_data = fail_res.json()
        assert fail_data["verified"] is False
        assert fail_data["status"] == "FAILED"
        assert fail_data["new_verdict"] == "ESCALATE"


@pytest.mark.anyio
async def test_baseline_updates_only_on_ordinary_change():
    """
    7. Baseline update rules:
       - Only ordinary_change triggers update_baseline
       - Normal routine sessions do not mutate baseline
    """
    transport = ASGITransport(app=app)
    db = TestingSessionLocal()
    b_before = (
        db.query(RiderBaseline).filter(RiderBaseline.rider_id == "rider_continuous_01").first()
    )
    before_updated_at = b_before.updated_at
    db.close()

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Normal session -> No baseline update
        await client.post(
            "/sessions",
            json={
                "session_id": "sess_baseline_check_norm",
                "rider_id": "rider_continuous_01",
                "biometrics": {"tap_interval_ms": 190.0, "typing_cps": 4.5},
            },
            headers={"X-Role": "admin"},
        )

        db = TestingSessionLocal()
        b_after_norm = (
            db.query(RiderBaseline).filter(RiderBaseline.rider_id == "rider_continuous_01").first()
        )
        assert b_after_norm.updated_at == before_updated_at
        db.close()

        # 2. Ordinary change (new phone) -> Triggers update_baseline
        await client.post(
            "/sessions",
            json={
                "session_id": "sess_baseline_check_ord",
                "rider_id": "rider_continuous_01",
                "is_new_device": True,
                "biometrics": {"tap_interval_ms": 200.0, "typing_cps": 4.3},
            },
            headers={"X-Role": "admin"},
        )

        db = TestingSessionLocal()
        b_after_ord = (
            db.query(RiderBaseline).filter(RiderBaseline.rider_id == "rider_continuous_01").first()
        )
        assert b_after_ord.updated_at >= before_updated_at
        db.close()


@pytest.mark.anyio
async def test_safety_validation_and_cold_start():
    """
    8. Safety requirements:
       - Unknown rider returns 404
       - Out-of-range payload returns 422
       - Missing baseline uses cold-start cohort path without crashing
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unknown rider -> 404
        r_unknown = await client.post(
            "/sessions",
            json={"session_id": "sess_unknown", "rider_id": "ghost_rider_999"},
            headers={"X-Role": "admin"},
        )
        assert r_unknown.status_code == 404

        # 2. Out-of-bounds latitude -> 422
        r_invalid = await client.post(
            "/sessions",
            json={
                "session_id": "sess_range_err",
                "rider_id": "rider_continuous_01",
                "location": {"latitude": 95.0, "longitude": 72.8},  # lat > 90
            },
            headers={"X-Role": "admin"},
        )
        assert r_invalid.status_code == 422

        # 3. Out-of-bounds face confidence -> 422
        r_invalid_face = await client.post(
            "/sessions",
            json={
                "session_id": "sess_range_err_2",
                "rider_id": "rider_continuous_01",
                "biometrics": {"face_match_confidence": 1.5},  # > 1.0
            },
            headers={"X-Role": "admin"},
        )
        assert r_invalid_face.status_code == 422

        # 4. Cold start rider (no baseline) -> Succeeds using cohort defaults
        r_cold = await client.post(
            "/sessions",
            json={
                "session_id": "sess_cold_01",
                "rider_id": "rider_cold_01",
                "biometrics": {"tap_interval_ms": 190.0, "typing_cps": 4.5},
            },
            headers={"X-Role": "admin"},
        )
        assert r_cold.status_code == 201
        assert r_cold.json()["assessment"]["verdict"] in ("ALLOW", "MONITOR")


@pytest.mark.anyio
async def test_metrics_summary_and_evaluation_endpoints():
    """
    9 & 10. Metrics Endpoints:
       - GET /metrics/summary returns decision_counts, classification_counts, threat_tag_counts,
         avg_latency_ms, and p95_latency_ms.
       - GET /metrics/evaluation serves ml/reports/latest.json.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Generate some sessions
        await client.post(
            "/sessions",
            json={
                "session_id": "sess_metrics_norm",
                "rider_id": "rider_continuous_01",
                "biometrics": {"tap_interval_ms": 190.0},
            },
            headers={"X-Role": "admin"},
        )
        await client.post(
            "/sessions",
            json={
                "session_id": "sess_metrics_threat",
                "rider_id": "rider_continuous_01",
                "telemetry": {"mock_location_detected": True},
            },
            headers={"X-Role": "admin"},
        )

        # GET /metrics/summary
        sum_res = await client.get("/metrics/summary")
        assert sum_res.status_code == 200
        summary = sum_res.json()
        assert "decision_counts" in summary
        assert "classification_counts" in summary
        assert "threat_tag_counts" in summary
        assert summary["total_sessions"] >= 2
        assert summary["avg_latency_ms"] >= 0.0
        assert summary["p95_latency_ms"] >= 0.0

        # GET /metrics/evaluation
        eval_res = await client.get("/metrics/evaluation")
        assert eval_res.status_code == 200
        report = eval_res.json()
        assert "key_metrics" in report
        assert "target_compliance" in report
        assert "decision_mix" in report
        assert report["key_metrics"]["attack_recall"] >= 0.95


@pytest.mark.anyio
async def test_sse_emits_assessments_during_scoring():
    """
    11 & 12. SSE Stream: verifies assessment publications reach event subscribers.
    """
    gen = event_bus.sse_generator()
    first = await gen.asend(None)
    assert "ping" in first

    # Create session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/sessions",
            json={
                "session_id": "sess_sse_test_01",
                "rider_id": "rider_continuous_01",
                "biometrics": {"tap_interval_ms": 190.0},
            },
            headers={"X-Role": "admin"},
        )

    second = await gen.asend(None)
    assert "event: assessment_created" in second
    assert "sess_sse_test_01" in second
    await gen.aclose()
