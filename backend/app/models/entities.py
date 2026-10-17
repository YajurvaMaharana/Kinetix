import json
from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Rider(Base):
    __tablename__ = "riders"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(64), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    consent_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    consent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    def __init__(self, **kwargs):
        if "consent_version" not in kwargs:
            kwargs["consent_version"] = "v1.0"
        if "consent_at" not in kwargs and kwargs.get("consent_version"):
            kwargs["consent_at"] = utcnow()
        super().__init__(**kwargs)

    # Relationships
    sessions: Mapped[List["Session"]] = relationship("Session", back_populates="rider")
    devices: Mapped[List["DeviceRider"]] = relationship("DeviceRider", back_populates="rider")
    baseline: Mapped[Optional["RiderBaseline"]] = relationship(
        "RiderBaseline", back_populates="rider", uselist=False
    )
    trust_score: Mapped[Optional["RiderTrustScore"]] = relationship(
        "RiderTrustScore", back_populates="rider", uselist=False
    )
    challenges: Mapped[List["Challenge"]] = relationship("Challenge", back_populates="rider")
    appeals: Mapped[List["Appeal"]] = relationship("Appeal", back_populates="rider")


class FaceTemplate(Base):
    __tablename__ = "face_templates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    rider_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("riders.id"), nullable=False, index=True
    )
    template_version: Mapped[str] = mapped_column(String(32), default="v1", nullable=False)
    model_name: Mapped[str] = mapped_column(String(64), default="simulated", nullable=False)
    embedding_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    encrypted_embedding: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retention_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    @property
    def template_encrypted(self) -> Optional[str]:
        return self.encrypted_embedding

    @template_encrypted.setter
    def template_encrypted(self, val: Optional[str]) -> None:
        self.encrypted_embedding = val


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    os_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    app_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    is_emulator: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_rooted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mock_location_seen: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    network_reputation: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    passport_score: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    trust_level: Mapped[str] = mapped_column(String(32), default="new", nullable=False)
    streak_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    trust_rating: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    trusted_via: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    device_riders: Mapped[List["DeviceRider"]] = relationship(
        "DeviceRider", back_populates="device"
    )

    @property
    def linked_rider_count(self) -> int:
        try:
            return len(self.device_riders) if self.device_riders is not None else 0
        except Exception:
            return 0

    @validates("fingerprint")
    def validate_fingerprint(self, key: str, value: Any) -> str:
        from app.services.privacy import is_token, tokenize

        val_str = str(value or "").strip()
        if val_str and not is_token(val_str):
            return tokenize(val_str)
        return val_str


class DeviceRider(Base):
    __tablename__ = "device_riders"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    device_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("devices.id"), nullable=False, index=True
    )
    rider_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("riders.id"), nullable=False, index=True
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    first_used_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    last_used_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    device: Mapped["Device"] = relationship("Device", back_populates="device_riders")
    rider: Mapped["Rider"] = relationship("Rider", back_populates="devices")


class RiderBaseline(Base):
    __tablename__ = "rider_baselines"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    rider_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("riders.id"), unique=True, nullable=False
    )
    avg_speed_kmh: Mapped[float] = mapped_column(Float, default=35.0, nullable=False)
    avg_cadence_cpm: Mapped[float] = mapped_column(Float, default=220.0, nullable=False)
    home_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    home_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    typical_hours: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    metrics_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profiles_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    adaptation_state_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    rider: Mapped["Rider"] = relationship("Rider", back_populates="baseline")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    rider_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("riders.id"), nullable=False, index=True
    )
    driver_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    device_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("devices.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(32), default="IN_PROGRESS", nullable=False)
    ip_address: Mapped[str] = mapped_column(String(64), nullable=False)
    current_risk_score: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    current_verdict: Mapped[str] = mapped_column(String(32), default="ALLOW", nullable=False)
    scenario_run_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    ground_truth_label: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    raw_context_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    rider: Mapped["Rider"] = relationship("Rider", back_populates="sessions")
    events: Mapped[List["SessionEvent"]] = relationship("SessionEvent", back_populates="session")
    assessments: Mapped[List["RiskAssessment"]] = relationship(
        "RiskAssessment", back_populates="session"
    )
    challenges: Mapped[List["Challenge"]] = relationship("Challenge", back_populates="session")

    @validates("ip_address")
    def validate_ip_address(self, key: str, value: Any) -> str:
        from app.services.privacy import IPV4_REGEX, tokenize

        val_str = str(value or "").strip()
        if val_str and IPV4_REGEX.match(val_str):
            return tokenize(val_str)
        return val_str

    @validates("raw_context_json")
    def validate_raw_context(self, key: str, value: Any) -> Optional[str]:
        if value:
            from app.services.privacy import scrub_raw_pii_string

            return scrub_raw_pii_string(str(value))
        return value


class SessionEvent(Base):
    __tablename__ = "session_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("sessions.id"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    session: Mapped["Session"] = relationship("Session", back_populates="events")

    @validates("payload_json")
    def validate_payload_json(self, key: str, value: Any) -> str:
        if value:
            from app.services.privacy import scrub_raw_pii_string

            return scrub_raw_pii_string(str(value))
        return str(value) if value else "{}"


class BehaviorSnapshot(Base):
    __tablename__ = "behavior_snapshots"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("sessions.id"), nullable=False, index=True
    )
    speed_kmh: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    acceleration_variance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    gyro_stability: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    typing_cadence_cpm: Mapped[float] = mapped_column(Float, default=200.0, nullable=False)
    route_deviation_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("sessions.id"), nullable=False, index=True
    )
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    raw_risk: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    verdict: Mapped[str] = mapped_column(String(32), nullable=False)
    risk_tier: Mapped[str] = mapped_column(String(32), nullable=False)
    classification: Mapped[Optional[str]] = mapped_column(
        String(64), default="normal", nullable=True
    )
    threat_tags_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    model_version: Mapped[str] = mapped_column(
        String(64), default="v2.0.0-rf-heuristic", nullable=False
    )
    policy_version: Mapped[str] = mapped_column(String(64), default="v2.4.0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    session: Mapped["Session"] = relationship("Session", back_populates="assessments")
    factors: Mapped[List["RiskFactor"]] = relationship("RiskFactor", back_populates="assessment")

    @property
    def threat_tags(self) -> List[str]:
        if not self.threat_tags_json:
            return []
        try:
            data = json.loads(self.threat_tags_json)
            if isinstance(data, str) and data.startswith("[") and data.endswith("]"):
                data = json.loads(data)
            if isinstance(data, list):
                res: List[str] = []
                for item in data:
                    s = str(item).strip("[]'\"")
                    if s:
                        res.append(s)
                return res
            return [str(data).strip("[]'\"")]
        except Exception:
            return [self.threat_tags_json.strip("[]'\"")]

    @threat_tags.setter
    def threat_tags(self, val: Any) -> None:
        if isinstance(val, list):
            self.threat_tags_json = json.dumps(val)
        elif val is None:
            self.threat_tags_json = None
        else:
            self.threat_tags_json = json.dumps([str(val)])


class RiskFactor(Base):
    __tablename__ = "risk_factors"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    assessment_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("risk_assessments.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    impact: Mapped[str] = mapped_column(String(32), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    assessment: Mapped["RiskAssessment"] = relationship("RiskAssessment", back_populates="factors")


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("sessions.id"), nullable=False, index=True
    )
    rider_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("riders.id"), nullable=True, index=True
    )
    challenge_type: Mapped[str] = mapped_column(String(64), default="FACE_LIVENESS", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    reason_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    cooldown_key: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    session: Mapped["Session"] = relationship("Session", back_populates="challenges")
    rider: Mapped[Optional["Rider"]] = relationship("Rider", back_populates="challenges")
    liveness_checks: Mapped[List["LivenessCheck"]] = relationship(
        "LivenessCheck", back_populates="challenge"
    )


class LivenessCheck(Base):
    __tablename__ = "liveness_checks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    challenge_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("challenges.id"), nullable=False, index=True
    )
    liveness_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    spoof_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    prompt_results: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    challenge: Mapped["Challenge"] = relationship("Challenge", back_populates="liveness_checks")


class GraphEdge(Base):
    __tablename__ = "graph_edges"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    edge_type: Mapped[str] = mapped_column(String(64), nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class FraudCluster(Base):
    __tablename__ = "fraud_clusters"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    nodes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    shared_identifiers: Mapped[str] = mapped_column(Text, nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class PayoutAccount(Base):
    __tablename__ = "payout_accounts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    rider_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("riders.id"), nullable=False, index=True
    )
    account_number_token: Mapped[str] = mapped_column(String(64), nullable=False)
    routing_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    account_type: Mapped[str] = mapped_column(String(32), default="checking", nullable=False)
    set_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    @property
    def account_token(self) -> str:
        return self.account_number_token

    @account_token.setter
    def account_token(self, val: str) -> None:
        self.account_number_token = val


class PayoutRequest(Base):
    __tablename__ = "payout_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    payout_account_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("payout_accounts.id"), nullable=True
    )
    rider_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("riders.id"), nullable=False, index=True
    )
    session_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("sessions.id"), nullable=True, index=True
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="USD", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="RELEASED", nullable=False)
    risk_at_request: Mapped[Optional[float]] = mapped_column(Float, default=0.0, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    hold_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    release_requires: Mapped[Optional[str]] = mapped_column(
        String(128), default="none", nullable=True
    )
    challenge_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    liveness_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    analyst_approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    analyst_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    payout_account: Mapped[Optional["PayoutAccount"]] = relationship("PayoutAccount")
    rider: Mapped["Rider"] = relationship("Rider")


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("sessions.id"), nullable=True, index=True
    )
    rider_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("riders.id"), nullable=False, index=True
    )
    severity: Mapped[str] = mapped_column(String(32), default="MEDIUM", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="OPEN", nullable=False)
    assigned_to: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    threat_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    threat_tag: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    risk_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    actions: Mapped[List["ReviewerAction"]] = relationship(
        "ReviewerAction", back_populates="case", cascade="all, delete-orphan"
    )
    appeals: Mapped[List["Appeal"]] = relationship("Appeal", back_populates="case")
    rider: Mapped["Rider"] = relationship("Rider")
    session: Mapped[Optional["Session"]] = relationship("Session")


class ReviewerAction(Base):
    __tablename__ = "reviewer_actions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    case_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("cases.id"), nullable=False, index=True
    )
    reviewer_id: Mapped[str] = mapped_column(String(64), nullable=False)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assessment_risk: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    classification_snapshot: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    threat_tag: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    case: Mapped["Case"] = relationship("Case", back_populates="actions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    actor: Mapped[str] = mapped_column(String(64), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    @validates("detail")
    def validate_detail(self, key: str, value: Any) -> Optional[str]:
        if value:
            from app.services.privacy import scrub_raw_pii_string

            return scrub_raw_pii_string(str(value))
        return value


class RiderTrustScore(Base):
    __tablename__ = "rider_trust_scores"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    rider_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("riders.id"), unique=True, nullable=False
    )
    trust_score: Mapped[float] = mapped_column(Float, default=90.0, nullable=False)
    trend: Mapped[str] = mapped_column(String(32), default="STABLE", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.9, nullable=False)
    last_calculated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    rider: Mapped["Rider"] = relationship("Rider", back_populates="trust_score")


class RiderTrustHistory(Base):
    __tablename__ = "rider_trust_history"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    rider_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("riders.id"), nullable=False, index=True
    )
    trust_score: Mapped[float] = mapped_column(Float, nullable=False)
    delta: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Appeal(Base):
    __tablename__ = "appeals"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    case_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("cases.id"), nullable=True, index=True
    )
    rider_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("riders.id"), nullable=False, index=True
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    supporting_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    reviewer_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    reviewer_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    rider: Mapped["Rider"] = relationship("Rider", back_populates="appeals")
    case: Mapped[Optional["Case"]] = relationship("Case", back_populates="appeals")


class PolicyConfig(Base):
    __tablename__ = "policy_configs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    version: Mapped[str] = mapped_column(String(32), default="v2.4.0", nullable=False)
    allow_threshold: Mapped[float] = mapped_column(Float, default=20.0, nullable=False)
    monitor_threshold: Mapped[float] = mapped_column(Float, default=30.0, nullable=False)
    challenge_threshold: Mapped[float] = mapped_column(Float, default=60.0, nullable=False)
    escalate_threshold: Mapped[float] = mapped_column(Float, default=80.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class ScenarioRun(Base):
    __tablename__ = "scenario_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    scenario_name: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="COMPLETED", nullable=False)
    result_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
