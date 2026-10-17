"""
TrustJuggler ML Pipeline Package.
Provides Isolation Forest training on genuine baseline sessions and
comprehensive evaluation on the held-out evaluation corpus.
"""

from ml.evaluate import evaluate_engine
from ml.train import train_isolation_forest

__all__ = ["train_isolation_forest", "evaluate_engine"]
