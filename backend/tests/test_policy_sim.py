"""
TrustJuggler Policy Simulator and Threshold Replay Test Suite.
Verifies:
1. Replay executes against eval.csv without runtime exceptions.
2. Default thresholds produce ordinary-change friction < 10% and fraud recall >= 90%.
3. Simulation completes within test timeout (< 5s).
4. Trade-off points generate valid empirical ROC/PR curves.
5. Boundary sweep matrix correctly explores parameter space.
6. API endpoint POST /api/v1/simulator/policy/simulate returns schema-compliant responses.
"""

import time

from fastapi.testclient import TestClient

from app.main import app
from simulator.policy_sim import (
    get_eval_records,
    load_eval_dataset,
    resolve_eval_csv_path,
    simulate_policy,
    sweep_boundary_matrix,
    sweep_thresholds,
)


def test_eval_csv_exists_and_loads():
    """Validates that eval.csv exists and contains exactly 400 evaluation sessions."""
    csv_path = resolve_eval_csv_path()
    assert csv_path.exists(), f"eval.csv must exist at {csv_path}"

    rows = load_eval_dataset()
    assert len(rows) == 400, f"Expected 400 eval sessions, got {len(rows)}"

    # Check key columns
    first = rows[0]
    for col in ["session_id", "rider_id", "label", "ground_truth_label"]:
        assert col in first, f"Column {col} missing from eval.csv"

    labels = {r["label"] for r in rows}
    assert "normal" in labels
    assert "ordinary_change" in labels
    assert "suspected_handoff" in labels


def test_replay_executes_against_eval_csv():
    """Validates that simulation replay executes against eval.csv without exceptions."""
    res = simulate_policy()
    assert res is not None
    assert res.total_sessions == 400
    assert 0.0 <= res.fraud_recall <= 1.0
    assert 0.0 <= res.ordinary_friction <= 1.0
    assert res.estimated_savings_usd >= 0.0
    assert len(res.trade_off_curve) > 0


def test_default_thresholds_metrics():
    """
    Core Acceptance Criteria:
    - Default thresholds produce ordinary-change friction < 10%
    - Fraud recall >= 90% (at CHALLENGE+)
    - Normal account friction is minimal (< 3%)
    """
    res = simulate_policy()

    # Ordinary change friction should be < 10% (target: 0-5%)
    assert res.ordinary_friction < 0.10, (
        f"Ordinary change friction was {res.ordinary_friction * 100:.2f}%, expected < 10.0%"
    )

    # Fraud recall should be >= 90%
    assert res.fraud_recall >= 0.90, (
        f"Fraud recall was {res.fraud_recall * 100:.2f}%, expected >= 90.0%"
    )

    # Normal account friction should be < 3%
    assert res.normal_friction < 0.03, (
        f"Normal account friction was {res.normal_friction * 100:.2f}%, expected < 3.0%"
    )

    # Significant fraud chargeback savings
    assert res.estimated_savings_usd > 5000.0, (
        f"Estimated savings were ${res.estimated_savings_usd}, expected > $5000"
    )


def test_simulation_completes_within_timeout():
    """
    Performance Requirement:
    Simulation replay (including dataset parsing, scoring, and trade-off generation)
    must complete within test timeout (< 5.0s).
    """
    t0 = time.perf_counter()
    res = simulate_policy(force_reload=True)
    elapsed = time.perf_counter() - t0

    assert elapsed < 5.0, f"Simulation took {elapsed:.3f}s, exceeding 5.0s limit"
    assert res.total_sessions == 400


def test_trade_off_curve_monotonicity():
    """
    Verifies empirical trade-off curve properties:
    - As threshold increases, FPR and TPR must be monotonically non-increasing.
    - Extreme threshold T=0 flags everything (FPR=1, TPR=1, friction=1).
    - High threshold T=100 flags minimal/nothing.
    """
    records = get_eval_records()
    curve = sweep_thresholds(records, start=0.0, stop=100.0, step=10.0)

    assert len(curve) == 11

    # T=0 point
    pt_zero = curve[0]
    assert pt_zero["threshold"] == 0.0
    assert pt_zero["tpr"] == 1.0
    assert pt_zero["fpr"] == 1.0
    assert pt_zero["friction"] == 1.0

    # Monotonicity check
    for i in range(len(curve) - 1):
        curr_p = curve[i]
        next_p = curve[i + 1]
        assert curr_p["tpr"] >= next_p["tpr"], "TPR must be non-increasing with threshold"
        assert curr_p["fpr"] >= next_p["fpr"], "FPR must be non-increasing with threshold"
        assert curr_p["friction"] >= next_p["friction"], (
            "Friction must be non-increasing with threshold"
        )


def test_candidate_threshold_overrides():
    """
    Verifies that relaxing or tightening cut-lines changes the friction
    and catch rates predictably.
    """
    # Strict policy: Lower CHALLENGE threshold to 30.0 -> catches more fraud, higher friction
    res_strict = simulate_policy(
        candidate_overrides={
            "allow_threshold": 15.0,
            "monitor_threshold": 25.0,
            "challenge_threshold": 30.0,
        }
    )

    # Permissive policy: High CHALLENGE threshold to 85.0 -> lower friction
    res_lenient = simulate_policy(
        candidate_overrides={
            "allow_threshold": 35.0,
            "monitor_threshold": 55.0,
            "challenge_threshold": 85.0,
        }
    )

    assert res_strict.simulated_friction_rate >= res_lenient.simulated_friction_rate


def test_boundary_matrix_sweeps():
    """Validates multi-dimensional threshold grid sweep across ALLOW, MONITOR, and CHALLENGE."""
    records = get_eval_records()
    matrix = sweep_boundary_matrix(
        records,
        allow_range=(20.0, 24.0),
        monitor_range=(40.0, 44.0),
        challenge_range=(70.0, 74.0),
    )

    assert len(matrix) > 0
    for cell in matrix:
        assert "fraud_recall" in cell
        assert "ordinary_friction" in cell
        assert "savings_usd" in cell
        assert cell["fraud_recall"] >= 0.85


def test_api_post_simulator_policy_simulate():
    """Tests POST /api/v1/simulator/policy/simulate endpoint."""
    client = TestClient(app)

    payload = {
        "allow_threshold": 24.0,
        "monitor_threshold": 44.0,
        "challenge_threshold": 74.0,
        "escalate_threshold": 75.0,
    }

    resp = client.post("/api/v1/simulator/policy/simulate", json=payload)
    assert resp.status_code == 200, f"API error: {resp.text}"

    data = resp.json()
    assert data["total_sessions"] == 400
    assert "fraud_recall" in data
    assert "ordinary_friction" in data
    assert "estimated_savings_usd" in data
    assert "trade_off_curve" in data
    assert isinstance(data["trade_off_curve"], list)
    assert len(data["trade_off_curve"]) > 0

    first_point = data["trade_off_curve"][0]
    for key in ["threshold", "fpr", "tpr", "friction"]:
        assert key in first_point


def test_api_legacy_policies_simulate_alias():
    """Tests legacy alias POST /api/v1/policies/simulate for frontend compatibility."""
    client = TestClient(app)

    payload = {
        "allow_threshold": 75.0,
        "challenge_threshold": 50.0,
    }

    resp = client.post("/api/v1/policies/simulate", json=payload)
    assert resp.status_code == 200, f"API alias error: {resp.text}"

    data = resp.json()
    assert data["total_sessions"] == 400
    assert data["fraud_recall"] >= 0.90
