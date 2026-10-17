"""
TrustJuggler Simulator Package.
Synthetic data generation engine for rider personas, 10 behavior biometrics,
session event pipelines, ordinary life changes, attacks, and baseline computation.
"""

from simulator.attacks import (
    make_fraud_ring,
    make_gps_spoof,
    make_handoff,
    make_impossible_travel,
    make_payout_hijack,
)
from simulator.baseline import (
    DEFAULT_METRIC_BOUNDS,
    METRIC_NAMES,
    compute_baseline,
    compute_robust_z,
)
from simulator.generator import (
    compute_walk_similarity,
    generate_history,
    generate_nav_walk,
    generate_route_points,
    generate_single_session,
    make_ordinary_change,
)
from simulator.personas import (
    CITIES_ZONES,
    DEVICE_MODELS,
    SCREENS,
    RiderPersona,
    generate_persona,
)

__all__ = [
    "METRIC_NAMES",
    "DEFAULT_METRIC_BOUNDS",
    "CITIES_ZONES",
    "DEVICE_MODELS",
    "SCREENS",
    "RiderPersona",
    "generate_persona",
    "compute_baseline",
    "compute_robust_z",
    "generate_nav_walk",
    "compute_walk_similarity",
    "generate_route_points",
    "generate_single_session",
    "generate_history",
    "make_ordinary_change",
    "make_handoff",
    "make_gps_spoof",
    "make_impossible_travel",
    "make_fraud_ring",
    "make_payout_hijack",
    "simulate_policy",
    "load_eval_dataset",
    "sweep_thresholds",
    "sweep_boundary_matrix",
    "evaluate_records_under_thresholds",
    "SimulationMetrics",
    "SessionEvalRecord",
]

from simulator.policy_sim import (
    SessionEvalRecord,
    SimulationMetrics,
    evaluate_records_under_thresholds,
    load_eval_dataset,
    simulate_policy,
    sweep_boundary_matrix,
    sweep_thresholds,
)
