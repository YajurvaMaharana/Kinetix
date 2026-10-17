"""
TrustJuggler Policy Simulator API Endpoints.
Provides endpoints to simulate candidate threshold overrides, evaluate historical friction
versus fraud detection trade-offs, and generate empirical ROC/PR trade-off curves.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends

from app.deps import get_role
from app.schemas.contracts import (
    PolicySimulateRequest,
    PolicySimulateResponse,
    TradeOffPointSchema,
)
from simulator.policy_sim import simulate_policy

simulator_router = APIRouter(tags=["Policy Simulator"])


@simulator_router.post(
    "/simulator/policy/simulate",
    response_model=PolicySimulateResponse,
    summary="Simulate policy threshold changes against held-out evaluation dataset",
)
@simulator_router.post(
    "/policies/simulate",
    response_model=PolicySimulateResponse,
    summary="Simulate policy cut-lines (legacy alias)",
)
def simulate_policy_endpoint(
    req: Optional[PolicySimulateRequest] = None,
    role: str = Depends(get_role),
) -> PolicySimulateResponse:
    """
    Replays 400 held-out evaluation sessions under candidate policy cut-lines.
    Accepts candidate threshold overrides in the request body.
    Returns:
    - total_sessions
    - fraud_recall (suspected_handoff caught at CHALLENGE+)
    - ordinary_friction (ordinary_change falsely challenged/escalated)
    - estimated_savings_usd (chargeback reduction - operational verification costs)
    - trade_off_curve (empirical ROC / PR sweep points)
    """
    candidate_overrides: Dict[str, Any] = {}
    if req is not None:
        if req.allow_threshold is not None:
            candidate_overrides["allow_threshold"] = req.allow_threshold
        if req.monitor_threshold is not None:
            candidate_overrides["monitor_threshold"] = req.monitor_threshold
        if req.challenge_threshold is not None:
            candidate_overrides["challenge_threshold"] = req.challenge_threshold
        if req.challenge_otp_threshold is not None:
            candidate_overrides["challenge_otp_threshold"] = req.challenge_otp_threshold
        if req.challenge_liveness_threshold is not None:
            candidate_overrides["challenge_liveness_threshold"] = req.challenge_liveness_threshold
        if req.escalate_threshold is not None:
            candidate_overrides["escalate_threshold"] = req.escalate_threshold
        if req.investigate_threshold is not None:
            candidate_overrides["investigate_threshold"] = req.investigate_threshold
        if req.block_threshold is not None:
            candidate_overrides["block_threshold"] = req.block_threshold
        if req.candidate_thresholds:
            candidate_overrides.update(req.candidate_thresholds)

    metrics = simulate_policy(candidate_overrides=candidate_overrides)

    trade_off_points = [
        TradeOffPointSchema(
            threshold=p["threshold"],
            fpr=p["fpr"],
            tpr=p["tpr"],
            friction=p["friction"],
            precision=p.get("precision"),
            recall=p.get("recall"),
        )
        for p in metrics.trade_off_curve
    ]

    return PolicySimulateResponse(
        total_sessions=metrics.total_sessions,
        fraud_recall=metrics.fraud_recall,
        ordinary_friction=metrics.ordinary_friction,
        estimated_savings_usd=metrics.estimated_savings_usd,
        trade_off_curve=trade_off_points,
        simulated_pass_rate=metrics.simulated_pass_rate,
        simulated_friction_rate=metrics.simulated_friction_rate,
        simulated_fraud_catch_rate=metrics.simulated_fraud_catch_rate,
        escalate_recall=metrics.escalate_recall,
        normal_friction=metrics.normal_friction,
        latency_p50_ms=metrics.latency_p50_ms,
        latency_p95_ms=metrics.latency_p95_ms,
        latency_p99_ms=metrics.latency_p99_ms,
    )
