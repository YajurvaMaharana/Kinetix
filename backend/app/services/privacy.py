import hashlib
import hmac
import os
import re
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.config import settings

# Strict IPv4 regex: matches standard dotted-quad IP addresses
IPV4_REGEX = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b"
)
# Token detection regex: exactly 16 hexadecimal characters
TOKEN_REGEX = re.compile(r"^[0-9a-fA-F]{16}$")

# Sensitive keys that must always be tokenized rather than stored in the clear
SENSITIVE_KEYS = {
    "ip",
    "ip_address",
    "client_ip",
    "raw_ip",
    "remote_addr",
    "device_id_hash",
    "fingerprint",
    "raw_fingerprint",
    "fingerprint_raw",
    "hardware_fingerprint",
}


def tokenize(value: Optional[str]) -> str:
    """
    Computes HMAC-SHA256 using TJ_PEPPER truncated to 16 hexadecimal characters.
    Applied at API edge to device fingerprints and network IPs before persistence.
    Raw identifiers are NEVER stored in the database or logged.
    """
    if not value:
        return ""
    val_str = str(value).strip()
    if not val_str:
        return ""
    # If already a 16-hex token, return as-is
    if is_token(val_str):
        return val_str
    pepper_bytes = settings.TJ_PEPPER.encode("utf-8")
    val_bytes = val_str.encode("utf-8")
    h = hmac.new(pepper_bytes, val_bytes, hashlib.sha256).hexdigest()
    return h[:16]


def is_token(value: str) -> bool:
    """Returns True if the string is already a 16-character HMAC token."""
    return bool(value and len(value) == 16 and TOKEN_REGEX.match(value))


def scrub_raw_pii_string(text: str) -> str:
    """
    Scans a string and replaces all raw IPv4 addresses with their HMAC token.
    Prevents leaking raw IP strings into serialized JSON payloads and audit details.
    """
    if not text:
        return text

    def _replace_ip(match: re.Match) -> str:
        raw_ip = match.group(0)
        # Avoid tokenizing version numbers like 2.4.0 or dates
        parts = raw_ip.split(".")
        if len(parts) == 4 and all(p.isdigit() and 0 <= int(p) <= 255 for p in parts):
            return tokenize(raw_ip)
        return raw_ip

    return IPV4_REGEX.sub(_replace_ip, text)


def scrub_raw_pii_dict(data: Any) -> Any:
    """
    Recursively scrubs raw network IPs and hardware fingerprints from dictionaries,
    lists, and JSON structures before database insertion.
    """
    if isinstance(data, dict):
        scrubbed: Dict[str, Any] = {}
        for k, v in data.items():
            k_lower = str(k).lower()
            if k_lower in SENSITIVE_KEYS and v is not None:
                # Tokenize sensitive IP or device fingerprint value
                val_str = str(v).strip()
                scrubbed[k] = tokenize(val_str)
            elif isinstance(v, (dict, list)):
                scrubbed[k] = scrub_raw_pii_dict(v)
            elif isinstance(v, str):
                scrubbed[k] = scrub_raw_pii_string(v)
            else:
                scrubbed[k] = v
        return scrubbed
    elif isinstance(data, list):
        return [scrub_raw_pii_dict(item) for item in data]
    elif isinstance(data, str):
        return scrub_raw_pii_string(data)
    return data


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
    return s[:3] + "*" * (len(s) - 5) + s[-2:]


def mask_pii_for_role(data: Dict[str, Any], role: str = "analyst") -> Dict[str, Any]:
    """
    Applies role-based masking to Personally Identifiable Information (names, phones)
    when accessed by non-admin roles (e.g., analyst, investigator).
    """
    role_norm = (role or "analyst").strip().lower()
    if role_norm in ("admin", "system"):
        return data

    masked = dict(data)
    if "display_name" in masked and masked["display_name"]:
        masked["display_name"] = mask_name(masked["display_name"])
    if "rider_name" in masked and masked["rider_name"]:
        masked["rider_name"] = mask_name(masked["rider_name"])
    if "phone_number" in masked and masked["phone_number"]:
        masked["phone_number"] = mask_phone(masked["phone_number"])
    if "rider_phone" in masked and masked["rider_phone"]:
        masked["rider_phone"] = mask_phone(masked["rider_phone"])

    return masked


def scan_db_for_raw_pii(db: Session) -> List[Dict[str, Any]]:
    """
    Startup and diagnostic self-check scanning all loaded SQLAlchemy database tables
    for unauthorized raw IP-like patterns or unhashed fingerprints.
    Returns a list of violations (empty list = zero PII detected).
    """
    violations: List[Dict[str, Any]] = []

    # Iterate over all entity tables
    from app.db.session import Base

    for mapper in Base.registry.mappers:
        model_cls = mapper.class_
        table_name = mapper.persist_selectable.name

        try:
            records = db.query(model_cls).limit(500).all()
        except Exception:
            continue

        for rec in records:
            rec_id = getattr(rec, "id", "unknown")
            for col in mapper.columns:
                col_name = col.name
                val = getattr(rec, col_name, None)
                if val is None or not isinstance(val, str):
                    continue

                # Check for raw IPv4 patterns
                ip_matches = IPV4_REGEX.findall(val)
                # Filter out model versions or harmless numbers
                valid_ips = [
                    ip
                    for ip in ip_matches
                    if all(p.isdigit() and 0 <= int(p) <= 255 for p in ip.split("."))
                    and not ip.startswith("0.0.")
                    and not ip.startswith("127.0.")
                ]
                if valid_ips:
                    violations.append(
                        {
                            "table": table_name,
                            "record_id": rec_id,
                            "column": col_name,
                            "type": "raw_ip",
                            "matches": valid_ips,
                        }
                    )

                # Check for unhashed device fingerprints in device/session tables
                if (
                    col_name in ("fingerprint", "raw_fingerprint")
                    and len(val) > 0
                    and not is_token(val)
                ):
                    violations.append(
                        {
                            "table": table_name,
                            "record_id": rec_id,
                            "column": col_name,
                            "type": "raw_fingerprint",
                            "value": val[:8] + "...",
                        }
                    )

    return violations


def scan_sqlite_file_for_pii(db_file_path: str) -> List[str]:
    """
    Scans a physical SQLite database file on disk for raw IPv4 address strings.
    Reads string chunks and validates that all network identities are tokenized.
    """
    if not os.path.exists(db_file_path):
        return []

    with open(db_file_path, "rb") as f:
        content = f.read()

    # Search for ascii string representations of IPv4 addresses
    text_content = content.decode("latin1", errors="ignore")
    matches = IPV4_REGEX.findall(text_content)

    # Filter out harmless strings like SQLite version "3.45.1" or local loopback
    real_ips = []
    for m in matches:
        parts = m.split(".")
        if len(parts) == 4 and all(p.isdigit() and 0 <= int(p) <= 255 for p in parts):
            # Ignore sqlite version numbers or timestamps
            if m.startswith("0.0.") or m.startswith("127.0."):
                continue
            real_ips.append(m)

    return list(set(real_ips))
