"""
TrustJuggler Device Trust Passport Service.
Manages persistent device passports, hardware attestation lifecycle,
sticky threat flags, network reputation scoring, and audit-logged trust transitions.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.entities import Device, DeviceRider
from app.scoring.device import evaluate_device
from app.services.audit_service import audit_service
from app.services.privacy import tokenize


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


SIMULATED_BLOCKLIST = {
    "198.51.100.254",
    "203.0.113.199",
    "192.0.2.200",
    "198.51.100.99",
}


def calculate_network_reputation(
    ip: Optional[str],
    asn_type: Optional[str] = None,
    dev_meta: Optional[Dict[str, Any]] = None,
) -> float:
    """
    Evaluates network reputation score in [0.0, 1.0] from ASN type,
    VPN/proxy heuristics, and simulated blocklist.
    """
    meta = dev_meta or {}
    raw_ip = str(ip or "").strip()
    clean_asn = str(asn_type or meta.get("asn_type") or "").strip().lower()

    if raw_ip in SIMULATED_BLOCKLIST:
        return 0.10

    if meta.get("vpn_detected") or meta.get("is_vpn") or clean_asn in ("vpn", "tor", "proxy"):
        return 0.30

    if clean_asn in ("datacenter", "hosting", "cloud"):
        return 0.35

    if clean_asn in ("mobile", "cellular"):
        return 0.98

    if clean_asn in ("residential", "broadband", "isp"):
        return 0.95

    return 1.0


class DeviceService:
    """
    Core service managing Device Trust Passports and lifecycle state transitions.
    """

    VALID_TRUST_LEVELS = {"new", "provisional", "trusted", "blocked"}

    def transition_trust_level(
        self,
        db: Session,
        device: Device,
        new_level: str,
        reason: str,
        actor: str = "system",
        role: str = "system",
    ) -> Device:
        """
        Executes a validated trust level state transition in one centralized place,
        generating an immutable audit log entry.
        Lifecycle: new -> provisional -> trusted -> blocked
        """
        normalized_level = new_level.strip().lower()
        if normalized_level not in self.VALID_TRUST_LEVELS:
            raise ValueError(
                f"Invalid trust level '{new_level}'. Must be one of {self.VALID_TRUST_LEVELS}"
            )

        old_level = device.trust_level
        if old_level == normalized_level:
            return device

        # Apply transition
        device.trust_level = normalized_level

        if normalized_level == "trusted":
            device.trust_rating = 1.0
        elif normalized_level == "provisional":
            device.trust_rating = max(0.5, device.trust_rating)
        elif normalized_level == "blocked":
            device.trust_rating = 0.0
            device.passport_score = 0.0

        detail_msg = f"{old_level} -> {normalized_level}: {reason}"
        audit_service.log(
            db=db,
            actor=actor,
            role=role,
            action="DEVICE_TRUST_TRANSITION",
            entity_type="device",
            entity_id=device.id,
            detail=detail_msg,
        )
        return device

    def upsert_passport(
        self,
        session_ctx_or_db: Any = None,
        session_ctx: Any = None,
        db: Optional[Session] = None,
        actor: str = "system",
        role: str = "system",
        **kwargs: Any,
    ) -> Device:
        """
        Upserts or registers a Device Trust Passport on every login or session event.
        - HMAC-SHA256 tokenizes device_id and fingerprint
        - Sticky once seen: is_emulator, is_rooted, mock_location_seen
        - Evaluates network reputation
        - Links DeviceRider relationship and tracks linked_rider_count
        - Calibrates passport_score (0-100)
        - Manages trust_level lifecycle: new -> provisional -> trusted -> blocked
        """
        resolved_db = db
        resolved_ctx = session_ctx

        if isinstance(session_ctx_or_db, Session):
            resolved_db = session_ctx_or_db
            resolved_ctx = session_ctx or kwargs.get("session_ctx", {})
        elif session_ctx_or_db is not None and resolved_ctx is None:
            resolved_ctx = session_ctx_or_db

        if resolved_ctx is None:
            resolved_ctx = kwargs.get("session_ctx", {})

        if resolved_db is None:
            if hasattr(resolved_ctx, "db"):
                resolved_db = resolved_ctx.db
            elif isinstance(resolved_ctx, dict) and "db" in resolved_ctx:
                resolved_db = resolved_ctx["db"]
            else:
                resolved_db = SessionLocal()

        db = resolved_db
        ctx = resolved_ctx

        req_dict: Dict[str, Any] = {}
        if hasattr(ctx, "model_dump"):
            req_dict = ctx.model_dump()
        elif isinstance(ctx, dict):
            req_dict = dict(ctx)
        elif hasattr(ctx, "__dict__"):
            req_dict = {k: v for k, v in vars(ctx).items() if not k.startswith("_")}

        # 1. Extract Hardware Attestation & Network Metadata
        rider_id = req_dict.get("rider_id")
        dev_info = req_dict.get("device_passport") or req_dict.get("device") or {}
        if hasattr(dev_info, "model_dump"):
            dev_info = dev_info.model_dump()

        raw_fingerprint = (
            dev_info.get("device_id_hash")
            or dev_info.get("fingerprint")
            or dev_info.get("device_id")
            or req_dict.get("raw_fingerprint")
            or req_dict.get("device_id")
            or (f"dev_default_{rider_id}" if rider_id else "dev_default_anon")
        )

        raw_ip = dev_info.get("ip_address") or req_dict.get("ip_address") or "192.0.2.1"
        asn_type = dev_info.get("asn_type") or req_dict.get("asn_type")

        # Incoming event flags
        event_is_emulator = bool(
            dev_info.get("is_emulator")
            or req_dict.get("is_emulator")
            or dev_info.get("is_emulator") in (1, "1", True)
        )
        event_is_rooted = bool(
            dev_info.get("is_rooted")
            or dev_info.get("rooted_or_jailbroken")
            or req_dict.get("is_rooted")
            or dev_info.get("is_rooted") in (1, "1", True)
        )
        event_mock_location = bool(
            dev_info.get("mock_location_detected")
            or dev_info.get("mock_location_seen")
            or req_dict.get("mock_location_detected")
            or req_dict.get("mock_location_seen")
        )

        otp_passed = bool(req_dict.get("otp_passed") or req_dict.get("challenge_passed"))
        selfie_passed = bool(req_dict.get("selfie_passed") or req_dict.get("liveness_passed"))

        # 2. Strict HMAC Tokenization at Edge
        tokenized_fp = tokenize(raw_fingerprint)
        device_id = f"dev_{tokenized_fp[:10]}"

        # 3. Network Reputation
        network_rep = calculate_network_reputation(raw_ip, asn_type=asn_type, dev_meta=dev_info)

        # 4. Find or Create Device Entity
        device = (
            db.query(Device)
            .filter((Device.id == device_id) | (Device.fingerprint == tokenized_fp))
            .first()
        )

        if not device:
            device = Device(
                id=device_id,
                fingerprint=tokenized_fp,
                model=dev_info.get("device_model") or dev_info.get("model") or "Smartphone",
                os_version=dev_info.get("os_version") or "Android 14",
                app_version=dev_info.get("app_version") or "2.4.1",
                is_emulator=event_is_emulator,
                is_rooted=event_is_rooted,
                mock_location_seen=event_mock_location,
                network_reputation=network_rep,
                passport_score=100.0,
                trust_level="new",
                streak_count=0,
                trust_rating=0.4 if (event_is_emulator or event_is_rooted) else 1.0,
                created_at=utcnow(),
                last_seen_at=utcnow(),
            )
            db.add(device)
            db.flush()
        else:
            device.last_seen_at = utcnow()
            # STICKY THREAT FLAGS: Once seen, never reverts to False!
            if event_is_emulator:
                device.is_emulator = True
            if event_is_rooted:
                device.is_rooted = True
            if event_mock_location:
                device.mock_location_seen = True

            # Update model/os if newer
            if dev_info.get("device_model") or dev_info.get("model"):
                device.model = dev_info.get("device_model") or dev_info.get("model")
            if dev_info.get("os_version"):
                device.os_version = dev_info.get("os_version")

            # Update network reputation (record worst seen or current)
            device.network_reputation = network_rep

        # 5. Device-Rider Association
        if rider_id:
            link = (
                db.query(DeviceRider)
                .filter(DeviceRider.device_id == device.id, DeviceRider.rider_id == rider_id)
                .first()
            )
            if not link:
                existing_primary = (
                    db.query(DeviceRider)
                    .filter(DeviceRider.rider_id == rider_id, DeviceRider.is_primary.is_(True))
                    .first()
                )
                link = DeviceRider(
                    id=f"dr_{uuid.uuid4().hex[:8]}",
                    device_id=device.id,
                    rider_id=rider_id,
                    is_primary=(existing_primary is None),
                    first_used_at=utcnow(),
                    last_used_at=utcnow(),
                )
                db.add(link)
                db.flush()
            else:
                link.last_used_at = utcnow()

        linked_count = db.query(DeviceRider).filter(DeviceRider.device_id == device.id).count()

        # 6. Trust Level Lifecycle Transitions
        # Transitions: new -> provisional (seen, no risk flags) -> trusted (OTP, selfie, or 3 consistent sessions) -> blocked
        has_risk_flags = bool(
            device.is_emulator
            or device.is_rooted
            or device.mock_location_seen
            or device.network_reputation < 0.70
            or linked_count >= 2
        )

        if device.trust_level != "blocked":
            if otp_passed or selfie_passed:
                reason = (
                    "Graduated via successful SMS OTP challenge"
                    if otp_passed
                    else "Graduated via successful facial liveness verification"
                )
                self.transition_trust_level(
                    db=db,
                    device=device,
                    new_level="trusted",
                    reason=reason,
                    actor=actor,
                    role=role,
                )
            elif device.trust_level == "new":
                if not has_risk_flags:
                    self.transition_trust_level(
                        db=db,
                        device=device,
                        new_level="provisional",
                        reason="First session clean with zero hardware/network risk flags",
                        actor=actor,
                        role=role,
                    )
                    # Count first session as clean streak 1
                    device.streak_count = 1
                else:
                    device.streak_count = 0

            elif device.trust_level == "provisional":
                if not has_risk_flags:
                    device.streak_count += 1
                    if device.streak_count >= 3:
                        self.transition_trust_level(
                            db=db,
                            device=device,
                            new_level="trusted",
                            reason="Graduated after 3 consecutive consistent clean sessions",
                            actor=actor,
                            role=role,
                        )
                else:
                    device.streak_count = 0

            elif device.trust_level == "trusted":
                if not has_risk_flags:
                    device.streak_count += 1
                else:
                    device.streak_count = 0

        # 7. Compute Final Device Risk and Passport Score (0-100)
        assessment = evaluate_device(
            {
                "is_emulator": device.is_emulator,
                "is_rooted": device.is_rooted,
                "mock_location_seen": device.mock_location_seen,
                "linked_rider_count": linked_count,
                "network_reputation": device.network_reputation,
                "trust_level": device.trust_level,
                "trust_rating": device.trust_rating,
            }
        )

        if device.trust_level == "blocked":
            device.passport_score = 0.0
            device.trust_rating = 0.0
        else:
            device.passport_score = assessment.passport_score
            device.trust_rating = round(max(0.0, 1.0 - assessment.device_risk), 2)

        db.flush()
        return device

    def block_device(
        self,
        db: Session,
        device_id: str,
        reason: str = "Blocked by security analyst",
        actor: str = "analyst",
        role: str = "analyst",
    ) -> Device:
        """Explicitly blocks a device by security analyst."""
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            device = db.query(Device).filter(Device.fingerprint == device_id).first()
        if not device:
            raise KeyError(f"Device '{device_id}' not found")

        return self.transition_trust_level(
            db=db,
            device=device,
            new_level="blocked",
            reason=reason,
            actor=actor,
            role=role,
        )


device_service = DeviceService()
