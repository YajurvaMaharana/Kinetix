from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    sessions: Mapped[List["Session"]] = relationship("Session", back_populates="rider")
    devices: Mapped[List["DeviceRider"]] = relationship("DeviceRider", back_populates="rider")
    baseline: Mapped[Optional["RiderBaseline"]] = relationship(
        "RiderBaseline", back_populates="rider", uselist=False
    )
    trust_score: Mapped[Optional["RiderTrustScore"]] = relationship(
        "RiderTrustScore", back_populates="rider", uselist=False
    )


class FaceTemplate(Base):
    __tablename__ = "face_templates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    rider_id: Mapped[str] = mapped_column(String(64), ForeignKey("riders.id"), nullable=False, index=True)
    template_version: Mapped[str] = mapped_column(String(32), default="v1", nullable=False)
    embedding_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    encrypted_embedding: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    os_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    app_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    is_emulator: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_rooted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    trust_rating: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    device_riders: Mapped[List["DeviceRider"]] = relationship("DeviceRider", back_populates="device")


class DeviceRider(Base):
    __tablename__ = "device_riders"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    device_id: Mapped[str] = mapped_column(String(64), ForeignKey("devices.id"), nullable=False, index=True)
    rider_id: Mapped[str] = mapped_column(String(64), ForeignKey("riders.id"), nullable=False, index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    first_used_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    last_used_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    device: Mapped["Device"] = relationship("Device", back_populates="device_riders")
    rider: Mapped["Rider"] = relationship("Rider", back_populates="devices")


class RiderBaseline(Base):
    __tablename__ = "rider_baselines"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    rider_id: Mapped[str] = mapped_column(String(64), ForeignKey("riders.id"), unique=True, nullable=False)
    avg_speed_kmh: Mapped[float] = mapped_column(Float, default=35.0, nullable=False)
    avg_cadence_cpm: Mapped[float] = mapped_column(Float, default=220.0, nullable=False)
    home_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    home_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    typical_hours: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    metrics_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profiles_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    rider: Mapped["Rider"] = relationship("Rider", back_populates="baseline")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    rider_id: Mapped[str] = mapped_column(String(64), ForeignKey("riders.id"), nullable=False, index=True)
    driver_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    device_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("devices.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="IN_PROGRESS", nullable=False)
    ip_address: Mapped[str] = mapped_column(String(64), nullable=False)
    current_risk_score: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    current_verdict: Mapped[str] = mapped_column(String(32), default="ALLOW", nullable=False)
    scenario_run_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    ground_truth_label: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
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


class SessionEvent(Base):
    __tablename__ = "session_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(String(64), ForeignKey("sessions.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    session: Mapped["Session"] = relationship("Session", back_populates="events")


class BehaviorSnapshot(Base):
    __tablename__ = "behavior_snapshots"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(String(64), ForeignKey("sessions.id"), nullable=False, index=True)
    speed_kmh: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    acceleration_variance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    gyro_stability: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    typing_cadence_cpm: Mapped[float] = mapped_column(Float, default=200.0, nullable=False)
    route_deviation_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(String(64), ForeignKey("sessions.id"), nullable=False, index=True)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    raw_risk: Mapped[float] = mapped_column(Float, nullable=False)
    verdict: Mapped[str] = mapped_column(String(32), nullable=False)
    risk_tier: Mapped[str] = mapped_column(String(32), nullable=False)
    classification: Mapped[Optional[str]] = mapped_column(String(64), default="normal", nullable=True)
    threat_tags_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    model_version: Mapped[str] = mapped_column(String(64), default="v2.0.0-rf-heuristic", nullable=False)
    policy_version: Mapped[str] = mapped_column(String(64), default="v2.4.0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    session: Mapped["Session"] = relationship("Session", back_populates="assessments")
    factors: Mapped[List["RiskFactor"]] = relationship("RiskFactor", back_populates="assessment")


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
    session_id: Mapped[str] = mapped_column(String(64), ForeignKey("sessions.id"), nullable=False, index=True)
    challenge_type: Mapped[str] = mapped_column(String(64), default="FACE_LIVENESS", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    session: Mapped["Session"] = relationship("Session", back_populates="challenges")
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
    rider_id: Mapped[str] = mapped_column(String(64), ForeignKey("riders.id"), nullable=False, index=True)
    account_number_token: Mapped[str] = mapped_column(String(64), nullable=False)
    routing_token: Mapped[str] = mapped_column(String(64), nullable=False)
    account_type: Mapped[str] = mapped_column(String(32), default="checking", nullable=False)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class PayoutRequest(Base):
    __tablename__ = "payout_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    payout_account_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("payout_accounts.id"), nullable=True
    )
    rider_id: Mapped[str] = mapped_column(String(64), ForeignKey("riders.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="USD", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="RELEASED", nullable=False)
    hold_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("sessions.id"), nullable=True, index=True
    )
    rider_id: Mapped[str] = mapped_column(String(64), ForeignKey("riders.id"), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(32), default="MEDIUM", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="OPEN", nullable=False)
    assigned_to: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    threat_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    actions: Mapped[List["ReviewerAction"]] = relationship("ReviewerAction", back_populates="case")


class ReviewerAction(Base):
    __tablename__ = "reviewer_actions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    case_id: Mapped[str] = mapped_column(String(64), ForeignKey("cases.id"), nullable=False, index=True)
    reviewer_id: Mapped[str] = mapped_column(String(64), nullable=False)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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


class RiderTrustScore(Base):
    __tablename__ = "rider_trust_scores"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    rider_id: Mapped[str] = mapped_column(String(64), ForeignKey("riders.id"), unique=True, nullable=False)
    trust_score: Mapped[float] = mapped_column(Float, default=90.0, nullable=False)
    trend: Mapped[str] = mapped_column(String(32), default="STABLE", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.9, nullable=False)
    last_calculated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    rider: Mapped["Rider"] = relationship("Rider", back_populates="trust_score")


class RiderTrustHistory(Base):
    __tablename__ = "rider_trust_history"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    rider_id: Mapped[str] = mapped_column(String(64), ForeignKey("riders.id"), nullable=False, index=True)
    trust_score: Mapped[float] = mapped_column(Float, nullable=False)
    delta: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


class Appeal(Base):
    __tablename__ = "appeals"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    case_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("cases.id"), nullable=True)
    rider_id: Mapped[str] = mapped_column(String(64), ForeignKey("riders.id"), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


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
