"""TrustJuggler Scoring Package.

Exposes real-time multi-modal risk scoring, feature extractors, anomaly detection,
rule hooks, explainability decomposition, threshold configurations, and kinematic travel analysis.
"""

from app.scoring.anomaly import (
    ANOMALY_FEATURE_NAMES,
    build_anomaly_vector,
    load_isolation_forest,
    score_anomaly,
)
from app.scoring.explain import (
    ExplanationFactor,
    ExplanationResult,
    generate_explanation,
    generate_rider_safe_text,
)
from app.scoring.features import (
    BehaviorDeviationResult,
    MetricRecord,
    behavior_continuity,
    behavior_deviation,
    circular_hour_distance,
    environment_change,
    ewma_drift,
    known_zone_share,
    robust_z,
    sensitive_actions,
    trust_health_bonus,
    trusted_device_signal,
)
from app.scoring.risk import (
    Assessment,
    ScoredAssessment,
    ScoringContext,
    extract_device_risk,
    extract_graph_risk,
    extract_travel_risk,
    extract_trust_health,
    score_session,
)
from app.scoring.rules import (
    RuleEvaluationResult,
    RuleHit,
    RuleMatch,
    evaluate_rules,
)
from app.scoring.thresholds import DEFAULT_THRESHOLDS, ThresholdConfig
from app.scoring.travel import (
    JumpResult,
    RoutePlausibilityResult,
    SpeedResult,
    TravelAssessment,
    evaluate_travel,
    gps_jump,
    haversine,
    implied_speed,
    route_plausibility,
    zone_feasibility,
)

__all__ = [
    "ScoringContext",
    "score_session",
    "ScoredAssessment",
    "Assessment",
    "ThresholdConfig",
    "DEFAULT_THRESHOLDS",
    "robust_z",
    "circular_hour_distance",
    "behavior_deviation",
    "environment_change",
    "sensitive_actions",
    "behavior_continuity",
    "known_zone_share",
    "trusted_device_signal",
    "trust_health_bonus",
    "ewma_drift",
    "BehaviorDeviationResult",
    "MetricRecord",
    "build_anomaly_vector",
    "score_anomaly",
    "load_isolation_forest",
    "ANOMALY_FEATURE_NAMES",
    "RuleHit",
    "RuleMatch",
    "RuleEvaluationResult",
    "evaluate_rules",
    "ExplanationFactor",
    "ExplanationResult",
    "generate_explanation",
    "generate_rider_safe_text",
    "extract_device_risk",
    "extract_travel_risk",
    "extract_graph_risk",
    "extract_trust_health",
    "haversine",
    "implied_speed",
    "gps_jump",
    "route_plausibility",
    "zone_feasibility",
    "evaluate_travel",
    "TravelAssessment",
    "SpeedResult",
    "JumpResult",
    "RoutePlausibilityResult",
]
