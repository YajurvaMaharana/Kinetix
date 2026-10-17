"""
TrustJuggler Anomaly Detection Engine (Isolation Forest).
Evaluates multivariate distribution anomalies using an Isolation Forest trained exclusively
on genuine NORMAL and ORDINARY_CHANGE sessions.

Vector features (16 dimensions):
- 10 biometric & telemetry d-values (bounded in [0, 1])
- env_change (float in [0, 1])
- new_device (binary flag: 0.0 or 1.0)
- new_city (binary flag: 0.0 or 1.0)
- device_risk (stubbed to 0.0)
- travel_risk (stubbed to 0.0)
- sensitive (float in [0, 1])

Outputs percentile-ranked anomaly score in [0.0, 1.0].
Graceful degradation: if artifact is missing, returns anomaly=0.0 with a warning (never crashes).
"""

import logging
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import joblib
import numpy as np

logger = logging.getLogger("trustjuggler.anomaly")

ANOMALY_FEATURE_NAMES = [
    "d_tap_interval_ms",
    "d_typing_cps",
    "d_swipe_velocity_px_s",
    "d_interaction_timing_cv",
    "d_nav_path_similarity",
    "d_accept_latency_s",
    "d_shift_hour_dist",
    "d_avg_speed_kmh",
    "d_route_adherence",
    "d_trip_cadence_per_hr",
    "env_change",
    "new_device",
    "new_city",
    "device_risk",
    "travel_risk",
    "sensitive",
]

# Cache in-memory for microsecond scoring throughput
_CACHED_IFOREST: Optional[Any] = None
_CACHED_TRAIN_SCORES: Optional[np.ndarray] = None
_CACHED_PATH: Optional[Path] = None


def get_artifact_path() -> Path:
    """Resolves IsolationForest model artifact location."""
    # Check backend/ml/artifacts/iforest.joblib
    curr = Path(__file__).resolve()
    # If app/scoring/anomaly.py -> parent.parent.parent is backend
    backend_root = curr.parent.parent.parent
    candidate_1 = backend_root / "ml" / "artifacts" / "iforest.joblib"
    candidate_2 = backend_root / "app" / "ml" / "artifacts" / "iforest.joblib"
    candidate_3 = Path("ml/artifacts/iforest.joblib")

    for c in [candidate_1, candidate_2, candidate_3]:
        if c.exists():
            return c
    return candidate_1


def load_isolation_forest(
    artifact_path: Optional[Path] = None,
) -> Tuple[Optional[Any], Optional[np.ndarray]]:
    """
    Loads serialized IsolationForest bundle with in-memory caching.
    Returns (model, train_reference_scores).
    """
    global _CACHED_IFOREST, _CACHED_TRAIN_SCORES, _CACHED_PATH
    path = artifact_path or get_artifact_path()

    if _CACHED_IFOREST is not None and _CACHED_PATH == path:
        return _CACHED_IFOREST, _CACHED_TRAIN_SCORES

    if not path.exists():
        logger.warning(
            "IsolationForest artifact not found at %s. Fallback anomaly score will be 0.0.",
            path,
        )
        return None, None

    try:
        data = joblib.load(path)
        if isinstance(data, dict):
            _CACHED_IFOREST = data.get("model")
            _CACHED_TRAIN_SCORES = data.get("train_scores")
        else:
            _CACHED_IFOREST = data
            _CACHED_TRAIN_SCORES = None
        _CACHED_PATH = path
        return _CACHED_IFOREST, _CACHED_TRAIN_SCORES
    except Exception as e:
        logger.warning(
            "Failed to deserialize IsolationForest from %s: %s. Fallback anomaly=0.0.", path, e
        )
        return None, None


def build_anomaly_vector(
    metric_devs: Dict[str, float],
    env_change: float,
    new_device: float,
    new_city: float,
    device_risk: float,
    travel_risk: float,
    sensitive: float,
) -> np.ndarray:
    """Builds a 16-dimensional continuous feature vector for IsolationForest evaluation."""
    vec = [
        float(metric_devs.get("tap_interval_ms", 0.0)),
        float(metric_devs.get("typing_cps", 0.0)),
        float(metric_devs.get("swipe_velocity_px_s", 0.0)),
        float(metric_devs.get("interaction_timing_cv", 0.0)),
        float(metric_devs.get("nav_path_similarity", 0.0)),
        float(metric_devs.get("accept_latency_s", 0.0)),
        float(metric_devs.get("shift_hour_dist", 0.0)),
        float(metric_devs.get("avg_speed_kmh", 0.0)),
        float(metric_devs.get("route_adherence", 0.0)),
        float(metric_devs.get("trip_cadence_per_hr", 0.0)),
        float(env_change),
        float(new_device),
        float(new_city),
        float(device_risk),
        float(travel_risk),
        float(sensitive),
    ]
    return np.array(vec, dtype=np.float32)


def score_anomaly(
    vector: np.ndarray,
    artifact_path: Optional[Path] = None,
) -> float:
    """
    Evaluates vector against trained Isolation Forest and returns percentile-rank anomaly score in [0.0, 1.0].
    0.0 represents expected routine behavior; 1.0 represents extreme distributional anomaly.
    If artifact is missing or invalid, safely returns 0.0 without raising exceptions.
    """
    model, train_scores = load_isolation_forest(artifact_path)
    if model is None:
        return 0.0

    try:
        X = vector.reshape(1, -1)
        # IsolationForest score_samples returns negative anomaly score (lower is more anomalous)
        raw_score = float(-model.score_samples(X)[0])

        if train_scores is not None and len(train_scores) > 0:
            # Percentile ranking relative to empirical normal training distribution
            rank = float(np.mean(train_scores <= raw_score))
            return round(float(np.clip(rank, 0.0, 1.0)), 4)

        # Fallback logistic transformation
        norm_score = 1.0 / (1.0 + np.exp(-10.0 * (raw_score - 0.5)))
        return round(float(np.clip(norm_score, 0.0, 1.0)), 4)
    except Exception as e:
        logger.warning("Error evaluating IsolationForest sample: %s. Fallback anomaly=0.0.", e)
        return 0.0


def score_anomaly_batch(
    vectors: np.ndarray,
    artifact_path: Optional[Path] = None,
) -> np.ndarray:
    """
    Evaluates a 2D matrix of shape (N, 16) against trained Isolation Forest in a single batch pass.
    Returns a 1D array of length N containing percentile-rank anomaly scores in [0.0, 1.0].
    Provides 50-100x higher throughput than scoring samples one by one.
    """
    n_samples = len(vectors)
    if n_samples == 0:
        return np.array([], dtype=float)

    model, train_scores = load_isolation_forest(artifact_path)
    if model is None:
        return np.zeros(n_samples, dtype=float)

    try:
        X = np.asarray(vectors, dtype=float)
        if X.ndim == 1:
            X = X.reshape(1, -1)
        raw_scores = -model.score_samples(X)

        if train_scores is not None and len(train_scores) > 0:
            # Vectorized percentile rank computation using searchsorted on sorted train scores
            sorted_train = np.sort(train_scores)
            ranks = np.searchsorted(sorted_train, raw_scores, side="right") / float(
                len(sorted_train)
            )
            return np.round(np.clip(ranks, 0.0, 1.0), 4)

        norm_scores = 1.0 / (1.0 + np.exp(-10.0 * (raw_scores - 0.5)))
        return np.round(np.clip(norm_scores, 0.0, 1.0), 4)
    except Exception as e:
        logger.warning("Error in score_anomaly_batch: %s. Fallback zeros.", e)
        return np.zeros(n_samples, dtype=float)
