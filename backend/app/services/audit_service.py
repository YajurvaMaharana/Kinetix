import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.entities import AuditLog, utcnow


class AuditService:
    @staticmethod
    def log(
        db: Session,
        actor: str,
        role: str,
        action: str,
        entity_type: str,
        entity_id: str,
        detail: Optional[str] = None,
    ) -> AuditLog:
        """
        Records an immutable audit log entry in audit_logs.
        Called on every assessment, challenge, case action, and policy change.
        """
        entry = AuditLog(
            id=f"audit_{uuid.uuid4().hex[:12]}",
            actor=actor or "system",
            role=role or "system",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            detail=detail,
            created_at=utcnow(),
        )
        db.add(entry)
        db.commit()
        return entry


audit_service = AuditService()
