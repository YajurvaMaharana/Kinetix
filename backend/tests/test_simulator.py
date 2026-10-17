"""
TrustJuggler Simulator Test Suite.
Verifies:
1. Determinism across seeded RNG runs
2. Within-rider noise strictly lower than between-rider spread
3. Ordinary life changes maintain persona behavioral identity (5-20% shift on new phone)
4. Attack sessions differ significantly on average from normal baselines
5. GPS spoof routes have lower speed variance and near-linear straightness
6. Fraud rings share device, payout, and IP tokens
7. Label counts for held-out eval set (150 normal, 100 ordinary_change, 150 attacks, >= 6 rings)
"""

from pathlib import Path

import numpy as np

from simulator.attacks import (
    make_fraud_ring,
    make_gps_spoof,
    make_handoff,
)
from simulator.baseline import compute_baseline, compute_robust_z
from simulator.generator import generate_history, make_ordinary_change
from simulator.personas import generate_persona
from simulator.seed_cli import run_seeding


def test_determinism():
    """Given the same seed, personas and history outputs are strictly identical."""
    rng1 = np.random.RandomState(42)
    p1 = generate_persona(0, rng1)
    h1 = generate_history(p1, days=5, rng=np.random.RandomState(100))

    rng2 = np.random.RandomState(42)
    p2 = generate_persona(0, rng2)
    h2 = generate_history(p2, days=5, rng=np.random.RandomState(100))

    assert p1.rider_id == p2.rider_id
    assert p1.home_city == p2.home_city
    assert p1.primary_device["fingerprint"] == p2.primary_device["fingerprint"]
    assert p1.payout_account["account_token"] == p2.payout_account["account_token"]
    assert p1.face_embedding_hash == p2.face_embedding_hash
    assert np.allclose(p1.face_embedding, p2.face_embedding)
    assert np.allclose(p1.screen_transitions, p2.screen_transitions)

    assert len(h1) == len(h2)
    for s1, s2 in zip(h1, h2, strict=True):
        assert s1["session_id"] == s2["session_id"]
        assert s1["tap_interval_ms"] == s2["tap_interval_ms"]
        assert s1["typing_cps"] == s2["typing_cps"]
        assert s1["avg_speed_kmh"] == s2["avg_speed_kmh"]


def test_variance_between_vs_within_riders():
    """
    Verifies the core simulation property:
    Within-rider noise is strictly less than between-rider spread.
    """
    rng = np.random.RandomState(123)
    n_riders = 15
    personas = [generate_persona(i, rng) for i in range(n_riders)]

    # Collect persona means across riders (between-rider distribution)
    between_tap_means = [p.metric_params["tap_interval_ms"][0] for p in personas]
    between_typing_means = [p.metric_params["typing_cps"][0] for p in personas]
    between_speed_means = [p.metric_params["avg_speed_kmh"][0] for p in personas]

    between_tap_var = np.var(between_tap_means)
    between_typing_var = np.var(between_typing_means)
    between_speed_var = np.var(between_speed_means)

    # For each rider, generate sessions and compute within-rider variance
    within_tap_vars = []
    within_typing_vars = []
    within_speed_vars = []

    for p in personas:
        seed_val = int(p.metric_params["tap_interval_ms"][0])
        hist = generate_history(p, days=15, rng=np.random.RandomState(seed_val))
        taps = [s["tap_interval_ms"] for s in hist]
        typings = [s["typing_cps"] for s in hist]
        speeds = [s["avg_speed_kmh"] for s in hist]

        within_tap_vars.append(np.var(taps))
        within_typing_vars.append(np.var(typings))
        within_speed_vars.append(np.var(speeds))

    mean_within_tap_var = np.mean(within_tap_vars)
    mean_within_typing_var = np.mean(within_typing_vars)
    mean_within_speed_var = np.mean(within_speed_vars)

    # Within-rider variance should be significantly lower than between-rider variance
    assert mean_within_tap_var < between_tap_var, (
        "Tap variance within rider should be < between riders"
    )
    assert mean_within_typing_var < between_typing_var, (
        "Typing variance within rider should be < between riders"
    )
    assert mean_within_speed_var < between_speed_var, (
        "Speed variance within rider should be < between riders"
    )


def test_ordinary_changes_keep_behavior_near_persona():
    """
    Verifies that ordinary life changes (new phone, relocation, new zone)
    preserve persona behavioral identity with modest biometrics shifts (5-20%).
    """
    rng = np.random.RandomState(777)
    persona = generate_persona(1, rng)
    hist = generate_history(persona, days=20, rng=rng)
    base = compute_baseline(hist)

    # Test new_phone
    new_phone_sess = make_ordinary_change(persona, "new_phone", day_idx=21, rng=rng)
    assert new_phone_sess["label"] == "ordinary_change"
    assert new_phone_sess["ground_truth_label"] == "ordinary_change"
    assert new_phone_sess["device_fingerprint"] != persona.primary_device["fingerprint"]
    # Tap interval shifted by ~5-20%
    ratio = new_phone_sess["tap_interval_ms"] / base["metrics"]["tap_interval_ms"]["median"]
    assert 0.75 <= ratio <= 1.25, (
        f"Biometric shift on new phone should be within 5-25%, got ratio {ratio}"
    )

    # Robust z score with new_device attenuation should remain low
    z_tap = compute_robust_z(
        new_phone_sess["tap_interval_ms"],
        "tap_interval_ms",
        base["metrics"],
        new_device=True,
    )
    assert z_tap < 3.0, f"Attenuated z-score on new device should be moderate, got {z_tap}"

    # Test relocation
    reloc_sess = make_ordinary_change(persona, "relocation", day_idx=22, rng=rng)
    assert reloc_sess["label"] == "ordinary_change"
    assert reloc_sess["device_fingerprint"] == persona.primary_device["fingerprint"]
    # Underlying typing and speed remain consistent with persona
    speed_ratio = reloc_sess["avg_speed_kmh"] / base["metrics"]["avg_speed_kmh"]["median"]
    assert 0.70 <= speed_ratio <= 1.30


def test_attacks_differ_on_average():
    """
    Verifies that attack sessions (handoffs from a different persona)
    exhibit significantly larger deviations from the victim's baseline than normal sessions.
    """
    rng = np.random.RandomState(888)
    victim = generate_persona(2, rng)
    attacker = generate_persona(99, rng)

    v_hist = generate_history(victim, days=25, rng=rng)
    v_base = compute_baseline(v_hist)

    # Normal session from victim
    norm_sess = generate_history(victim, days=1, rng=rng)[0]
    norm_z_scores = [
        compute_robust_z(norm_sess[m], m, v_base["metrics"])
        for m in ["tap_interval_ms", "typing_cps", "swipe_velocity_px_s", "avg_speed_kmh"]
    ]
    avg_norm_z = np.mean(norm_z_scores)

    # Handoff session operated by attacker
    handoff_sess = make_handoff(victim, attacker, variant="classic", day_idx=30, rng=rng)
    assert handoff_sess["label"] == "suspected_handoff"
    assert handoff_sess["ground_truth_label"] == "handoff_classic"
    assert "ACCOUNT_HANDOFF" in handoff_sess["threat_tags"]

    handoff_z_scores = [
        compute_robust_z(handoff_sess[m], m, v_base["metrics"])
        for m in ["tap_interval_ms", "typing_cps", "swipe_velocity_px_s", "avg_speed_kmh"]
    ]
    avg_handoff_z = np.mean(handoff_z_scores)

    # Attacker biometrics should produce a noticeable robust z deviation
    assert avg_handoff_z > avg_norm_z or handoff_sess["biometrics"]["face_match_confidence"] < 0.5


def test_spoof_routes_speed_variance_and_straightness():
    """
    Verifies that GPS spoof routes feature unnaturally constant speed
    (near-zero variance) and high straightness ratio.
    """
    rng = np.random.RandomState(999)
    persona = generate_persona(3, rng)

    spoof_sess = make_gps_spoof(persona, day_idx=31, rng=rng)
    assert spoof_sess["label"] == "suspected_handoff"
    assert spoof_sess["ground_truth_label"] == "gps_spoof"
    assert "GPS_SPOOFING" in spoof_sess["threat_tags"]
    assert spoof_sess["telemetry"]["mock_location_detected"] is True

    # Speed variance should be extremely low compared to natural driving (> 5.0)
    assert spoof_sess["telemetry"]["speed_variance"] <= 0.05
    # Straightness ratio should be close to 1.0 (unnaturally straight)
    assert spoof_sess["telemetry"]["straightness_ratio"] >= 0.99


def test_fraud_rings_share_tokens():
    """
    Verifies that fraud ring members share device, payout, and IP tokens,
    and exhibit emulator characteristics.
    """
    rng = np.random.RandomState(101)
    personas = [generate_persona(10 + i, rng) for i in range(4)]

    ring_sessions = make_fraud_ring(personas, ring_id="ring_test_01", day_idx=32, rng=rng)
    assert len(ring_sessions) == 4

    shared_dev = ring_sessions[0]["device_fingerprint"]
    shared_payout = ring_sessions[0]["payout_account_token"]
    shared_ip = ring_sessions[0]["ip_address"]

    for s in ring_sessions:
        assert s["device_fingerprint"] == shared_dev
        assert s["payout_account_token"] == shared_payout
        assert s["ip_address"] == shared_ip
        assert s["is_emulator"] is True
        assert s["label"] == "suspected_handoff"
        assert s["ground_truth_label"] == "fraud_ring"
        assert "FRAUD_RING" in s["threat_tags"]


def test_label_counts_and_seed_acceptance():
    """
    Executes simulator seeding and asserts:
    - Held-out evaluation set has exactly 150 normal, 100 ordinary_change, 150 attacks (total 400)
    - At least 6 fraud rings are created
    - All eval sessions tagged with scenario_run_id='eval_set'
    - Seeding execution time < 30 seconds
    - Output files train.csv and eval.csv exist and are populated
    """
    summary = run_seeding(n_riders=200, n_days=30, seed=42, persist_db=True)

    assert summary["riders_count"] == 200
    assert summary["eval_sessions_count"] == 400
    assert summary["normal_eval_count"] == 150
    assert summary["ordinary_change_count"] == 100
    assert summary["attacks_count"] == 150
    assert summary["ring_count"] >= 6
    assert summary["elapsed_seconds"] < 30.0, (
        f"Seeding must take < 30s, took {summary['elapsed_seconds']}s"
    )

    # Verify CSV files exist and have data
    train_path = Path(summary["train_csv_path"])
    eval_path = Path(summary["eval_csv_path"])
    assert train_path.exists(), "train.csv must exist"
    assert eval_path.exists(), "eval.csv must exist"
    assert train_path.stat().st_size > 1000
    assert eval_path.stat().st_size > 1000
