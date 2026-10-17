"""
TrustJuggler End-to-End Attack Scenario and Benign Adaptation Test Suite.
Validates:
- Scenario N1: Normal rider baseline session stays strictly in ALLOW band (risk < 25).
- Scenarios O1-O4: Benign life changes (new phone, relocation, new zone, combined)
  avoid hard blockages (verdicts in ALLOW/MONITOR <= 44), adapting over time to ALLOW.
- Scenario H1: Account handoff mid-shift triggers CHALLENGE/ESCALATE with ACCOUNT_HANDOFF.
- Scenario T1: Impossible travel velocity violation triggers hard rule floor 60 with IMPOSSIBLE_TRAVEL.
- Scenario T2: GPS spoofing synthetic route triggers hard rule floor 60 with GPS_SPOOFING.
- Scenario F1: Fraud collusion device farm ring triggers ESCALATE with FRAUD_RING.
- Scenario P1: Payout hijack triggers step-up verification CHALLENGE OTP with PAYOUT_REDIRECT.
- Simulator Replay API: GET /api/v1/simulator/scenarios and POST /api/v1/simulator/scenarios/run.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from simulator.scenario_runner import SCENARIO_BUILDERS, list_scenarios, run_scenario

client = TestClient(app)


# ==============================================================================
# 1. Normal Baseline Scenario (N1)
# ==============================================================================


def test_scenario_n1_normal_baseline():
    """N1: Genuine rider routine delivery session stays strictly in ALLOW tier."""
    res = run_scenario("N1", emit_events=False)
    assert res.passed is True
    assert res.scenario_id == "N1"
    assert res.initial_verdict == "ALLOW"
    assert res.final_verdict == "ALLOW"
    assert res.initial_risk_score < 25.0
    assert res.final_risk_score < 25.0
    assert "CLEAN" in res.threat_tags
    assert len(res.steps) == 2
    for step in res.steps:
        assert step.verdict == "ALLOW"
        assert step.risk_score < 25.0
        assert step.classification == "normal"
        assert step.passed is True


# ==============================================================================
# 2. Benign Life Change Scenarios (O1 - O4)
# ==============================================================================


def test_scenario_o1_new_phone_adaptation():
    """
    O1: New phone handset upgrade.
    Initial sessions must avoid hard blocks (risk <= 44.0, ALLOW/MONITOR),
    adapting over 3 sessions into ALLOW (< 25.0).
    """
    res = run_scenario("O1", emit_events=False)
    assert res.passed is True
    assert res.scenario_id == "O1"
    assert res.initial_risk_score <= 44.0
    assert res.initial_verdict in ("ALLOW", "MONITOR")
    assert "ORDINARY_CHANGE" in res.threat_tags

    # Final adapted step
    final_step = res.steps[-1]
    assert final_step.verdict == "ALLOW"
    assert final_step.risk_score < 25.0
    assert "CLEAN" in final_step.threat_tags

    # Zero false-positive hard blockages across all steps
    for step in res.steps:
        assert step.verdict in ("ALLOW", "MONITOR")
        assert step.risk_score <= 44.0
        assert step.passed is True


def test_scenario_o2_relocation_adaptation():
    """
    O2: Inter-city relocation to Pune.
    Initial session stays within benign bounds (<= 44.0), adapting to ALLOW.
    """
    res = run_scenario("O2", emit_events=False)
    assert res.passed is True
    assert res.scenario_id == "O2"
    assert res.initial_risk_score <= 44.0
    assert res.initial_verdict in ("ALLOW", "MONITOR")

    # Step 2 after 5-session multi-day adaptation
    step2 = res.steps[1]
    assert step2.verdict == "ALLOW"
    assert step2.risk_score < 25.0
    assert "CLEAN" in step2.threat_tags

    for step in res.steps:
        assert step.verdict in ("ALLOW", "MONITOR")
        assert step.risk_score <= 44.0


def test_scenario_o3_new_zone_adaptation():
    """
    O3: Expansion into a new delivery zone.
    Held within benign bounds (<= 44.0), quickly incorporates into known baseline.
    """
    res = run_scenario("O3", emit_events=False)
    assert res.passed is True
    assert res.scenario_id == "O3"
    assert res.initial_risk_score <= 44.0
    assert res.initial_verdict in ("ALLOW", "MONITOR")

    # Step 2 after zone incorporation
    step2 = res.steps[1]
    assert step2.verdict == "ALLOW"
    assert step2.risk_score < 25.0
    assert "CLEAN" in step2.threat_tags


def test_scenario_o4_combined_phone_and_zone():
    """
    O4: Simultaneous new phone and new delivery zone.
    Strictly capped at <= 44.0, zero hard rule triggers, adapts to ALLOW.
    """
    res = run_scenario("O4", emit_events=False)
    assert res.passed is True
    assert res.scenario_id == "O4"
    assert res.initial_risk_score <= 44.0
    assert res.initial_verdict in ("ALLOW", "MONITOR")

    step2 = res.steps[1]
    assert step2.verdict == "ALLOW"
    assert step2.risk_score < 25.0

    for step in res.steps:
        assert step.verdict in ("ALLOW", "MONITOR")
        assert step.risk_score <= 44.0


# ==============================================================================
# 3. Canonical Attack Scenarios (H1, T1, T2, F1, P1)
# ==============================================================================


def test_scenario_h1_account_handoff_mid_shift():
    """
    H1: Mid-shift handoff to unauthenticated driver.
    Step 1 genuine rider (ALLOW), Step 2 motor drift spike triggers ESCALATE
    with floor >= 75 and threat_tag ACCOUNT_HANDOFF.
    """
    res = run_scenario("H1", emit_events=False)
    assert res.passed is True
    assert res.scenario_id == "H1"
    assert res.steps[0].verdict == "ALLOW"
    assert res.steps[0].risk_score < 25.0

    step2 = res.steps[1]
    assert step2.verdict in ("CHALLENGE", "ESCALATE")
    assert step2.risk_score >= 75.0
    assert "ACCOUNT_HANDOFF" in step2.threat_tags
    assert step2.classification == "suspected_handoff"


def test_scenario_t1_impossible_travel():
    """
    T1: Impossible travel velocity violation (> 150 km/h).
    Triggers hard security rule floor 60 with IMPOSSIBLE_TRAVEL.
    """
    res = run_scenario("T1", emit_events=False)
    assert res.passed is True
    assert res.scenario_id == "T1"
    assert res.steps[0].verdict == "ALLOW"

    step2 = res.steps[1]
    assert step2.verdict in ("CHALLENGE", "ESCALATE")
    assert step2.risk_score >= 60.0
    assert "IMPOSSIBLE_TRAVEL" in step2.threat_tags


def test_scenario_t2_gps_spoofing():
    """
    T2: GPS Spoofing with synthetic jitter-free linear route.
    Triggers hard security rule floor 60 with GPS_SPOOFING.
    """
    res = run_scenario("T2", emit_events=False)
    assert res.passed is True
    assert res.scenario_id == "T2"

    step1 = res.steps[0]
    assert step1.verdict in ("CHALLENGE", "ESCALATE")
    assert step1.risk_score >= 60.0
    assert "GPS_SPOOFING" in step1.threat_tags


def test_scenario_f1_fraud_collusion_ring():
    """
    F1: Multi-account device farm collusion ring.
    High graph risk and device sharing triggers ESCALATE (risk >= 75) with FRAUD_RING.
    """
    res = run_scenario("F1", emit_events=False)
    assert res.passed is True
    assert res.scenario_id == "F1"

    step1 = res.steps[0]
    assert step1.verdict in ("CHALLENGE", "ESCALATE")
    assert step1.risk_score >= 75.0
    assert "FRAUD_RING" in step1.threat_tags


def test_scenario_p1_payout_hijack():
    """
    P1: Payout instrument hijack.
    Sensitive profile edit + rapid withdrawal on unfamiliar handset triggers
    CHALLENGE (OTP step-up) with PAYOUT_REDIRECT.
    """
    res = run_scenario("P1", emit_events=False)
    assert res.passed is True
    assert res.scenario_id == "P1"
    assert res.steps[0].verdict == "ALLOW"

    step2 = res.steps[1]
    assert step2.verdict in ("CHALLENGE", "ESCALATE")
    assert step2.risk_score >= 45.0
    assert "PAYOUT_REDIRECT" in step2.threat_tags
    assert "OTP" in step2.recommended_action or "CHALLENGE" in step2.recommended_action


# ==============================================================================
# 4. Catalog and Replay HTTP API Endpoints
# ==============================================================================


def test_api_list_scenarios():
    """GET /api/v1/simulator/scenarios returns catalog of all 10 canonical scenarios."""
    direct_catalog = list_scenarios()
    assert len(direct_catalog) == 10

    res = client.get("/api/v1/simulator/scenarios")
    assert res.status_code == 200
    catalog = res.json()
    assert len(catalog) == 10
    scenario_ids = [item["scenario_id"] for item in catalog]
    expected_ids = ["N1", "O1", "O2", "O3", "O4", "H1", "T1", "T2", "F1", "P1"]
    for sid in expected_ids:
        assert sid in scenario_ids

    # Verify schema fields
    for item in catalog:
        assert "scenario_id" in item
        assert "name" in item
        assert "category" in item
        assert "description" in item
        assert "expected_verdict" in item


@pytest.mark.parametrize("scenario_id", list(SCENARIO_BUILDERS.keys()))
def test_api_run_all_scenarios(scenario_id: str):
    """POST /api/v1/simulator/scenarios/run executes each scenario successfully."""
    payload = {
        "scenario_id": scenario_id,
        "emit_events": True,
        "session_id_prefix": f"test_api_{scenario_id.lower()}",
    }
    res = client.post("/api/v1/simulator/scenarios/run", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["scenario_id"] == scenario_id
    assert data["passed"] is True
    assert len(data["steps"]) >= 1
    assert "summary" in data

    # Verify first step details
    first_step = data["steps"][0]
    assert "risk_score" in first_step
    assert "verdict" in first_step
    assert "classification" in first_step
    assert "factors" in first_step


def test_api_run_scenario_not_found():
    """POST /api/v1/simulator/scenarios/run returns 404 for unknown scenario ID."""
    res = client.post("/api/v1/simulator/scenarios/run", json={"scenario_id": "INVALID_99"})
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()
