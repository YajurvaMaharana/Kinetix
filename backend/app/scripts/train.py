import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import joblib  # noqa: E402
import numpy as np  # noqa: E402
from sklearn.ensemble import RandomForestClassifier  # noqa: E402
from sklearn.metrics import accuracy_score, roc_auc_score  # noqa: E402

from app.config import settings  # noqa: E402


def train_model():
    """
    Trains baseline behavioral Random Forest Classifier on simulated telemetry features
    and exports serialized artifact to app/ml/artifacts/trust_rf_v2.joblib.
    """
    print(f"[*] Starting TrustJuggler v2 Behavioral ML Training ({settings.MODEL_VERSION})...")
    np.random.seed(42)

    # 6 Features:
    # 0: speed_kmh
    # 1: acceleration_variance
    # 2: gyro_stability
    # 3: typing_cadence_cpm
    # 4: route_deviation_pct
    # 5: biometric_face_similarity
    n_samples = 1500

    # Class 0: Clean / Genuine trips
    n_clean = 1200
    X_clean = np.column_stack([
        np.random.normal(35, 12, n_clean).clip(5, 75),
        np.random.normal(0.18, 0.05, n_clean).clip(0.05, 0.4),
        np.random.normal(0.90, 0.06, n_clean).clip(0.7, 1.0),
        np.random.normal(220, 30, n_clean).clip(140, 320),
        np.random.normal(3.0, 1.8, n_clean).clip(0, 10),
        np.random.normal(0.95, 0.04, n_clean).clip(0.85, 1.0),
    ])
    y_clean = np.zeros(n_clean)

    # Class 1: Fraud / Anomalous (Handoff, GPS Spoof, Emulator)
    n_fraud = 300
    X_fraud = np.column_stack([
        np.random.choice([0.5, 180, 240], n_fraud),
        np.random.choice([0.01, 1.2], n_fraud),
        np.random.uniform(0.1, 0.6, n_fraud),
        np.random.choice([40, 480], n_fraud),
        np.random.uniform(25, 90, n_fraud),
        np.random.uniform(0.05, 0.45, n_fraud),
    ])
    y_fraud = np.ones(n_fraud)

    X = np.vstack([X_clean, X_fraud])
    y = np.concatenate([y_clean, y_fraud])

    # Shuffle
    indices = np.random.permutation(n_samples)
    X, y = X[indices], y[indices]

    split = int(0.8 * n_samples)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    clf = RandomForestClassifier(n_estimators=50, max_depth=6, random_state=42)
    clf.fit(X_train, y_train)

    y_pred_proba = clf.predict_proba(X_test)[:, 1]
    y_pred = clf.predict(X_test)

    auc = roc_auc_score(y_test, y_pred_proba)
    acc = accuracy_score(y_test, y_pred)

    print(f"[+] Model Accuracy: {acc * 100:.2f}%")
    print(f"[+] Validation ROC-AUC: {auc:.4f}")

    # Artifact persistence
    artifacts_dir = Path(__file__).resolve().parent.parent / "ml" / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    out_path = artifacts_dir / "trust_rf_v2.joblib"

    joblib.dump(clf, out_path)
    print(f"[OK] Serialized model saved to: {out_path}")


if __name__ == "__main__":
    train_model()
