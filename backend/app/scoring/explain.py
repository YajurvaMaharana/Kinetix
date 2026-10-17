"""
TrustJuggler Explainability and Factor Attribution Engine.
Decomposes multi-modal risk scoring into transparent positive risk factors and mitigating factors:
- Categories strictly in: environment | behavior | sensitive | rule | anomaly | device | travel | graph | trust
- Exact points attribution: signed points sum to pre-clamp risk within rounding
- Guarantees at least one factor on every output, ranked by absolute impact (top 6 displayed)
- Plain-language analyst summary naming the classification and primary drivers
- Rider-safe explanation omitting scores, thresholds, and internal mechanics
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

VALID_CATEGORIES = {
    "environment",
    "behavior",
    "sensitive",
    "rule",
    "anomaly",
    "device",
    "travel",
    "graph",
    "trust",
}


@dataclass
class ExplanationFactor:
    code: str
    category: str
    points: float  # Signed points (+ for risk, - for mitigation)
    label: str
    observed: str
    baseline: str
    explanation: str

    def __post_init__(self):
        cat_lower = self.category.lower()
        if cat_lower not in VALID_CATEGORIES:
            raise ValueError(f"Invalid category '{self.category}'. Must be one of {VALID_CATEGORIES}")
        self.category = cat_lower
        self.points = round(float(self.points), 2)


@dataclass
class ExplanationResult:
    factors: List[ExplanationFactor]
    mitigating_factors: List[ExplanationFactor]
    top_factors: List[ExplanationFactor]
    summary: str
    rider_safe_text: str
    points_sum: float


def generate_explanation(
    components: Dict[str, float],
    rule_matches: List[Any],
    classification: str,
    pre_clamp_risk: float,
    context_details: Optional[Dict[str, Any]] = None,
) -> ExplanationResult:
    """
    Decomposes scoring inputs into signed positive risk factors and negative mitigating factors.
    Points sum to pre_clamp_risk within rounding. Top 6 factors are ranked by magnitude.
    """
    details = context_details or {}
    all_positive: List[ExplanationFactor] = []
    all_mitigations: List[ExplanationFactor] = []

    # 1. Behavior Deviation Factor (+38 * dev)
    pts_beh = components.get("pts_behavior", 0.0)
    dev_val = details.get("behavior_dev", 0.0)
    top_metrics = details.get("top_deviated_metrics", [])
    if pts_beh > 0.0:
        metric_str = ", ".join(top_metrics[:2]) if top_metrics else "touch/cadence shift"
        all_positive.append(ExplanationFactor(
            code="BEHAVIOR_DEV",
            category="behavior",
            points=pts_beh,
            label="Biometric & Motor Dynamics Deviation",
            observed=f"behavior_dev={dev_val:.2f} ({metric_str})",
            baseline="expected normal dev <= 0.35",
            explanation=f"Motor-sensory interaction rhythms diverged from rider baseline ({metric_str}).",
        ))

    # 2. Environmental Change Factor (+10 * env + 16 * env * dev)
    pts_env = components.get("pts_env", 0.0) + components.get("pts_env_interaction", 0.0)
    env_val = details.get("env_change", 0.0)
    if pts_env > 0.0:
        env_reasons = []
        if details.get("is_new_device"):
            env_reasons.append("unregistered handset")
        if details.get("new_city"):
            env_reasons.append(f"new city ({details.get('city')})")
        if details.get("new_zone"):
            env_reasons.append(f"new zone ({details.get('zone_id')})")
        reason_str = ", ".join(env_reasons) if env_reasons else "hardware/network transition"
        all_positive.append(ExplanationFactor(
            code="ENV_CHANGE",
            category="environment",
            points=pts_env,
            label="Environment & Hardware Change",
            observed=f"env_change={env_val:.2f} ({reason_str})",
            baseline="primary registered handset in home zone",
            explanation=f"Session initiated from unfamiliar operating environment ({reason_str}).",
        ))

    # 3. Sensitive Account Actions (+18 * sens)
    pts_sens = components.get("pts_sensitive", 0.0)
    sens_val = details.get("sensitive_actions", 0.0)
    if pts_sens > 0.0:
        sens_reasons = details.get("sensitive_action_types", ["account modification"])
        all_positive.append(ExplanationFactor(
            code="SENSITIVE_ACTIONS",
            category="sensitive",
            points=pts_sens,
            label="Sensitive Financial/Security Modification",
            observed=f"sensitive_score={sens_val:.2f} ({', '.join(sens_reasons)})",
            baseline="stable payout and credentials",
            explanation=f"High-impact account modification detected ({', '.join(sens_reasons)}).",
        ))

    # 4. Deterministic Rule Hits
    for rule in rule_matches:
        code = getattr(rule, "code", "RULE_HIT")
        pts = float(getattr(rule, "points", 0.0))
        obs = str(getattr(rule, "observed", "rule trigger"))
        base = str(getattr(rule, "baseline", "policy expectation"))
        exp = str(getattr(rule, "explanation", "Deterministic security rule violation."))

        cat = "rule"
        if "TRAVEL" in code or "GPS" in code:
            cat = "travel"
        elif "DEVICE" in code or "RING" in code:
            cat = "device"

        all_positive.append(ExplanationFactor(
            code=code,
            category=cat,
            points=pts,
            label=f"Rule Violation: {code.replace('_', ' ').title()}",
            observed=obs,
            baseline=base,
            explanation=exp,
        ))

    # 5. Isolation Forest Anomaly (+12 * anomaly)
    pts_anom = components.get("pts_anomaly", 0.0)
    anom_val = details.get("anomaly_score", 0.0)
    if pts_anom > 0.0:
        all_positive.append(ExplanationFactor(
            code="ANOMALY_DETECTION",
            category="anomaly",
            points=pts_anom,
            label="Multivariate Distributional Anomaly",
            observed=f"percentile_rank={anom_val:.2f}",
            baseline="cohort distribution rank <= 0.60",
            explanation="Multi-feature combination exhibits statistical anomaly relative to legitimate population.",
        ))

    # 6. Device & Travel Stubs (+10 * device_risk, +10 * travel_risk)
    pts_dev = components.get("pts_device_risk", 0.0)
    if pts_dev > 0.0:
        all_positive.append(ExplanationFactor(
            code="DEVICE_RISK",
            category="device",
            points=pts_dev,
            label="Hardware Passport Risk",
            observed=f"device_risk={details.get('device_risk', 0.0):.2f}",
            baseline="trusted hardware attestation",
            explanation="Device hardware integrity risk flagged by device passport service.",
        ))

    pts_trav = components.get("pts_travel_risk", 0.0)
    if pts_trav > 0.0:
        travel_factors = details.get("travel_factors", [])
        obs_travel = details.get("travel_observed") or f"travel_risk={details.get('travel_risk', 0.0):.2f}"
        exp_travel = details.get("travel_explanation") or "Kinematic velocity or trajectory flagged by travel analysis service."
        code_travel = details.get("travel_code") or "TRAVEL_RISK"
        label_travel = "Kinematic Travel Anomaly"

        if travel_factors:
            tf = travel_factors[0]
            obs_travel = getattr(tf, "observed", obs_travel)
            exp_travel = getattr(tf, "explanation", exp_travel)
            code_travel = getattr(tf, "code", code_travel)
            label_travel = getattr(tf, "label", label_travel)

        all_positive.append(ExplanationFactor(
            code=code_travel,
            category="travel",
            points=pts_trav,
            label=label_travel,
            observed=obs_travel,
            baseline="max plausible 150 km/h",
            explanation=exp_travel,
        ))

    # 7. Graph Syndicate Risk (+12 * graph_risk)
    pts_graph = components.get("pts_graph_risk", 0.0)
    if pts_graph > 0.0:
        all_positive.append(ExplanationFactor(
            code="GRAPH_RISK",
            category="graph",
            points=pts_graph,
            label="Syndicate Cluster Proximity",
            observed=f"graph_risk={details.get('graph_risk', 0.0):.2f}",
            baseline="isolated rider entity",
            explanation="Graph intelligence detected proximity to known collusion clusters or recycled identifiers.",
        ))

    # 8. MITIGATIONS (Negative Points)
    # Continuity (-12 * continuity)
    pts_cont = components.get("pts_continuity", 0.0)
    if pts_cont < 0.0:
        all_mitigations.append(ExplanationFactor(
            code="MITIGATION_CONTINUITY",
            category="behavior",
            points=pts_cont,
            label="Biometric Behavioral Continuity",
            observed=f"continuity={details.get('continuity', 0.0):.2f}",
            baseline="behavior_dev < 0.35",
            explanation="Rider motor-sensory interaction aligns closely with long-term personal baseline.",
        ))

    # Known Zone (-5 * known_zone)
    pts_zone = components.get("pts_known_zone", 0.0)
    if pts_zone < 0.0:
        all_mitigations.append(ExplanationFactor(
            code="MITIGATION_KNOWN_ZONE",
            category="environment",
            points=pts_zone,
            label="Familiar Delivery Zone",
            observed=f"zone_share={details.get('known_zone_share', 0.0):.1%}",
            baseline="frequent operational territory",
            explanation="Dispatched in rider's established home delivery territory.",
        ))

    # Trusted Device (-4 * trusted_device)
    pts_tdev = components.get("pts_trusted_device", 0.0)
    if pts_tdev < 0.0:
        all_mitigations.append(ExplanationFactor(
            code="MITIGATION_TRUSTED_DEVICE",
            category="device",
            points=pts_tdev,
            label="Verified Hardware Passport",
            observed="hardware_attestation=PASS",
            baseline="primary trusted device",
            explanation="Cryptographically signed hardware passport matches enrolled device.",
        ))

    # Trust Health Bonus (-4 * trust_health_bonus)
    pts_health = components.get("pts_trust_health", 0.0)
    if pts_health < 0.0:
        all_mitigations.append(ExplanationFactor(
            code="MITIGATION_HEALTH",
            category="trust",
            points=pts_health,
            label="Rider Trust Health Bonus",
            observed=f"trust_health={details.get('trust_health', 70.0):.1f}",
            baseline="health score > 70.0",
            explanation="Exemplary historical delivery track record and zero security strikes.",
        ))

    # Guarantee at least one factor on every output
    if not all_positive:
        all_positive.append(ExplanationFactor(
            code="ROUTINE_BASELINE",
            category="behavior",
            points=0.0,
            label="Routine Baseline Telemetry",
            observed="behavior_dev <= 0.15",
            baseline="normal established baseline",
            explanation="Session telemetry and biometric interactions match historical genuine behavior.",
        ))

    # Calculate points sum
    sum_pts = round(sum(f.points for f in all_positive) + sum(m.points for m in all_mitigations), 2)

    # Top 6 factors sorted by absolute magnitude
    all_combined = all_positive + all_mitigations
    top_factors = sorted(all_combined, key=lambda f: abs(f.points), reverse=True)[:6]

    # Plain-language Analyst Summary
    top_drivers = [f.label for f in top_factors if f.points > 0][:3]
    top_mitigs = [f.label for f in top_factors if f.points < 0][:2]

    driver_text = f"Primary risk drivers: {', '.join(top_drivers)}." if top_drivers else "No elevated risk drivers."
    mitig_text = f" Mitigating factors: {', '.join(top_mitigs)}." if top_mitigs else ""
    summary = f"Classified as '{classification.upper()}'. {driver_text}{mitig_text}"

    # Rider-Safe Explanation (No thresholds, no risk scores, no fraud rules)
    rider_safe = generate_rider_safe_text(
        classification=classification,
        is_new_device=details.get("is_new_device", False),
        city=details.get("city", ""),
        zone_id=details.get("zone_id", ""),
        recommended_action=details.get("recommended_action", "ALLOW"),
    )

    return ExplanationResult(
        factors=all_positive,
        mitigating_factors=all_mitigations,
        top_factors=top_factors,
        summary=summary,
        rider_safe_text=rider_safe,
        points_sum=sum_pts,
    )


def generate_rider_safe_text(
    classification: str,
    is_new_device: bool,
    city: str,
    zone_id: str,
    recommended_action: str,
) -> str:
    """
    Produces transparent, non-hostile rider-facing explanations.
    Contains NO risk scores, NO thresholds, NO sensitive detection mechanics.
    """
    if classification == "ordinary_change":
        if is_new_device:
            return (
                "We noticed you are delivering from a new device. "
                "Your account is active. To keep your earnings secure, we may occasionally request a quick verification."
            )
        return (
            f"We noticed you are delivering in a new zone ({zone_id or city}). "
            "Your account is active and safe."
        )

    if classification == "normal" or recommended_action == "ALLOW":
        return "Your account is in good standing and ready for delivery dispatches."

    if "OTP" in recommended_action:
        return (
            "For your security, we noticed an unusual sign-in attempt. "
            "Please confirm your identity by entering the one-time passcode sent to your registered phone."
        )

    if "LIVENESS" in recommended_action:
        return (
            "To safeguard your account and pending payouts, "
            "please complete a quick 5-second selfie verification to confirm you are actively using your account."
        )

    # Escalate / restrictions
    return (
        "Your account is temporarily paused for security review following unusual account or location activity. "
        "Our support team is reviewing your account and will assist you shortly."
    )
