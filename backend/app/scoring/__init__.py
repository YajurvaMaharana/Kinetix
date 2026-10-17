"""
TrustJuggler Scoring Package.
All risk scoring, machine learning, heuristic evaluation, and feature extraction
MUST reside exclusively in this package.
"""

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
from app.scoring.risk import ScoredAssessment, ScoringContext, score_session
from app.scoring.rules import RuleEvaluationResult, RuleMatch, evaluate_rules
from app.scoring.thresholds import DEFAULT_THRESHOLDS, ThresholdConfig

__all__ = [
    "ScoringContext",
    "score_session",
    "ScoredAssessment",
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
    "evaluate_rules",
    "RuleMatch",
    "RuleEvaluationResult",
]
