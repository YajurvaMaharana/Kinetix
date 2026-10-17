import hashlib
import hmac
from typing import Optional

from app.config import settings


def tokenize(value: Optional[str]) -> str:
    """
    Computes HMAC-SHA256 using TJ_PEPPER truncated to 16 hexadecimal characters.
    Applied at API edge to device fingerprints and network IPs before persistence.
    Raw identifiers are NEVER stored in the database or logged.
    """
    if not value:
        return ""
    pepper_bytes = settings.TJ_PEPPER.encode("utf-8")
    val_bytes = str(value).strip().encode("utf-8")
    h = hmac.new(pepper_bytes, val_bytes, hashlib.sha256).hexdigest()
    return h[:16]


def mask_name(name: Optional[str]) -> Optional[str]:
    """
    Masks user display name for role=analyst.
    Example: 'Jane Doe' -> 'J*** D***'
    """
    if not name:
        return name
    parts = name.strip().split()
    masked_parts = []
    for part in parts:
        if len(part) <= 1:
            masked_parts.append(part)
        elif len(part) == 2:
            masked_parts.append(part[0] + "*")
        else:
            masked_parts.append(part[0] + "*" * (len(part) - 1))
    return " ".join(masked_parts)


def mask_phone(phone: Optional[str]) -> Optional[str]:
    """
    Masks phone numbers for role=analyst.
    Example: '+1-555-0199' -> '+1-***-**99'
    """
    if not phone:
        return phone
    s = phone.strip()
    if len(s) <= 4:
        return "****"
    # Keep prefix and last 2 digits
    return s[:3] + "*" * (len(s) - 5) + s[-2:]
