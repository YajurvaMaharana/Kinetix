"""
TrustJuggler Rider Trust Health Score & Dynamic Friction Adjustment.
Computes a continuous trust health score (0-100) and friction tier
(NEW, ESTABLISHED, TRUSTED) based on historical delivery integrity:
- Components: account tenure, completed delivery trips, passed verification challenges,
  zero-fraud streaks, and dispute history.
- Mitigating signal: trust_health_bonus in [0, 1] applied to risk mitigation (-4 pts max).
- Dynamic friction adjustment: Shifts MONITOR/CHALLENGE boundaries by +/-5 points:
  * High trust health (TRUSTED: 80-100) softens boundary by +5 (widens ALLOW band).
  * Low trust health (NEW: 0-39) shifts boundary by -5 (earlier step-up challenges).
  * Rule floors and ESCALATE boundaries never move.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class TrustProfile:
    """Historical and behavioral track record signals for trust health scoring."""

    rider_id: Optional[str] = None
    tenure_days: float = 0.0
    completed_trips: int = 0
    passed_verifications: int = 0
    failed_verifications: int = 0
    zero_fraud_streak_days: float = 0.0
    dispute_count: int = 0
    resolved_disputes: int = 0
    active_fraud_cases: int = 0
    has_recent_fraud: bool = False


@dataclass
class TrustHealthResult:
    """Structured evaluation of a rider's trust health, friction tier, and policy adjustments."""

    score: float  # 0.0 to 100.0
    tier: str  # NEW, ESTABLISHED, TRUSTED
    trust_health_bonus: float  # 0.0 to 1.0 (mitigation factor)
    boundary_shift: float  # -5.0 to +5.0
    components: Dict[str, float] = field(default_factory=dict)
    summary: str = ""


def trust_health_tier(score: float) -> str:
    """
    Classifies trust health into friction tiers:
    - NEW: 0 - 39
    - ESTABLISHED: 40 - 79
    - TRUSTED: 80 - 100
    """
    s = float(score)
    if s >= 80.0:
        return "TRUSTED"
    if s >= 40.0:
        return "ESTABLISHED"
    return "NEW"


def trust_health_bonus(health: float) -> float:
    """
    Computes normalized mitigation bonus for riders with clean, established track records:
        bonus = clamp((health - 70.0) / 30.0, 0.0, 1.0)
    Yields -4.0 points max risk reduction at health=100.0.
    """
    bonus = (float(health) - 70.0) / 30.0
    return round(float(max(0.0, min(1.0, bonus))), 4)


def compute_boundary_shift(trust_health: float) -> float:
    """
    Computes dynamic threshold boundary shift in [-5.0, +5.0]:
    - High trust health (TRUSTED: 80-100) softens MONITOR/CHALLENGE boundary by up to +5.0.
    - Low trust health (NEW: 0-39) shifts boundary by -5.0.
    - ESTABLISHED (40-79) scales smoothly from -5.0 to +1.7 around baseline 70.0.
    Rule floors and ESCALATE boundaries never move.
    """
    s = float(trust_health)
    if s < 40.0:
        return -5.0
    shift = ((s - 70.0) / 30.0) * 5.0
    return round(float(max(-5.0, min(5.0, shift))), 1)


def calculate_trust_health(
    profile: Optional[TrustProfile] = None,
    **kwargs: Any,
) -> TrustHealthResult:
    """
    Pure function to evaluate rider trust health from history components:
    1. Account Tenure (max 25 pts)
    2. Completed Delivery Trips (max 25 pts)
    3. Verification History (max 25 pts)
    4. Zero-Fraud Streak & Disputes (max 25 pts)
    5. Sharp Fraud Degradation (penalty up to -60 pts, cap at 35)
    """
    if profile is None:
        p = TrustProfile(**{k: v for k, v in kwargs.items() if hasattr(TrustProfile, k)})
    else:
        p = profile
        for k, v in kwargs.items():
            if hasattr(p, k) and v is not None:
                setattr(p, k, v)

    # 1. Account Tenure (0 - 25 pts)
    # Seasoned accounts (>180 days) gain full 25 points; new accounts start at 5 pts
    if p.tenure_days <= 0.0:
        pts_tenure = 5.0
    else:
        pts_tenure = min(25.0, 5.0 + (p.tenure_days / 180.0) * 20.0)

    # 2. Completed Delivery Trips (0 - 25 pts)
    # 100+ clean trips demonstrates authentic courier work
    pts_trips = min(25.0, (max(0, p.completed_trips) / 100.0) * 25.0)

    # 3. Passed Verifications (0 - 25 pts)
    # Base 10 pts for enrolled biometric profile; +3 pts per passed check; -10 pts per failed check
    base_verif = 10.0
    pts_verif = base_verif + (p.passed_verifications * 3.0) - (p.failed_verifications * 10.0)
    pts_verif = max(0.0, min(25.0, pts_verif))

    streak_days = p.zero_fraud_streak_days
    if streak_days <= 0.0 and p.active_fraud_cases == 0 and not p.has_recent_fraud:
        streak_days = p.tenure_days
    pts_streak = min(20.0, (max(0.0, streak_days) / 90.0) * 20.0)
    dispute_penalty = p.dispute_count * 5.0
    dispute_remedy = p.resolved_disputes * 2.0
    pts_disputes = max(0.0, min(5.0, 5.0 - dispute_penalty + dispute_remedy))
    pts_integrity = max(0.0, min(25.0, pts_streak + pts_disputes))

    raw_score = pts_tenure + pts_trips + pts_verif + pts_integrity

    # 5. Sharp Degradation for Active Fraud Flags
    # If the rider has an active or recent fraud incident/case, degrade sharply
    has_fraud = bool(p.has_recent_fraud or p.active_fraud_cases > 0)
    if has_fraud:
        fraud_penalty = 55.0 + (p.active_fraud_cases * 10.0)
        raw_score = max(0.0, raw_score - fraud_penalty)
        raw_score = min(35.0, raw_score)  # Hard ceiling in NEW tier when flagged

    final_score = round(float(max(0.0, min(100.0, raw_score))), 1)
    tier = trust_health_tier(final_score)
    bonus = trust_health_bonus(final_score)
    shift = compute_boundary_shift(final_score)

    components = {
        "pts_tenure": round(pts_tenure, 1),
        "pts_trips": round(pts_trips, 1),
        "pts_verifications": round(pts_verif, 1),
        "pts_integrity": round(pts_integrity, 1),
        "has_recent_fraud": 1.0 if has_fraud else 0.0,
    }

    summary = (
        f"Trust Health: {final_score:.1f}/100 ({tier}). "
        f"Friction adjustment: {shift:+.1f} pts. "
        f"Mitigation bonus: {bonus:.2f}."
    )

    return TrustHealthResult(
        score=final_score,
        tier=tier,
        trust_health_bonus=bonus,
        boundary_shift=shift,
        components=components,
        summary=summary,
    )


def evaluate_trust_health(ctx: Any) -> TrustHealthResult:
    """
    Adapter hook to resolve trust health from ScoringContext or session request.
    Handles numeric trust health, TrustProfile instances, dictionaries, or database models.
    """
    th = getattr(ctx, "trust_health", None)

    if th is not None:
        if isinstance(th, (int, float)):
            score = float(th)
            tier = trust_health_tier(score)
            bonus = trust_health_bonus(score)
            shift = compute_boundary_shift(score)
            return TrustHealthResult(
                score=score,
                tier=tier,
                trust_health_bonus=bonus,
                boundary_shift=shift,
                summary=f"Trust Health: {score:.1f}/100 ({tier}). Shift: {shift:+.1f} pts.",
            )
        if isinstance(th, TrustHealthResult):
            return th
        if isinstance(th, TrustProfile):
            return calculate_trust_health(th)
        if isinstance(th, dict):
            if "score" in th and len(th) == 1:
                return evaluate_trust_health(type("Ctx", (), {"trust_health": th["score"]})())
            return calculate_trust_health(**th)
        if hasattr(th, "trust_score"):
            score = float(th.trust_score)
            tier = trust_health_tier(score)
            bonus = trust_health_bonus(score)
            shift = compute_boundary_shift(score)
            return TrustHealthResult(
                score=score,
                tier=tier,
                trust_health_bonus=bonus,
                boundary_shift=shift,
            )

    # Check baseline if available
    base = getattr(ctx, "baseline", None)
    if base and hasattr(base, "sessions_count"):
        sess_count = getattr(base, "sessions_count", 0)
        trips = getattr(base, "total_trips", sess_count * 2)
        return calculate_trust_health(
            tenure_days=max(30.0, sess_count * 3.0),
            completed_trips=trips,
            passed_verifications=1,
            zero_fraud_streak_days=max(30.0, sess_count * 3.0),
        )

    # Clean default established rider (85.0 -> TRUSTED)
    return calculate_trust_health(
        tenure_days=120.0,
        completed_trips=80,
        passed_verifications=3,
        zero_fraud_streak_days=120.0,
    )
