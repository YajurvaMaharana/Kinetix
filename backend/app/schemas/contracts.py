from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ------------------------------------------------------------------------------
# Factor & Assessment Schemas
# ------------------------------------------------------------------------------
class FactorSchema(BaseModel):
    name: str
    category: str
    impact: str
    weight: float
    score: float
    description: str


class ChallengeSchema(BaseModel):
    challenge_id: str
    session_id: str
    challenge_type: str = "FACE_LIVENESS"
    status: str = "PENDING"
    expires_at: str
    created_at: str


class AssessmentSchema(BaseModel):
    assessment_id: str
    session_id: str
    rider_id: str
    risk_score: float
    raw_risk: float
    trust_score: float = Field(description="100 - risk_score")
    verdict: str  # ALLOW, MONITOR, CHALLENGE, ESCALATE
    risk_tier: str  # LOW, MEDIUM, HIGH, CRITICAL
    factors: List[FactorSchema] = Field(default_factory=list)
    threat_tags: List[str] = Field(default_factory=list)
    challenge: Optional[ChallengeSchema] = None
    case_id: Optional[str] = None
    latency_ms: float = 0.0
    evaluated_at: str
    change_type: Optional[str] = None
    adaptation_progress: Optional[str] = None


class InvestigationPayload(BaseModel):
    session_id: str
    rider_id: str
    verdict: str
    risk_score: float
    threat_tags: List[str] = Field(default_factory=list)
    change_type: Optional[str] = None
    adaptation_progress: Optional[str] = None
    adaptation_state: Optional[Dict[str, Any]] = None
    is_blocked: bool = False
    block_reason: Optional[str] = None
    factors: List[FactorSchema] = Field(default_factory=list)
    mitigating_factors: List[FactorSchema] = Field(default_factory=list)
    generated_at: str


# ------------------------------------------------------------------------------
# Session Schemas
# ------------------------------------------------------------------------------
class DevicePassportInput(BaseModel):
    device_id_hash: Optional[str] = None
    fingerprint: Optional[str] = None
    device_model: Optional[str] = None
    model: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    ip_address: Optional[str] = None
    vpn_detected: bool = False
    mock_location_detected: bool = False
    rooted_or_jailbroken: bool = False
    is_emulator: bool = False
    is_rooted: bool = False

    model_config = ConfigDict(extra="ignore")


class SessionCreateRequest(BaseModel):
    session_id: Optional[str] = None
    rider_id: str
    driver_id: Optional[str] = None
    device_passport: Optional[DevicePassportInput] = None
    device: Optional[DevicePassportInput] = None
    biometrics: Optional[Dict[str, Any]] = None
    telemetry: Optional[Dict[str, Any]] = None
    location: Optional[Dict[str, Any]] = None
    financial: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class SessionEventRequest(BaseModel):
    event_type: str = Field(
        ...,
        description="Event type: location_ping, trip_accepted, trip_completed, screen_nav, telemetry",
    )
    payload: Dict[str, Any] = Field(default_factory=dict)


class SessionResponse(BaseModel):
    id: str
    session_id: str
    rider_id: str
    driver_id: Optional[str] = None
    device_id: Optional[str] = None
    status: str
    ip_address: str  # Tokenized HMAC!
    current_risk_score: float
    current_verdict: str
    created_at: str
    updated_at: str
    latest_assessment: Optional[AssessmentSchema] = None


# ------------------------------------------------------------------------------
# Challenge Schemas
# ------------------------------------------------------------------------------
class ChallengeRespondRequest(BaseModel):
    passed: bool = True
    liveness_score: float = 0.95
    confidence: float = 0.92
    proof_payload: Optional[Dict[str, Any]] = None


class ChallengeResponse(BaseModel):
    challenge_id: str
    session_id: str
    challenge_type: str
    status: str
    resolved_at: Optional[str] = None
    verified: bool
    new_verdict: str
    message: str


# ------------------------------------------------------------------------------
# Rider Schemas
# ------------------------------------------------------------------------------
class RiderResponse(BaseModel):
    id: str
    display_name: str
    phone_number: str
    email: Optional[str] = None
    status: str
    trust_score: Optional[float] = None
    created_at: str
    updated_at: str


class TimelineItem(BaseModel):
    timestamp: str
    type: str
    summary: str
    details: Dict[str, Any] = Field(default_factory=dict)


class TimelineResponse(BaseModel):
    entity_id: str
    entity_type: str
    events_count: int
    timeline: List[TimelineItem]


# ------------------------------------------------------------------------------
# Device Schemas
# ------------------------------------------------------------------------------
class DeviceResponse(BaseModel):
    id: str
    fingerprint: str  # Tokenized
    model: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    is_emulator: bool
    is_rooted: bool
    trust_rating: float
    created_at: str
    last_seen_at: str


class DevicePassportResponse(BaseModel):
    device_id: str
    tokenized_fingerprint: str
    trust_rating: float
    is_emulator: bool
    is_rooted: bool
    associated_riders_count: int
    first_seen: str
    last_seen: str


# ------------------------------------------------------------------------------
# Case Schemas
# ------------------------------------------------------------------------------
class CasePatchRequest(BaseModel):
    status: Optional[str] = None  # OPEN, IN_REVIEW, RESOLVED_LEGIT, CONFIRMED_FRAUD
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class CaseResponse(BaseModel):
    id: str
    case_id: str
    session_id: Optional[str] = None
    rider_id: str
    severity: str
    status: str
    assigned_to: Optional[str] = None
    threat_summary: Optional[str] = None
    notes: Optional[str] = None
    change_type: Optional[str] = None
    adaptation_progress: Optional[str] = None
    created_at: str
    updated_at: str


# ------------------------------------------------------------------------------
# Audit & Metrics Schemas
# ------------------------------------------------------------------------------
class AuditLogResponse(BaseModel):
    id: str
    actor: str
    role: str
    action: str
    entity_type: str
    entity_id: str
    detail: Optional[str] = None
    created_at: str


class MetricsSummaryResponse(BaseModel):
    total_sessions: int
    active_sessions: int
    total_challenges: int
    open_cases: int
    avg_latency_ms: float
    health_status: str
