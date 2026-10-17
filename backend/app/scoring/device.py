"""
TrustJuggler Device Trust Passport and Hardware Attestation Scoring Engine.
Pure scoring functions for evaluating device risk, hardware integrity,
multi-account collisions, network reputation, and trust signal graduation.
"""

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class DeviceFactorRecord:
    code: str
    name: str
    category: str = "device"
    impact: str = "HIGH"
    weight: float = 1.0
    score: float = 0.0
    points: float = 0.0
    observed: str = ""
    baseline: str = ""
    explanation: str = ""
    description: str = ""

    def __post_init__(self):
        if not self.description:
            self.description = self.explanation


@dataclass
class DeviceAssessment:
    device_risk: float
    factors: List[DeviceFactorRecord] = field(default_factory=list)
    trusted_device_signal: float = 0.0
    passport_score: float = 100.0  # 0 to 100 scale
    trust_level: str = "new"
    details: Dict[str, Any] = field(default_factory=dict)


class DeviceRiskScore(float):
    """
    Float subclass allowing device_risk() to be used as a numerical float
    while carrying rich factor records and trust signals.
    """
    factors: List[DeviceFactorRecord]
    trusted_device_signal: float
    passport_score: float

    def __new__(
        cls,
        value: float,
        factors: Optional[List[DeviceFactorRecord]] = None,
        trusted_signal: float = 0.0,
        passport_score: float = 100.0,
    ):
        v = round(max(0.0, min(1.0, float(value))), 4)
        obj = super().__new__(cls, v)
        obj.factors = factors or []
        obj.trusted_device_signal = round(max(0.0, min(1.0, float(trusted_signal))), 4)
        obj.passport_score = round(max(0.0, min(100.0, float(passport_score))), 1)
        return obj


def _extract_dict(obj: Any) -> Dict[str, Any]:
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump"):
        try:
            return obj.model_dump()
        except Exception:
            pass
    if hasattr(obj, "__dict__"):
        return {k: v for k, v in vars(obj).items() if not k.startswith("_")}
    return {}


def _bool_val(val: Any) -> bool:
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val != 0
    s = str(val).strip().lower()
    return s in ("1", "true", "yes", "y", "t")


def evaluate_device(
    passport: Any,
    is_new_device: bool = False,
    baseline: Any = None,
) -> DeviceAssessment:
    """
    Pure comprehensive device evaluation returning DeviceAssessment with
    calibrated device_risk, structured factor records, and trusted_device_signal.
    """
    p_dict = _extract_dict(passport)

    # 1. Extract Hardware Attestation & Collision Flags
    emulator = _bool_val(
        p_dict.get("is_emulator")
        or p_dict.get("emulator")
        or getattr(passport, "is_emulator", False)
    )

    rooted = _bool_val(
        p_dict.get("is_rooted")
        or p_dict.get("rooted")
        or p_dict.get("rooted_or_jailbroken")
        or getattr(passport, "is_rooted", False)
    )

    mock_location_seen = _bool_val(
        p_dict.get("mock_location_seen")
        or p_dict.get("mock_location_detected")
        or getattr(passport, "mock_location_seen", False)
    )

    # Linked rider count (shared hardware collision)
    linked_rider_count = 1
    if "linked_rider_count" in p_dict and p_dict["linked_rider_count"] is not None:
        linked_rider_count = int(p_dict["linked_rider_count"])
    elif hasattr(passport, "linked_rider_count"):
        try:
            cnt = passport.linked_rider_count
            linked_rider_count = int(cnt() if callable(cnt) else cnt)
        except Exception:
            linked_rider_count = 1
    elif "associated_riders_count" in p_dict and p_dict["associated_riders_count"] is not None:
        linked_rider_count = int(p_dict["associated_riders_count"])
    elif hasattr(passport, "device_riders"):
        try:
            dr = passport.device_riders
            if dr is not None:
                linked_rider_count = len(dr)
        except Exception:
            pass

    # Network Reputation [0.0, 1.0]
    net_rep = 1.0
    if "network_reputation" in p_dict and p_dict["network_reputation"] is not None:
        try:
            net_rep = float(p_dict["network_reputation"])
        except (ValueError, TypeError):
            net_rep = 1.0
    elif hasattr(passport, "network_reputation") and passport.network_reputation is not None:
        try:
            net_rep = float(passport.network_reputation)
        except (ValueError, TypeError):
            net_rep = 1.0
    net_rep = max(0.0, min(1.0, net_rep))

    # 2. Mathematical Device Risk Calculation per Prompt Specification:
    # device_risk(passport) in [0,1] = clip(
    #     0.5*emulator + 0.4*rooted + 0.5*mock_location_seen
    #     + (0.6 if linked_rider_count == 2 else 1.0 if >= 3 else 0.0)
    #     + 0.3*(1 - network_reputation)
    # )
    linked_risk = 0.0
    if linked_rider_count >= 3:
        linked_risk = 1.0
    elif linked_rider_count == 2:
        linked_risk = 0.6

    raw_risk = (
        0.5 * (1.0 if emulator else 0.0)
        + 0.4 * (1.0 if rooted else 0.0)
        + 0.5 * (1.0 if mock_location_seen else 0.0)
        + linked_risk
        + 0.3 * (1.0 - net_rep)
    )
    final_device_risk = round(max(0.0, min(1.0, raw_risk)), 4)
    passport_score = round(max(0.0, min(100.0, (1.0 - final_device_risk) * 100.0)), 1)

    # 3. Factor Records Generation
    factors: List[DeviceFactorRecord] = []

    if emulator:
        factors.append(
            DeviceFactorRecord(
                code="DEVICE_EMULATOR",
                name="Device Emulator Detected",
                category="device",
                impact="HIGH",
                weight=1.0,
                score=0.5,
                points=15.0,
                observed="is_emulator=True",
                baseline="physical_device=True",
                explanation="Session originated from an emulated Android/iOS virtual environment.",
            )
        )

    if rooted:
        factors.append(
            DeviceFactorRecord(
                code="DEVICE_ROOTED",
                name="Rooted or Jailbroken Device",
                category="device",
                impact="HIGH",
                weight=1.0,
                score=0.4,
                points=12.0,
                observed="is_rooted=True",
                baseline="os_integrity_verified=True",
                explanation="Device operating system integrity has been compromised by root or jailbreak binaries.",
            )
        )

    if mock_location_seen:
        factors.append(
            DeviceFactorRecord(
                code="MOCK_LOCATION",
                name="Mock Location Provider Detected",
                category="device",
                impact="HIGH",
                weight=1.0,
                score=0.5,
                points=15.0,
                observed="mock_location_seen=True",
                baseline="hardware_gps=True",
                explanation="Device is actively utilizing a mock GPS location provider or developer options spoofing.",
            )
        )

    if linked_rider_count >= 2:
        factors.append(
            DeviceFactorRecord(
                code="DEVICE_MULTI_ACCOUNT",
                name="Multi-Account Device Collision",
                category="device",
                impact="CRITICAL" if linked_rider_count >= 3 else "MEDIUM",
                weight=1.0,
                score=linked_risk,
                points=20.0 if linked_rider_count >= 3 else 10.0,
                observed=f"linked_rider_count={linked_rider_count}",
                baseline="linked_rider_count<=1",
                explanation=f"Hardware fingerprint is shared across {linked_rider_count} distinct rider accounts.",
            )
        )

    if net_rep < 0.70:
        factors.append(
            DeviceFactorRecord(
                code="POOR_NETWORK_REPUTATION",
                name="Poor Network Reputation",
                category="device",
                impact="MEDIUM",
                weight=1.0,
                score=round(0.3 * (1.0 - net_rep), 2),
                points=8.0,
                observed=f"network_reputation={net_rep:.2f}",
                baseline="network_reputation>=0.80",
                explanation="Connection established from suspicious ASN, hosting provider, or known proxy/VPN pool.",
            )
        )

    # 4. Trusted Device Signal [0.0, 1.0]
    trust_level = str(
        p_dict.get("trust_level") or getattr(passport, "trust_level", "new")
    ).lower()

    trust_sig = 0.0
    if not is_new_device and not emulator and not rooted and not mock_location_seen and linked_rider_count <= 1:
        if trust_level == "trusted":
            trust_sig = 1.0
        elif trust_level == "provisional":
            trust_sig = 0.5
        else:
            trust_rating = float(p_dict.get("trust_rating") or getattr(passport, "trust_rating", 1.0))
            if trust_rating >= 1.0:
                trust_sig = 1.0
            else:
                trust_sig = round(max(0.0, min(1.0, trust_rating)), 3)

    # Check baseline gradual adaptation state
    if baseline is not None:
        base_dict = _extract_dict(baseline)
        adapt_raw = (
            base_dict.get("adaptation_state_json") or base_dict.get("adaptation_state") or {}
        )
        if isinstance(adapt_raw, str):
            try:
                adapt_st = json.loads(adapt_raw)
            except Exception:
                adapt_st = {}
        elif isinstance(adapt_raw, dict):
            adapt_st = adapt_raw
        else:
            adapt_st = {}

        if adapt_st.get("new_device", {}).get("trusted"):
            trust_sig = 1.0

    return DeviceAssessment(
        device_risk=final_device_risk,
        factors=factors,
        trusted_device_signal=trust_sig,
        passport_score=passport_score,
        trust_level=trust_level,
        details={
            "emulator": emulator,
            "rooted": rooted,
            "mock_location_seen": mock_location_seen,
            "linked_rider_count": linked_rider_count,
            "network_reputation": net_rep,
        },
    )


def device_risk(passport: Any) -> DeviceRiskScore:
    """
    Computes pure device_risk in [0.0, 1.0] per Prompt specification:
    clip(0.5*emulator + 0.4*rooted + 0.5*mock_location_seen +
         (0.6 if linked_rider_count == 2 else 1.0 if >= 3 else 0.0) +
         0.3*(1 - network_reputation))
    Returns a DeviceRiskScore float subclass containing factor records.
    """
    assessment = evaluate_device(passport)
    return DeviceRiskScore(
        value=assessment.device_risk,
        factors=assessment.factors,
        trusted_signal=assessment.trusted_device_signal,
        passport_score=assessment.passport_score,
    )


def get_device_factors(passport: Any) -> List[DeviceFactorRecord]:
    """Retrieves factor records associated with the device passport."""
    assessment = evaluate_device(passport)
    return assessment.factors


def trusted_device_signal(
    device: Optional[Any],
    is_new_device: bool = False,
    baseline: Optional[Any] = None,
) -> float:
    """
    Evaluates trusted device signal in [0.0, 1.0].
    Compatible with existing features.py signature while respecting Trust Passport lifecycle.
    """
    assessment = evaluate_device(device, is_new_device=is_new_device, baseline=baseline)
    return assessment.trusted_device_signal
