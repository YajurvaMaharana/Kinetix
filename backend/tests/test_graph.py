"""
Unit & Integration Tests for TrustJuggler v2 Fraud Syndicate Graph Service.
Validates:
- NetworkX multi-entity bipartite graph (riders, devices, IPs, bank accounts, payout instruments)
- Component discovery & degree centrality
- Calibration:
  * 0.0 for isolated rider with unique device/IP
  * 0.4 for 2 riders sharing 1 device
  * >= 0.8 for >= 3 riders sharing device/bank account
  * 1.0 for dense fraud ring clusters with multiple shared identifiers
- Factor records: FRAUD_RING, SHARED_DEVICE_RING, SHARED_PAYOUT_INSTRUMENT
- Hard rule trigger: MULTI_ACCOUNT_DEVICE_RING (+15 pts, floor 60) when degree >= 3
- D3 payload format conforms to {nodes: [{id, type, label}], edges: [{source, target, relationship}]}
- Graph computation runs within latency constraints (<15ms)
- Scenario F1 (fraud ring) triggers CHALLENGE/ESCALATE with threat_tag FRAUD_RING
"""

import time

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.scoring.risk import ScoringContext, score_session
from app.scoring.rules import evaluate_rules
from app.services.graph_service import FraudGraphService, evaluate_graph, graph_service


@pytest.fixture(autouse=True)
def clean_graph():
    """Resets the singleton graph service before and after each test."""
    graph_service.reset()
    yield
    graph_service.reset()


def test_single_rider_isolated_graph_risk_zero():
    """
    Validation: Single rider with unique device and IP produces graph_risk == 0.0.
    """
    svc = FraudGraphService()
    svc.add_session_entities(
        rider_id="rider_0001",
        device_id="dev_unique_0001",
        ip_address="198.51.100.1",
    )

    result = svc.evaluate_rider("rider_0001")
    assert result.graph_risk == 0.0
    assert result.shared_device_count == 1
    assert result.has_fraud_ring is False
    assert result.has_multi_account_device_ring is False
    assert len(result.factors) == 0

    # In continuous scoring pipeline
    ctx = ScoringContext(
        request_or_event={
            "rider_id": "rider_0001",
            "telemetry": {"shared_device_count": 1, "shared_payout_count": 1},
        }
    )
    eval_res = evaluate_graph(ctx, service=svc)
    assert eval_res.graph_risk == 0.0


def test_two_rider_device_share_produces_point_four():
    """
    Validation: 2 riders sharing 1 device produces expected 0.4 score and SHARED_DEVICE_RING factor.
    """
    svc = FraudGraphService()
    # Rider A and Rider B share device dev_shared_2p
    svc.add_session_entities(
        rider_id="rider_A", device_id="dev_shared_2p", ip_address="198.51.100.10"
    )
    svc.add_session_entities(
        rider_id="rider_B", device_id="dev_shared_2p", ip_address="198.51.100.11"
    )

    res_a = svc.evaluate_rider("rider_A")
    assert res_a.graph_risk == 0.40
    assert res_a.shared_device_count == 2
    assert res_a.has_fraud_ring is False

    # Check attached factor
    codes = [f.code for f in res_a.factors]
    assert "SHARED_DEVICE_RING" in codes

    # Continuous scoring test
    graph_service.reset()
    graph_service.add_session_entities(
        rider_id="rider_A", device_id="dev_shared_2p", ip_address="198.51.100.10"
    )
    graph_service.add_session_entities(
        rider_id="rider_B", device_id="dev_shared_2p", ip_address="198.51.100.11"
    )

    ctx = ScoringContext(
        request_or_event={
            "rider_id": "rider_A",
            "device_id": "dev_shared_2p",
        }
    )
    scored = score_session(ctx)
    # 12 * 0.4 = 4.8 pts
    assert scored.components["pts_graph_risk"] == 4.8


def test_collusion_ring_scenario_graph_risk_and_fraud_ring_factor():
    """
    Validation: Collusion ring scenario (3+ riders sharing device/bank) produces
    graph_risk >= 0.8 and attaches FRAUD_RING factor.
    """
    svc = FraudGraphService()
    # 3 riders sharing device dev_ring_01
    svc.add_session_entities(rider_id="rider_ring_01", device_id="dev_ring_01")
    svc.add_session_entities(rider_id="rider_ring_02", device_id="dev_ring_01")
    svc.add_session_entities(rider_id="rider_ring_03", device_id="dev_ring_01")

    res = svc.evaluate_rider("rider_ring_01")
    assert res.graph_risk >= 0.80
    assert res.has_fraud_ring is True
    assert res.max_device_riders == 3

    factor_codes = [f.code for f in res.factors]
    assert "FRAUD_RING" in factor_codes

    # Score session directly with graph_service populated
    graph_service.reset()
    graph_service.add_session_entities(rider_id="rider_ring_01", device_id="dev_ring_01")
    graph_service.add_session_entities(rider_id="rider_ring_02", device_id="dev_ring_01")
    graph_service.add_session_entities(rider_id="rider_ring_03", device_id="dev_ring_01")

    ctx = ScoringContext(
        request_or_event={
            "rider_id": "rider_ring_01",
            "device_id": "dev_ring_01",
        }
    )
    scored = score_session(ctx)
    assert scored.components["pts_graph_risk"] >= 9.6  # 12.0 * 0.80+
    scored_factor_codes = [f.code for f in scored.factors]
    assert "FRAUD_RING" in scored_factor_codes


def test_dense_fraud_ring_cluster_max_risk():
    """
    Validation: Dense fraud ring clusters with multiple shared identifiers produce graph_risk == 1.0.
    """
    svc = FraudGraphService()
    # 3 riders sharing 2 devices and 1 bank account
    for r in ["rider_synd_1", "rider_synd_2", "rider_synd_3"]:
        svc.add_session_entities(
            rider_id=r,
            device_id="dev_farm_pool_1",
            bank_account="bank_tok_mule_99",
        )
    svc.add_session_entities(rider_id="rider_synd_1", device_id="dev_farm_pool_2")
    svc.add_session_entities(rider_id="rider_synd_2", device_id="dev_farm_pool_2")

    res = svc.evaluate_rider("rider_synd_1")
    assert res.graph_risk == 1.00
    assert res.has_fraud_ring is True
    assert res.shared_device_count >= 3
    assert res.shared_payout_count >= 3

    factor_codes = [f.code for f in res.factors]
    assert "FRAUD_RING" in factor_codes
    assert "SHARED_DEVICE_RING" in factor_codes
    assert "SHARED_PAYOUT_INSTRUMENT" in factor_codes


def test_d3_payload_conforms_to_schema():
    """
    Validation: D3 payload format conforms strictly to
    {nodes: [{id, type, label}], edges: [{source, target, relationship}]}.
    """
    svc = FraudGraphService()
    svc.add_session_entities(
        rider_id="rider_viz_01",
        device_id="dev_viz_01",
        ip_address="203.0.113.45",
        bank_account="bank_acc_900",
        payout_token="payout_tok_777",
    )
    svc.add_session_entities(
        rider_id="rider_viz_02",
        device_id="dev_viz_01",
    )

    d3_data = svc.export_d3_subgraph("rider_viz_01", depth=2)

    assert "nodes" in d3_data
    assert "edges" in d3_data
    assert isinstance(d3_data["nodes"], list)
    assert isinstance(d3_data["edges"], list)
    assert len(d3_data["nodes"]) >= 5

    # Check node structure
    for node in d3_data["nodes"]:
        assert "id" in node
        assert "type" in node
        assert "label" in node
        assert isinstance(node["id"], str)
        assert isinstance(node["type"], str)
        assert isinstance(node["label"], str)

    # Check edge structure
    for edge in d3_data["edges"]:
        assert "source" in edge
        assert "target" in edge
        assert "relationship" in edge
        assert isinstance(edge["source"], str)
        assert isinstance(edge["target"], str)
        assert isinstance(edge["relationship"], str)


def test_graph_computation_latency_constraint():
    """
    Validation: Graph computation runs within latency constraints (<15ms for local subgraph).
    """
    svc = FraudGraphService()
    # Build a complex cluster with 100 riders and interconnected devices & IPs
    for i in range(100):
        r_id = f"rider_perf_{i}"
        d_id = f"dev_cluster_{i % 5}"  # 5 shared devices
        ip_id = f"198.51.100.{i % 10}"  # 10 shared IPs
        svc.add_session_entities(rider_id=r_id, device_id=d_id, ip_address=ip_id)

    # Measure latency of evaluation
    start = time.perf_counter()
    res = svc.evaluate_rider("rider_perf_0")
    eval_elapsed_ms = (time.perf_counter() - start) * 1000.0

    assert eval_elapsed_ms < 15.0, f"Evaluation took {eval_elapsed_ms:.2f}ms, expected <15ms"
    assert res.calculation_time_ms < 15.0

    # Measure latency of D3 export
    start_d3 = time.perf_counter()
    d3_data = svc.export_d3_subgraph("rider_perf_0", depth=2)
    export_elapsed_ms = (time.perf_counter() - start_d3) * 1000.0

    assert export_elapsed_ms < 15.0, f"D3 export took {export_elapsed_ms:.2f}ms, expected <15ms"
    assert len(d3_data["nodes"]) > 0


def test_hard_rule_multi_account_device_ring_trigger():
    """
    Validation: MULTI_ACCOUNT_DEVICE_RING (+15 pts, floor 60) triggers when degree >= 3 on shared device.
    """
    graph_service.reset()
    # 3 riders sharing 1 device
    for r in ["rider_rule_1", "rider_rule_2", "rider_rule_3"]:
        graph_service.add_session_entities(rider_id=r, device_id="dev_hardware_shared_3")

    ctx = ScoringContext(
        request_or_event={
            "rider_id": "rider_rule_1",
            "device_id": "dev_hardware_shared_3",
        }
    )
    rule_res = evaluate_rules(ctx)
    assert rule_res.rule_floor >= 60.0
    assert "FRAUD_RING" in rule_res.threat_tags

    hit_codes = [m.code for m in rule_res.matches]
    assert "MULTI_ACCOUNT_DEVICE_RING" in hit_codes
    match = next(m for m in rule_res.matches if m.code == "MULTI_ACCOUNT_DEVICE_RING")
    assert match.points == 15.0
    assert match.floor == 60.0


def test_scenario_F1_fraud_ring():
    """
    Validation Scenario F1 (fraud ring):
    Collusion cluster with >= 3 riders sharing a device / emulator triggers
    CHALLENGE/ESCALATE with threat_tag FRAUD_RING and attaches FRAUD_RING factor.
    """
    graph_service.reset()
    # 4 riders sharing emulator hardware ring
    for r in ["rider_f1_alpha", "rider_f1_beta", "rider_f1_gamma", "rider_f1_delta"]:
        graph_service.add_session_entities(
            rider_id=r,
            device_id="dev_shared_f1_ring",
            ip_address="192.0.2.100",
            bank_account="bank_f1_mule",
        )

    ctx = ScoringContext(
        request_or_event={
            "rider_id": "rider_f1_alpha",
            "device_id": "dev_shared_f1_ring",
            "ip_address": "192.0.2.100",
            "telemetry": {
                "shared_device_count": 4,
                "shared_payout_count": 4,
            },
        }
    )

    scored = score_session(ctx)

    # Acceptance criteria verification:
    # 1. Triggers CHALLENGE or ESCALATE
    assert scored.verdict in ["CHALLENGE", "ESCALATE"], f"Unexpected verdict: {scored.verdict}"
    assert scored.risk_score >= 60.0

    # 2. Contains threat_tag FRAUD_RING
    assert "FRAUD_RING" in scored.threat_tags, (
        f"Missing FRAUD_RING in threat_tags: {scored.threat_tags}"
    )

    # 3. Attaches FRAUD_RING factor
    factor_codes = [f.code for f in scored.factors]
    assert "FRAUD_RING" in factor_codes or "MULTI_ACCOUNT_DEVICE_RING" in factor_codes


def test_investigations_graph_endpoint():
    """
    Validation: Analyst endpoint GET /api/v1/investigations/graph/{rider_id} returns
    valid D3 payload matching the schema.
    """
    graph_service.reset()
    graph_service.add_session_entities(
        rider_id="rider_endpoint_test",
        device_id="dev_endpoint_phone",
        ip_address="203.0.113.1",
    )

    client = TestClient(app)
    response = client.get("/api/v1/investigations/graph/rider_endpoint_test")
    assert response.status_code == 200
    payload = response.json()

    assert "nodes" in payload
    assert "edges" in payload
    assert any(n["id"] == "rider_endpoint_test" for n in payload["nodes"])
    assert any(n["id"] == "dev_endpoint_phone" for n in payload["nodes"])
    assert any(e["relationship"] == "USED_DEVICE" for e in payload["edges"])
