"""
TrustJuggler Scoring Thresholds and Parameters Configuration.
Defines ONE centralized, versioned dataclass holding all risk weights, decision bands,
caps, floors, mitigation factors, personalization shifts, and operational parameters.
Provides pure factory methods to load from database PolicyConfig entities or dictionaries.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class ThresholdConfig:
    """
    Centralized configuration holding all scoring engine weights, policy decision thresholds,
    robust z floors, environment/sensitive penalties, and temporal smoothing rates.

    Design Rationale:
    Centralizing parameters in a single immutable dataclass ensures complete mathematical transparency,
    avoids magic numbers scattered across scoring code, and allows hot-reloading from PolicyConfig records.
    """
    version: str = "v2.4.0"

    # --------------------------------------------------------------------------
    # 1. Decision Tiers & Bands (Risk Range: 0 to 100)
    # --------------------------------------------------------------------------
    allow_threshold: float = 24.0               # ALLOW: 0 - 24
    monitor_threshold: float = 44.0             # MONITOR: 25 - 44
    challenge_otp_threshold: float = 59.0       # CHALLENGE (OTP): 45 - 59
    challenge_liveness_threshold: float = 74.0  # CHALLENGE (Liveness Selfie): 60 - 74
    escalate_threshold: float = 75.0            # ESCALATE: 75 - 100 (never moves)

    # --------------------------------------------------------------------------
    # 2. Personalization & Trust Health Shifts
    # --------------------------------------------------------------------------
    trust_health_shift_max: float = 5.0         # Shifts MONITOR/CHALLENGE bands by +/-5
    trust_health_baseline: float = 70.0         # Health score reference baseline
    trust_health_scale: float = 30.0            # Scale divisor for health bonus

    # --------------------------------------------------------------------------
    # 3. Multi-Modal Composite Scoring Weights
    # Formula: raw = 38*dev + 12*anom + 18*sens + 10*env + 16*env*dev + 10*dev_risk + 12*graph
    # --------------------------------------------------------------------------
    w_behavior_dev: float = 38.0
    w_anomaly: float = 12.0
    w_sensitive: float = 18.0
    w_env: float = 10.0
    w_env_behavior_interaction: float = 16.0
    w_device_risk: float = 10.0
    w_travel_risk: float = 10.0
    w_graph_risk: float = 12.0

    # --------------------------------------------------------------------------
    # 4. Mitigation Deductions (Negative Point Reductions)
    # --------------------------------------------------------------------------
    m_continuity: float = -12.0                 # -12 * continuity
    m_known_zone: float = -5.0                  # -5 * known_zone_share
    m_trusted_device: float = -4.0              # -4 * trusted_device_signal
    m_trust_health_bonus: float = -4.0          # -4 * trust_health_bonus

    # --------------------------------------------------------------------------
    # 5. Overrides, Caps & Rule Floors
    # --------------------------------------------------------------------------
    ordinary_change_cap: float = 44.0           # Ordinary change risk ceiling (<= 44)
    suspected_handoff_floor: float = 75.0       # Suspected handoff risk floor (>= 75)
    min_risk: float = 0.0
    max_risk: float = 100.0

    # Deterministic Rule Points and Mandatory Floors
    rule_impossible_travel_points: float = 25.0
    rule_impossible_travel_floor: float = 60.0

    rule_gps_spoofing_points: float = 20.0
    rule_gps_spoofing_floor: float = 60.0

    rule_concurrent_session_points: float = 20.0
    rule_concurrent_session_floor: float = 60.0

    rule_face_mismatch_points: float = 30.0
    rule_face_mismatch_floor: float = 75.0

    rule_liveness_failed_points: float = 30.0
    rule_liveness_failed_floor: float = 75.0

    rule_fraud_ring_points: float = 15.0
    rule_fraud_ring_floor: float = 60.0

    # --------------------------------------------------------------------------
    # 6. Behavior Metric Weights & Attenuation
    # --------------------------------------------------------------------------
    metric_weights: Dict[str, float] = field(default_factory=lambda: {
        "tap_interval_ms": 1.2,
        "typing_cps": 1.2,
        "swipe_velocity_px_s": 1.0,
        "interaction_timing_cv": 0.9,
        "nav_path_similarity": 1.4,
        "accept_latency_s": 0.8,
        "shift_hour_dist": 0.8,
        "avg_speed_kmh": 1.1,
        "route_adherence": 1.0,
        "trip_cadence_per_hr": 0.8,
    })

    # Per-metric minimum MAD floors to safeguard against zero-variance baselines
    metric_mad_floors: Dict[str, float] = field(default_factory=lambda: {
        "tap_interval_ms": 1.5,
        "typing_cps": 0.05,
        "swipe_velocity_px_s": 10.0,
        "interaction_timing_cv": 0.005,
        "nav_path_similarity": 0.005,
        "accept_latency_s": 0.2,
        "shift_hour_dist": 0.2,
        "avg_speed_kmh": 0.5,
        "route_adherence": 0.005,
        "trip_cadence_per_hr": 0.05,
    })

    new_device_touch_attenuation: float = 0.5   # Tap/typing/swipe weight x0.5 on new device
    robust_z_cap: float = 4.0                   # Deviation d = min(z, 4) / 4
    cold_start_session_threshold: int = 5       # < 5 sessions implies cold start
    behavior_continuity_threshold: float = 0.35 # behavior_dev < 0.35 yields continuity bonus

    # --------------------------------------------------------------------------
    # 7. Environment Weights
    # --------------------------------------------------------------------------
    w_env_new_device: float = 0.35
    w_env_new_city: float = 0.30
    w_env_new_zone: float = 0.10
    w_env_new_asn: float = 0.25
    adjacency_discount: float = 0.5             # Half credit for adjacent zone / city

    # --------------------------------------------------------------------------
    # 8. Sensitive Action Weights
    # --------------------------------------------------------------------------
    w_sens_payout: float = 0.5
    w_sens_phone: float = 0.3
    w_sens_password: float = 0.2
    w_sens_withdrawal_pref: float = 0.2
    sens_new_env_boost: float = 1.3             # 1.3x boost within 24h of new device/city
    sens_boost_window_hours: float = 24.0

    # --------------------------------------------------------------------------
    # 9. Temporal Smoothing & Drift Parameters
    # --------------------------------------------------------------------------
    smoothing_prev_weight: float = 0.7          # risk_t = max(new, 0.7*prev + 0.3*new)
    smoothing_new_weight: float = 0.3
    ewma_alpha: float = 0.25                    # Exponential moving average smoothing factor
    cooldown_hours: float = 48.0

    # --------------------------------------------------------------------------
    # 10. Kinematic Travel & Telemetry Parameters
    # --------------------------------------------------------------------------
    max_feasible_speed_kmh: float = 150.0       # Speed limit (infeasible when > 150 km/h)
    min_time_interval_s: float = 5.0            # Ignore gaps under 5s to avoid GPS noise
    gps_jump_distance_km: float = 1.0           # Teleportation distance jump threshold
    spoof_straightness_ratio: float = 0.98      # Spoof straightness threshold (> 0.98)
    spoof_speed_cv: float = 0.05                # Spoof speed CV threshold (< 0.05)
    spoof_jitter_floor: float = 1.5             # Spoof bearing jitter floor (< 1.5 deg)
    spoof_min_pings: int = 8                    # Minimum pings required for route test

    @classmethod

    def from_policy_config(cls, policy_config_or_dict: Optional[Any] = None) -> "ThresholdConfig":
        """
        Pure factory to instantiate ThresholdConfig from a database PolicyConfig model,
        dictionary, or fallback to production defaults.
        """
        cfg = cls()
        if policy_config_or_dict is None:
            return cfg

        if isinstance(policy_config_or_dict, dict):
            for k, v in policy_config_or_dict.items():
                if hasattr(cfg, k) and v is not None:
                    setattr(cfg, k, v)
        else:
            # SQLAlchemy model or dataclass object
            for k in [
                "version",
                "allow_threshold",
                "monitor_threshold",
                "challenge_threshold",
                "escalate_threshold",
            ]:
                if hasattr(policy_config_or_dict, k):
                    val = getattr(policy_config_or_dict, k)
                    if val is not None:
                        if k == "challenge_threshold":
                            cfg.challenge_liveness_threshold = float(val)
                        elif hasattr(cfg, k):
                            setattr(cfg, k, float(val) if isinstance(getattr(cfg, k), float) else val)

        return cfg


# Global production default instance
DEFAULT_THRESHOLDS = ThresholdConfig()
