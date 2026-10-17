"""
TrustJuggler Data Retention & Purge Service.
Enforces storage limitation and purpose limitation by periodically purging
raw behavioral snapshots, session telemetry events, and expired face templates
while preserving immutable audit logs and long-term behavioral baseline summaries.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.models.entities import (
    AuditLog,
    BehaviorSnapshot,
    FaceTemplate,
    RiderBaseline,
    SessionEvent,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RetentionService:
    def purge_expired_data(
        self,
        db: Session,
        days: int = 90,
        actor: str = "admin",
        role: str = "admin",
    ) -> Dict[str, Any]:
        """
        Deletes granular telemetry rows older than N days:
        - behavior_snapshots: created_at < cutoff
        - session_events: created_at < cutoff
        - face_templates: retention_until < utcnow()
        Preserves:
        - aggregated features (rider_baselines)
        - audit logs (audit_logs)
        - cases & trust scores
        Records an audit log entry detailing the purge action and counts.
        """
        now = utcnow()
        cutoff = now - timedelta(days=days)

        # 1. Delete BehaviorSnapshots older than cutoff
        snapshots_to_delete = (
            db.query(BehaviorSnapshot).filter(BehaviorSnapshot.created_at < cutoff).all()
        )
        snapshots_count = len(snapshots_to_delete)
        for s in snapshots_to_delete:
            db.delete(s)

        # 2. Delete SessionEvents older than cutoff
        events_to_delete = db.query(SessionEvent).filter(SessionEvent.created_at < cutoff).all()
        events_count = len(events_to_delete)
        for e in events_to_delete:
            db.delete(e)

        # 3. Delete expired FaceTemplates (retention_until < now)
        faces_to_delete = (
            db.query(FaceTemplate)
            .filter(FaceTemplate.retention_until.isnot(None), FaceTemplate.retention_until < now)
            .all()
        )
        faces_count = len(faces_to_delete)
        for f in faces_to_delete:
            db.delete(f)

        db.flush()

        # 4. Count retained audit logs and aggregated baselines
        audit_logs_count = db.query(AuditLog).count()
        baselines_count = db.query(RiderBaseline).count()

        # 5. Record AuditLog entry for the retention purge
        purge_log = AuditLog(
            id=f"audit_purge_{int(now.timestamp())}",
            actor=actor,
            role=role,
            action="RETENTION_PURGE_EXECUTED",
            entity_type="retention",
            entity_id="retention_purge",
            detail=(
                f"Purged {snapshots_count} behavioral snapshots, {events_count} session events, "
                f"and {faces_count} face templates older than {days} days. "
                f"Retained {audit_logs_count} audit logs and {baselines_count} baselines."
            ),
            created_at=now,
        )
        db.add(purge_log)
        db.commit()

        return {
            "status": "success",
            "retention_days": days,
            "cutoff_date": cutoff.isoformat(),
            "snapshots_deleted": snapshots_count,
            "session_events_deleted": events_count,
            "face_templates_deleted": faces_count,
            "audit_logs_retained": audit_logs_count + 1,
            "baselines_retained": baselines_count,
        }


retention_service = RetentionService()
