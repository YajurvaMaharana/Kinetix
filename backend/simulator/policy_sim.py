"""
TrustJuggler Policy Simulator and Threshold Replay Engine.
Replays historical evaluation sessions under candidate policy cut-lines,
computes decision mix, FPR, fraud recall, friction rate, and latency distributions,
and generates empirical ROC/PR trade-off curves.
"""

import csv
import logging
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# Ensure backend root on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.scoring.anomaly import build_anomaly_vector, score_anomaly_batch  # noqa: E402
from app.scoring.risk import ScoringContext, score_session  # noqa: E402
from app.scoring.thresholds import DEFAULT_THRESHOLDS, ThresholdConfig  # noqa: E402

logger = logging.getLogger("trustjuggler.policy_sim")

# Standard operational financial constants for fraud prevention ROI calculations
DEFAULT_COST_PER_FRAUD_USD = 120.0  # Average chargeback / account takeover loss prevented
DEFAULT_COST_PER_FRICTION_USD = 3.0  # Verification SMS / OTP / rider friction cost


@dataclass
class SessionEvalRecord:
    """Compact evaluation record representing a scored session."""

    session_id: str
    label: str  # 'normal', 'ordinary_change', 'suspected_handoff'
    ground_truth_label: str
    threat_tags: str
    risk_score: float
    raw_risk: float
    rule_floor: float
    trust_health_val: float
    trust_health_shift: float
    classification: str
    verdict: str
    latency_ms: float
    row_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TradeOffPoint:
    threshold: float
    fpr: float
    tpr: float
    friction: float
    precision: float
    recall: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "threshold": self.threshold,
            "fpr": self.fpr,
            "tpr": self.tpr,
            "friction": self.friction,
            "precision": self.precision,
            "recall": self.recall,
        }


@dataclass
class SimulationMetrics:
    total_sessions: int
    fraud_recall: float
    ordinary_friction: float
    estimated_savings_usd: float
    trade_off_curve: List[Dict[str, float]]
    simulated_pass_rate: float = 0.0
    simulated_friction_rate: float = 0.0
    simulated_fraud_catch_rate: float = 0.0
    escalate_recall: float = 0.0
    normal_friction: float = 0.0
    latency_p50_ms: float = 0.0
    latency_p95_ms: float = 0.0
    latency_p99_ms: float = 0.0
    confusion_matrix: Dict[str, Dict[str, int]] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_sessions": self.total_sessions,
            "fraud_recall": self.fraud_recall,
            "ordinary_friction": self.ordinary_friction,
            "estimated_savings_usd": self.estimated_savings_usd,
            "trade_off_curve": self.trade_off_curve,
            "simulated_pass_rate": self.simulated_pass_rate,
            "simulated_friction_rate": self.simulated_friction_rate,
            "simulated_fraud_catch_rate": self.simulated_fraud_catch_rate,
            "escalate_recall": self.escalate_recall,
            "normal_friction": self.normal_friction,
            "latency_p50_ms": self.latency_p50_ms,
            "latency_p95_ms": self.latency_p95_ms,
            "latency_p99_ms": self.latency_p99_ms,
            "confusion_matrix": self.confusion_matrix,
        }


# Global memory cache for evaluated eval.csv records
_CACHED_EVAL_RECORDS: Optional[List[SessionEvalRecord]] = None
_CACHED_CSV_PATH: Optional[Path] = None


def resolve_eval_csv_path(custom_path: Optional[Path] = None) -> Path:
    """Resolves the eval.csv dataset path reliably."""
    if custom_path and custom_path.exists():
        return custom_path

    candidates = [
        backend_dir / "ml" / "data" / "eval.csv",
        Path("ml/data/eval.csv"),
        Path("backend/ml/data/eval.csv"),
        Path(__file__).resolve().parent.parent / "ml" / "data" / "eval.csv",
    ]
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]


def load_eval_dataset(csv_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Loads 400 held-out evaluation sessions from eval.csv."""
    path = resolve_eval_csv_path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"Evaluation dataset not found at {path}. Run simulator seed_cli first.")

    rows: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    return rows


def precompute_eval_sessions(
    rows: List[Dict[str, Any]],
    cfg: Optional[ThresholdConfig] = None,
    force_reload: bool = False,
) -> List[SessionEvalRecord]:
    """
    Evaluates sessions using high-throughput batch vectorization and caching.
    Runs the full multi-modal scoring engine in < 0.2s for 400 sessions.
    """
    global _CACHED_EVAL_RECORDS
    if _CACHED_EVAL_RECORDS is not None and not force_reload and cfg is None:
        return _CACHED_EVAL_RECORDS

    active_cfg = cfg or DEFAULT_THRESHOLDS

    # 1. Batch anomaly vector computation
    vectors = []
    for r in rows:
        d_vals = {
            m: min(abs(float(r.get(f"z_{m}", 0.0) or 0.0)), 4.0) / 4.0
            for m in [
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
        }
        env_change = 0.5 if (r.get("city") and r.get("city") != "Bengaluru") else 0.0
        new_dev = 1.0 if "secondary" in str(r.get("device_id", "")) else 0.0
        new_city = 1.0 if (r.get("city") and r.get("city") != "Bengaluru") else 0.0
        dev_risk = 0.85 if bool(r.get("is_emulator") in (1, "1", True) or r.get("is_rooted") in (1, "1", True)) else 0.0
        travel_risk = 0.90 if bool(r.get("impossible_travel") in (1, "1", True)) else 0.0
        sens = 1.0 if "PAYOUT" in str(r.get("threat_tags", "")) else 0.0

        vec = build_anomaly_vector(
            metric_devs=d_vals,
            env_change=env_change,
            new_device=new_dev,
            new_city=new_city,
            device_risk=dev_risk,
            travel_risk=travel_risk,
            sensitive=sens,
        )
        vectors.append(vec)

    # 2. Batch score samples through IsolationForest
    anomaly_scores = score_anomaly_batch(np.vstack(vectors))

    # 3. Score sessions via scoring engine
    records: List[SessionEvalRecord] = []
    from app.scoring.risk import extract_trust_health
    from app.scoring.trust import compute_boundary_shift

    for idx, r in enumerate(rows):
        r_copy = dict(r)
        r_copy["anomaly_score"] = float(anomaly_scores[idx])

        ctx = ScoringContext(request_or_event=r_copy, active_policy=active_cfg)
        scored = score_session(ctx)

        health_val = extract_trust_health(ctx)
        health_shift = compute_boundary_shift(health_val)

        # Extract rule floor
        from app.scoring.rules import evaluate_rules

        rule_res = evaluate_rules(ctx, active_cfg)
        rule_floor = rule_res.rule_floor

        rec = SessionEvalRecord(
            session_id=str(r.get("session_id", f"sess_{idx}")),
            label=str(r.get("label", "normal")).strip().lower(),
            ground_truth_label=str(r.get("ground_truth_label", "normal")).strip().lower(),
            threat_tags=str(r.get("threat_tags", "")),
            risk_score=scored.risk_score,
            raw_risk=scored.raw_risk,
            rule_floor=rule_floor,
            trust_health_val=health_val,
            trust_health_shift=health_shift,
            classification=scored.classification,
            verdict=scored.verdict,
            latency_ms=scored.latency_ms,
            row_data=r_copy,
        )
        records.append(rec)

    if cfg is None:
        _CACHED_EVAL_RECORDS = records

    return records


def get_eval_records(csv_path: Optional[Path] = None, force_reload: bool = False) -> List[SessionEvalRecord]:
    """Retrieves or loads precomputed evaluation records."""
    global _CACHED_EVAL_RECORDS, _CACHED_CSV_PATH
    path = resolve_eval_csv_path(csv_path)

    if _CACHED_EVAL_RECORDS is not None and _CACHED_CSV_PATH == path and not force_reload:
        return _CACHED_EVAL_RECORDS

    rows = load_eval_dataset(path)
    records = precompute_eval_sessions(rows, force_reload=force_reload)
    _CACHED_CSV_PATH = path
    return records


def determine_verdict(
    risk_score: float,
    rule_floor: float,
    trust_shift: float,
    allow_threshold: float,
    monitor_threshold: float,
    challenge_threshold: float,
    escalate_threshold: float,
) -> str:
    """
    Evaluates session verdict according to TrustJuggler v2 policy rules:
    - Trust health shifts ALLOW/MONITOR and MONITOR/CHALLENGE boundaries by trust_shift (+/-5)
    - Rule floors and ESCALATE threshold (75) NEVER move
    """
    adj_allow = allow_threshold + trust_shift
    adj_monitor = monitor_threshold + trust_shift
    adj_challenge = challenge_threshold + trust_shift

    final_risk = max(risk_score, rule_floor)

    # Rule floors non-negotiable enforcement
    if rule_floor >= 75.0:
        return "ESCALATE"
    if rule_floor >= 60.0 and final_risk < escalate_threshold:
        return "CHALLENGE"

    if final_risk <= adj_allow:
        return "ALLOW"
    elif final_risk <= adj_monitor:
        return "MONITOR"
    elif final_risk < escalate_threshold and final_risk <= adj_challenge:
        return "CHALLENGE"
    else:
        return "ESCALATE"


def sweep_thresholds(
    records: List[SessionEvalRecord],
    start: float = 0.0,
    stop: float = 100.0,
    step: float = 2.0,
) -> List[Dict[str, float]]:
    """
    Sweeps the decision threshold across [start, stop] to produce ROC and PR curves.
    For each threshold T:
    - Session is step-up flagged (CHALLENGE+) if max(risk_score, rule_floor) >= T.
    - False Positive Rate: ordinary_change flagged / total ordinary_change.
    - True Positive Rate: suspected_handoff flagged / total suspected_handoff.
    - Friction Rate: total flagged / total sessions.
    - Precision: true positives / total flagged (1.0 when total flagged == 0).
    """
    total = len(records)
    if total == 0:
        return []

    ordinary_records = [r for r in records if r.label == "ordinary_change"]
    fraud_records = [r for r in records if r.label == "suspected_handoff"]

    n_ordinary = max(len(ordinary_records), 1)
    n_fraud = max(len(fraud_records), 1)

    ordinary_scores = np.array([max(r.risk_score, r.rule_floor) for r in ordinary_records])
    fraud_scores = np.array([max(r.risk_score, r.rule_floor) for r in fraud_records])
    all_scores = np.array([max(r.risk_score, r.rule_floor) for r in records])

    points: List[Dict[str, float]] = []
    # Generate sweep values from start to stop inclusive
    num_steps = int(round((stop - start) / step)) + 1
    thresholds = np.linspace(start, stop, num_steps)

    for t in thresholds:
        t_val = round(float(t), 1)
        fp = int(np.sum(ordinary_scores >= t_val))
        tp = int(np.sum(fraud_scores >= t_val))
        total_flagged = int(np.sum(all_scores >= t_val))

        fpr = round(fp / n_ordinary, 4)
        tpr = round(tp / n_fraud, 4)
        friction = round(total_flagged / total, 4)
        precision = round(tp / total_flagged, 4) if total_flagged > 0 else 1.0

        points.append(
            {
                "threshold": t_val,
                "fpr": fpr,
                "tpr": tpr,
                "friction": friction,
                "precision": precision,
                "recall": tpr,
            }
        )

    return points


def sweep_boundary_matrix(
    records: List[SessionEvalRecord],
    allow_range: Tuple[float, ...] = (18.0, 24.0, 30.0),
    monitor_range: Tuple[float, ...] = (38.0, 44.0, 50.0),
    challenge_range: Tuple[float, ...] = (68.0, 74.0, 80.0),
    escalate_val: float = 75.0,
) -> List[Dict[str, Any]]:
    """
    Sweeps a 3D matrix of candidate ALLOW, MONITOR, and CHALLENGE boundaries,
    evaluating friction and fraud recall for each configuration.
    """
    results: List[Dict[str, Any]] = []

    for allow_t in allow_range:
        for monitor_t in monitor_range:
            if monitor_t <= allow_t:
                continue
            for chal_t in challenge_range:
                metrics = evaluate_records_under_thresholds(
                    records,
                    allow_threshold=allow_t,
                    monitor_threshold=monitor_t,
                    challenge_threshold=chal_t,
                    escalate_threshold=escalate_val,
                )
                results.append(
                    {
                        "allow_threshold": allow_t,
                        "monitor_threshold": monitor_t,
                        "challenge_threshold": chal_t,
                        "escalate_threshold": escalate_val,
                        "fraud_recall": metrics.fraud_recall,
                        "ordinary_friction": metrics.ordinary_friction,
                        "friction_rate": metrics.simulated_friction_rate,
                        "savings_usd": metrics.estimated_savings_usd,
                    }
                )

    return results


def evaluate_records_under_thresholds(
    records: List[SessionEvalRecord],
    allow_threshold: float = 24.0,
    monitor_threshold: float = 44.0,
    challenge_threshold: float = 74.0,
    escalate_threshold: float = 75.0,
    cost_per_fraud_usd: float = DEFAULT_COST_PER_FRAUD_USD,
    cost_per_friction_usd: float = DEFAULT_COST_PER_FRICTION_USD,
) -> SimulationMetrics:
    """Computes full evaluation metrics given candidate cut-line thresholds."""
    total = len(records)
    if total == 0:
        return SimulationMetrics(
            total_sessions=0,
            fraud_recall=0.0,
            ordinary_friction=0.0,
            estimated_savings_usd=0.0,
            trade_off_curve=[],
        )

    confusion_matrix: Dict[str, Dict[str, int]] = {
        "normal": {"ALLOW": 0, "MONITOR": 0, "CHALLENGE": 0, "ESCALATE": 0},
        "ordinary_change": {"ALLOW": 0, "MONITOR": 0, "CHALLENGE": 0, "ESCALATE": 0},
        "suspected_handoff": {"ALLOW": 0, "MONITOR": 0, "CHALLENGE": 0, "ESCALATE": 0},
    }

    latencies: List[float] = []

    for r in records:
        latencies.append(r.latency_ms)
        v = determine_verdict(
            risk_score=r.risk_score,
            rule_floor=r.rule_floor,
            trust_shift=r.trust_health_shift,
            allow_threshold=allow_threshold,
            monitor_threshold=monitor_threshold,
            challenge_threshold=challenge_threshold,
            escalate_threshold=escalate_threshold,
        )
        lbl = r.label if r.label in confusion_matrix else "normal"
        confusion_matrix[lbl][v] = confusion_matrix[lbl].get(v, 0) + 1

    # Counts
    normal_total = sum(confusion_matrix["normal"].values()) or 1
    ord_total = sum(confusion_matrix["ordinary_change"].values()) or 1
    fraud_total = sum(confusion_matrix["suspected_handoff"].values()) or 1

    # Fraud recall @ CHALLENGE+ and @ ESCALATE
    fraud_challenge = confusion_matrix["suspected_handoff"].get("CHALLENGE", 0)
    fraud_escalate = confusion_matrix["suspected_handoff"].get("ESCALATE", 0)
    fraud_caught = fraud_challenge + fraud_escalate
    fraud_recall = round(fraud_caught / fraud_total, 4)
    escalate_recall = round(fraud_escalate / fraud_total, 4)

    # Ordinary friction (false positives challenged or escalated)
    ord_fp = (
        confusion_matrix["ordinary_change"].get("CHALLENGE", 0)
        + confusion_matrix["ordinary_change"].get("ESCALATE", 0)
    )
    ordinary_friction = round(ord_fp / ord_total, 4)

    # Normal friction
    norm_fp = confusion_matrix["normal"].get("CHALLENGE", 0) + confusion_matrix["normal"].get("ESCALATE", 0)
    normal_friction = round(norm_fp / normal_total, 4)

    # Overall friction & pass rates
    total_challenged = fraud_caught + ord_fp + norm_fp
    simulated_friction_rate = round(total_challenged / total, 4)
    simulated_pass_rate = round(1.0 - simulated_friction_rate, 4)

    # Estimated savings: fraud caught * $120 - false positive friction * $3
    total_fp = ord_fp + norm_fp
    savings = (fraud_caught * cost_per_fraud_usd) - (total_fp * cost_per_friction_usd)
    estimated_savings_usd = round(max(0.0, savings), 2)

    # Latencies
    lat_arr = np.array(latencies) if latencies else np.array([0.0])
    p50 = round(float(np.percentile(lat_arr, 50)), 2)
    p95 = round(float(np.percentile(lat_arr, 95)), 2)
    p99 = round(float(np.percentile(lat_arr, 99)), 2)

    # Generate trade-off points
    trade_off = sweep_thresholds(records, start=0.0, stop=100.0, step=5.0)

    return SimulationMetrics(
        total_sessions=total,
        fraud_recall=fraud_recall,
        ordinary_friction=ordinary_friction,
        estimated_savings_usd=estimated_savings_usd,
        trade_off_curve=trade_off,
        simulated_pass_rate=simulated_pass_rate,
        simulated_friction_rate=simulated_friction_rate,
        simulated_fraud_catch_rate=fraud_recall,
        escalate_recall=escalate_recall,
        normal_friction=normal_friction,
        latency_p50_ms=p50,
        latency_p95_ms=p95,
        latency_p99_ms=p99,
        confusion_matrix=confusion_matrix,
    )


def simulate_policy(
    candidate_overrides: Optional[Dict[str, Any]] = None,
    csv_path: Optional[Path] = None,
    force_reload: bool = False,
) -> SimulationMetrics:
    """
    Main simulator entry point.
    Accepts candidate threshold cut-lines, evaluates against eval.csv,
    and returns comprehensive simulation metrics and trade-off curves.
    """
    overrides = candidate_overrides or {}

    # Extract threshold overrides with sensible fallbacks
    allow_t = float(overrides.get("allow_threshold") or DEFAULT_THRESHOLDS.allow_threshold)
    monitor_t = float(overrides.get("monitor_threshold") or DEFAULT_THRESHOLDS.monitor_threshold)

    # Support challenge_threshold, challenge_liveness_threshold, or legacy investigate_threshold
    chal_t = overrides.get("challenge_threshold")
    if chal_t is None:
        chal_t = overrides.get("challenge_liveness_threshold")
    if chal_t is None:
        chal_t = overrides.get("investigate_threshold")
    if chal_t is None:
        chal_t = DEFAULT_THRESHOLDS.challenge_liveness_threshold
    chal_t = float(chal_t)

    # Escalate threshold (or legacy block_threshold)
    esc_t = overrides.get("escalate_threshold")
    if esc_t is None:
        esc_t = overrides.get("block_threshold")
    if esc_t is None:
        esc_t = DEFAULT_THRESHOLDS.escalate_threshold
    esc_t = float(esc_t)

    # Detect legacy Trust Score cut-lines (higher is safer: allow > challenge) and invert to Risk Score space
    if allow_t > chal_t and allow_t > 50.0:
        raw_allow = allow_t
        raw_chal = chal_t
        inv_t = overrides.get("investigate_threshold")
        block_t = overrides.get("block_threshold")

        allow_t = round(max(0.0, 100.0 - raw_allow), 1)
        monitor_t = round(max(0.0, 100.0 - raw_chal), 1)
        chal_t = round(max(0.0, 100.0 - float(inv_t)), 1) if inv_t is not None else 74.0
        esc_t = round(max(0.0, 100.0 - float(block_t)), 1) if block_t is not None else 75.0


    # Check if custom weights or parameters are supplied that require full rescoring
    non_threshold_keys = [
        k for k in overrides
        if k not in (
            "allow_threshold",
            "monitor_threshold",
            "challenge_threshold",
            "challenge_otp_threshold",
            "challenge_liveness_threshold",
            "escalate_threshold",
            "investigate_threshold",
            "block_threshold",
            "candidate_thresholds",
        )
    ]

    if non_threshold_keys:
        cfg = ThresholdConfig.from_policy_config(overrides)
        rows = load_eval_dataset(csv_path)
        records = precompute_eval_sessions(rows, cfg=cfg, force_reload=True)
    else:
        records = get_eval_records(csv_path, force_reload=force_reload)

    return evaluate_records_under_thresholds(
        records,
        allow_threshold=allow_t,
        monitor_threshold=monitor_t,
        challenge_threshold=chal_t,
        escalate_threshold=esc_t,
    )
