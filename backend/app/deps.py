from typing import Callable, Generator, Optional, Union

from fastapi import Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a transactional SQLAlchemy database session.
    Automatically closes session after request finishes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_role(x_role: Optional[str] = Header(default="analyst", alias="X-Role")) -> str:
    """
    Extracts the authenticated or context role from the 'X-Role' HTTP header.
    Defaults to 'analyst' for exploration and demo workflows.
    Supported standard roles: 'admin', 'analyst', 'investigator', 'finance', 'rider', 'system'.
    """
    if not x_role:
        return "analyst"
    return x_role.strip().lower()


def require_role(*allowed_roles: str) -> Callable[[str], str]:
    """
    FastAPI dependency factory enforcing Role-Based Access Control (RBAC).
    Usage:
        @router.get("/sensitive", dependencies=[Depends(require_role("admin", "investigator"))])
    """
    def _role_checker(role: str = Header(default="analyst", alias="X-Role")) -> str:
        current_role = (role or "analyst").strip().lower()
        # Admin always has superuser bypass
        if current_role == "admin":
            return current_role

        normalized_allowed = [r.strip().lower() for r in allowed_roles]
        if current_role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: role '{current_role}' lacks required permissions. Allowed: {list(allowed_roles)}",
            )
        return current_role

    return _role_checker


# ==============================================================================
# Field Masking Helpers (Stubs for privacy and role-based data projection)
# ==============================================================================

def mask_pii(value: Optional[str], role: str = "analyst") -> Optional[str]:
    """
    Masks Personally Identifiable Information (phone, full name, email)
    unless the caller holds privileged roles ('admin', 'compliance', 'investigator').
    Example: '+1 (555) 019-2834' -> '+1 (555) ***-**34'
    """
    if value is None:
        return None
    privileged_roles = {"admin", "compliance", "investigator"}
    if role.lower() in privileged_roles:
        return value
    if len(value) <= 4:
        return "****"
    return value[:4] + "*" * (len(value) - 6) + value[-2:]


def mask_financial(value: Union[str, float, None], role: str = "analyst") -> Union[str, float, None]:
    """
    Masks bank account numbers or financial details
    unless caller holds 'admin' or 'finance' role.
    """
    if value is None:
        return None
    privileged_roles = {"admin", "finance"}
    if role.lower() in privileged_roles:
        return value
    str_val = str(value)
    if len(str_val) <= 4:
        return "****"
    return "****-****-" + str_val[-4:]


def mask_device_id(device_identifier: Optional[str], role: str = "analyst") -> Optional[str]:
    """
    Masks raw device fingerprint / IMEI / MAC hash for privacy compliance.
    Only 'admin' and 'investigator' roles view raw hashes.
    """
    if device_identifier is None:
        return None
    privileged_roles = {"admin", "investigator", "system"}
    if role.lower() in privileged_roles:
        return device_identifier
    if len(device_identifier) <= 8:
        return "DEV-****"
    return f"{device_identifier[:4]}...{device_identifier[-4:]}"
