"""
TrustJuggler Anomaly Model Training Script.
Trains an IsolationForest (n_estimators=150, random_state=42) on 16-dimensional
feature vectors derived exclusively from NORMAL and ORDINARY_CHANGE sessions.
Exports serialized bundle to ml/artifacts/iforest.joblib.

Usage:
    python -m ml.train
"""

import csv
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

# Ensure backend root on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.scoring.anomaly import ANOMALY_FEATURE_NAMES  # noqa: E402
from simulator.seed_cli import run_seeding  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("trustjuggler.ml.train")


def extract_features_from_csv_row(row: Dict[str, Any]) -> List[float]:
    """Extracts 16-dimensional anomaly vector from train.csv row."""
    # 10 d-values from z-scores: d = min(z, 4) / 4
    metrics = [
        "tap_interval_ms",
        "typing_cps",
        "swipe_velocity_px_s",
        "interaction_timing_cv",
        "nav_path_similarity",
        "accept_latency_s",
        "shift_hour_dist",
        "avg_speed_kmh",
        "route_adherence",
        "trip_cadence_per_hr",
    ]
    d_vals = []
    for m in metrics:
        z = float(row.get(f"z_{m}", 0.0))
        d = min(abs(z), 4.0) / 4.0
        d_vals.append(d)

    # Environmental indicators
    is_new_dev = (
        1.0
        if (
            "new_phone" in row.get("session_id", "")
            or "ORDINARY_CHANGE" in row.get("threat_tags", "")
        )
        else 0.0
    )
    is_new_city = 1.0 if "relocation" in row.get("session_id", "") else 0.0
    env_change = 0.35 * is_new_dev + 0.30 * is_new_city

    # Contextual stubs
    device_risk = 0.0
    travel_risk = 0.0
    sensitive = 0.0

    return d_vals + [env_change, is_new_dev, is_new_city, device_risk, travel_risk, sensitive]


def train_isolation_forest() -> Path:
    """
    Fits IsolationForest on genuine sessions and saves model bundle with reference scores.
    """
    data_dir = backend_dir / "ml" / "data"
    train_csv = data_dir / "train.csv"

    if not train_csv.exists():
        logger.info("[*] train.csv not found. Running seed_cli to generate training data...")
        run_seeding(n_riders=200, n_days=30, seed=42, persist_db=True)

    logger.info(f"[*] Reading training sessions from {train_csv}...")
    X_list: List[List[float]] = []

    with open(train_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lbl = row.get("label", "").lower()
            # Strict filtering: NORMAL and ORDINARY_CHANGE only!
            if lbl in ("normal", "ordinary_change"):
                vec = extract_features_from_csv_row(row)
                X_list.append(vec)

    if not X_list:
        raise ValueError(f"No valid NORMAL or ORDINARY_CHANGE rows found in {train_csv}")

    X_train = np.array(X_list, dtype=np.float32)
    logger.info(
        f"[+] Loaded {len(X_train)} genuine training vectors across {X_train.shape[1]} features."
    )

    # Isolation Forest: n_estimators=150, random_state=42
    logger.info("[*] Fitting IsolationForest(n_estimators=150, random_state=42)...")
    clf = IsolationForest(
        n_estimators=150,
        random_state=42,
        contamination=0.03,
        n_jobs=-1,
    )
    clf.fit(X_train)

    # Calculate negative anomaly scores on training distribution for percentile ranking
    train_scores = np.sort(-clf.score_samples(X_train))

    bundle = {
        "model": clf,
        "train_scores": train_scores,
        "feature_names": ANOMALY_FEATURE_NAMES,
        "train_samples": len(X_train),
    }

    # Persist artifact
    artifacts_dir = backend_dir / "ml" / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    out_path = artifacts_dir / "iforest.joblib"

    # Also persist to backend/app/ml/artifacts for dual import convenience
    app_artifacts_dir = backend_dir / "app" / "ml" / "artifacts"
    app_artifacts_dir.mkdir(parents=True, exist_ok=True)
    app_out_path = app_artifacts_dir / "iforest.joblib"

    joblib.dump(bundle, out_path)
    joblib.dump(bundle, app_out_path)

    logger.info(f"[OK] Trained IsolationForest serialized successfully to: {out_path}")
    return out_path


def main():
    train_isolation_forest()


if __name__ == "__main__":
    main()
