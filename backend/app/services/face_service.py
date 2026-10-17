"""
Face Verification and Liveness Service for TrustJuggler v2.
Implements swappable face verification backends, Fernet-encrypted template storage,
liveness prompt generation, 1:1 biometric matching, pass/fail cascades, and fallbacks.

Key Architectures:
- Interfaces: FaceVerifier (.embed, .similarity), LivenessChecker (.check)
- SimulatedFaceVerifier: Deterministic synthetic embeddings, calibrated similarities:
  - genuine_face: ~0.80 - 0.92
  - different_person: ~0.15 - 0.45
  - static_photo & replay: fail liveness with spoof_type flag
- RealFaceVerifier: Documented stub for DeepFace / InsightFace behind FACE_BACKEND=real
- Privacy & Encryption: Fernet-encrypted vectors, SHA-256 embedding hashes.
  NEVER persist raw images (embed in memory and discard). raw_image_stored: false.
- Match Policy: Strictly 1:1 against enrolled rider template. Threshold = 0.70.
"""

import base64
import hashlib
import json
import math
import random
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from cryptography.fernet import Fernet
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.entities import (
    Case,
    Challenge,
    Device,
    DeviceRider,
    FaceTemplate,
    LivenessCheck,
    Rider,
    RiderBaseline,
    RiderTrustHistory,
    RiderTrustScore,
)
from app.models.entities import (
    Session as SessionModel,
)
from app.schemas.contracts import (
    ChallengeFallbackResponse,
    FaceEnrollResponse,
    FaceVerifyResponse,
    LivenessPromptResponse,
)
from app.services.audit_service import audit_service


def utcnow() -> datetime:
    """Returns naive UTC datetime matching DB standard."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_fernet_cipher() -> Fernet:
    """
    Instantiates Fernet cipher using TJ_FERNET_KEY from application settings.
    Guarantees valid 32-byte urlsafe base64 key.
    """
    key = settings.TJ_FERNET_KEY
    if not key:
        key = Fernet.generate_key().decode("utf-8")
    elif isinstance(key, str):
        key_bytes = key.encode("utf-8")
        try:
            return Fernet(key_bytes)
        except Exception:
            # Fallback for padded 32-byte key
            padded = base64.urlsafe_b64encode(hashlib.sha256(key_bytes).digest())
            return Fernet(padded)
    return Fernet(key)


def encrypt_vector(vector: List[float]) -> str:
    """Fernet encrypts a biometric float vector into a secure token."""
    cipher = get_fernet_cipher()
    payload = json.dumps([round(float(x), 6) for x in vector]).encode("utf-8")
    token = cipher.encrypt(payload)
    return token.decode("utf-8")


def decrypt_vector(token: str) -> List[float]:
    """Fernet decrypts a secure token back into a biometric float vector."""
    cipher = get_fernet_cipher()
    raw = cipher.decrypt(token.encode("utf-8"))
    data = json.loads(raw.decode("utf-8"))
    return [float(x) for x in data]


# ------------------------------------------------------------------------------
# 1. Swappable Interfaces
# ------------------------------------------------------------------------------
class FaceVerifier(ABC):
    """Abstract interface for biometric face embedding and similarity scoring."""

    @abstractmethod
    def embed(self, image_or_sim: Any, rider_id: Optional[str] = None) -> List[float]:
        """Extracts a 128-dimensional unit normalized facial embedding."""
        pass

    @abstractmethod
    def similarity(self, a: List[float], b: List[float]) -> float:
        """Computes cosine similarity between two 128D embeddings in [0.0, 1.0]."""
        pass


class LivenessChecker(ABC):
    """Abstract interface for 3D interactive and passive liveness verification."""

    @abstractmethod
    def generate_prompt(self, challenge_id: str) -> Dict[str, Any]:
        """Generates a random challenge prompt with nonce."""
        pass

    @abstractmethod
    def check(self, input_data: Any) -> Dict[str, Any]:
        """Evaluates liveness signatures and detects presentation attack spoofs."""
        pass


# ------------------------------------------------------------------------------
# 2. Simulated Face Verification & Liveness (Default)
# ------------------------------------------------------------------------------
class SimulatedFaceVerifier(FaceVerifier):
    """
    Deterministic synthetic face verifier.
    - Uses rider_id seed to construct reproducible 128D base templates
    - Produces calibrated cosine similarities:
        - genuine_face:     0.80 - 0.92 (mean ~0.88)
        - different_person: 0.15 - 0.45 (mean ~0.25)
    """

    DIMENSIONS = 128

    def _generate_deterministic_vector(self, seed_str: str) -> List[float]:
        """Generates a deterministic 128D unit-normalized vector."""
        h = hashlib.sha256(seed_str.encode("utf-8")).digest()
        seed_int = int.from_bytes(h[:8], "big")
        rng = random.Random(seed_int)
        raw = [rng.gauss(0.0, 1.0) for _ in range(self.DIMENSIONS)]
        norm = math.sqrt(sum(x * x for x in raw)) or 1.0
        return [round(x / norm, 6) for x in raw]

    def _generate_orthogonal_vector(self, base_vec: List[float], seed_str: str) -> List[float]:
        """Generates a deterministic unit vector orthogonal to base_vec."""
        v = self._generate_deterministic_vector(f"ortho_{seed_str}")
        dot = sum(a * b for a, b in zip(base_vec, v, strict=False))
        proj = [x - dot * b for x, b in zip(v, base_vec, strict=False)]
        norm = math.sqrt(sum(x * x for x in proj)) or 1.0
        return [round(x / norm, 6) for x in proj]

    def get_rider_base_template(self, rider_id: str) -> List[float]:
        """Generates the canonical base template for a given rider."""
        return self._generate_deterministic_vector(f"rider_face_base_{rider_id}")

    def embed(
        self,
        image_or_sim: Any,
        rider_id: Optional[str] = None,
        scenario_flag: Optional[str] = None,
    ) -> List[float]:
        """
        Embeds an input into a 128D vector.
        Accepts explicit lists, dicts with scenario flags, raw base64 images, or rider identifiers.
        """
        if isinstance(image_or_sim, list) and len(image_or_sim) >= 16:
            norm = math.sqrt(sum(float(x) * float(x) for x in image_or_sim)) or 1.0
            return [round(float(x) / norm, 6) for x in image_or_sim]

        target_rider = rider_id
        scenario = scenario_flag

        if isinstance(image_or_sim, dict):
            if image_or_sim.get("embedding"):
                return self.embed(image_or_sim["embedding"], rider_id=target_rider)
            scenario = scenario or image_or_sim.get("scenario") or image_or_sim.get("scenario_flag")
            if image_or_sim.get("rider_id"):
                target_rider = str(image_or_sim["rider_id"])
        elif isinstance(image_or_sim, str):
            if image_or_sim in ("genuine_face", "different_person", "static_photo", "replay_attack", "replay"):
                scenario = scenario or image_or_sim
            else:
                if not target_rider:
                    target_rider = image_or_sim

        target_rider = target_rider or "rider_default"
        base_t = self.get_rider_base_template(target_rider)

        if scenario is None:
            return base_t

        ortho = self._generate_orthogonal_vector(base_t, target_rider)

        if scenario == "different_person":
            # Calibrated target similarity: ~0.25 (range 0.15 - 0.45)
            alpha = 0.25
            beta = math.sqrt(max(0.0, 1.0 - alpha * alpha))
            blended = [alpha * t + beta * o for t, o in zip(base_t, ortho, strict=False)]
            norm = math.sqrt(sum(x * x for x in blended)) or 1.0
            return [round(x / norm, 6) for x in blended]

        elif scenario in ("genuine_face", "genuine"):
            # Calibrated target similarity: ~0.88 (range 0.80 - 0.92)
            alpha = 0.88
            beta = math.sqrt(max(0.0, 1.0 - alpha * alpha))
            blended = [alpha * t + beta * o for t, o in zip(base_t, ortho, strict=False)]
            norm = math.sqrt(sum(x * x for x in blended)) or 1.0
            return [round(x / norm, 6) for x in blended]

        # For static photo or replay attacks without person switch, match genuine face structure
        alpha = 0.88
        beta = math.sqrt(max(0.0, 1.0 - alpha * alpha))
        blended = [alpha * t + beta * o for t, o in zip(base_t, ortho, strict=False)]
        norm = math.sqrt(sum(x * x for x in blended)) or 1.0
        return [round(x / norm, 6) for x in blended]

    def similarity(self, a: List[float], b: List[float]) -> float:
        """Computes cosine similarity between two vectors, clamped to [0.0, 1.0]."""
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b, strict=False))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(y * y for y in b))
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        cos = dot / (norm_a * norm_b)
        return round(float(max(0.0, min(1.0, cos))), 4)


class SimulatedLivenessChecker(LivenessChecker):
    """
    Simulated 3D Interactive Liveness Checker.
    - Generates dynamic micro-action prompts (blink, turn head left/right, smile) with nonces
    - Evaluates presentation attacks:
        - static_photo: fails liveness (spoof_type='static_photo', score=0.15)
        - replay_attack: fails liveness (spoof_type='replay_attack', score=0.20)
        - genuine_face & different_person: pass liveness (score >= 0.90)
    """

    PROMPT_ACTIONS = ["blink", "turn_head_left", "turn_head_right", "smile"]

    def generate_prompt(self, challenge_id: str) -> Dict[str, Any]:
        """Generates dynamic action prompt and nonce."""
        h = int(hashlib.sha256(challenge_id.encode("utf-8")).hexdigest()[:6], 16)
        action = self.PROMPT_ACTIONS[h % len(self.PROMPT_ACTIONS)]
        nonce = uuid.uuid4().hex[:8]
        expires_at = (utcnow() + timedelta(minutes=5)).isoformat()
        return {
            "challenge_id": challenge_id,
            "prompt": action,
            "nonce": nonce,
            "expires_at": expires_at,
        }

    def check(self, input_data: Any, prompt_nonce: Optional[str] = None) -> Dict[str, Any]:
        """Evaluates simulated presentation attack signals."""
        data: Dict[str, Any] = {}
        if isinstance(input_data, str):
            data = {"scenario": input_data}
        elif isinstance(input_data, dict):
            data = dict(input_data)
        elif hasattr(input_data, "model_dump"):
            data = input_data.model_dump()

        scenario = str(data.get("scenario") or data.get("scenario_flag") or "").lower()
        spoof_type = data.get("spoof_type")

        # 1. Static 2D Photo Attack
        if scenario in ("static_photo", "photo", "paper_photo", "printed_photo") or spoof_type in (
            "static_photo",
            "photo",
        ):
            return {
                "passed": False,
                "spoof_type": "static_photo",
                "liveness_score": 0.15,
                "prompt_results": {
                    "motion_vectors": 0.02,
                    "depth_variance": 0.08,
                    "texture_reflection": "diffuse_flat",
                    "action_detected": False,
                },
            }

        # 2. Digital Screen Replay Attack
        if (
            scenario in ("replay", "replay_attack", "video_replay", "screen_replay")
            or spoof_type in ("replay", "replay_attack")
        ):
            return {
                "passed": False,
                "spoof_type": "replay_attack",
                "liveness_score": 0.20,
                "prompt_results": {
                    "moire_frequency_peak": 0.85,
                    "bezel_reflection_detected": True,
                    "temporal_jitter_ms": 115.0,
                    "action_detected": True,
                },
            }

        # 3. Explicit low liveness passed via proof
        if "liveness_score" in data and data["liveness_score"] is not None:
            score = float(data["liveness_score"])
            if score < 0.70:
                return {
                    "passed": False,
                    "spoof_type": spoof_type or "inconclusive_liveness",
                    "liveness_score": score,
                    "prompt_results": {"confidence": score},
                }

        # 4. Genuine Living Subject (Genuine Face or Imposter in-person)
        return {
            "passed": True,
            "spoof_type": None,
            "liveness_score": 0.95,
            "prompt_results": {
                "3d_depth_verified": True,
                "pupil_dilation_ok": True,
                "action_latency_ms": 320,
                "motion_smoothness": 0.94,
            },
        }


# ------------------------------------------------------------------------------
# 3. Real Face Verifier Stub (DeepFace / InsightFace Optional Integration)
# ------------------------------------------------------------------------------
class RealFaceVerifier(FaceVerifier):
    """
    Production face verification stub for DeepFace / InsightFace backends.
    Active when settings.FACE_BACKEND == "real".
    Requires optional dependencies from requirements-face.txt.
    """

    def __init__(self, backend_engine: str = "deepface"):
        self.backend_engine = backend_engine
        self._check_dependencies()

    def _check_dependencies(self) -> None:
        try:
            if self.backend_engine == "deepface":
                import deepface  # noqa: F401
            elif self.backend_engine == "insightface":
                import insightface  # noqa: F401
        except ImportError as exc:
            raise RuntimeError(
                f"FACE_BACKEND='real' ({self.backend_engine}) requires '{self.backend_engine}' installed. "
                "Install optional face verification dependencies: pip install -r requirements-face.txt "
                "or fallback to FACE_BACKEND='simulated' for zero-dependency operation."
            ) from exc

    def embed(self, image_or_sim: Any, rider_id: Optional[str] = None) -> List[float]:
        raise NotImplementedError("Real face verification embedding requires installed deepface model weights.")

    def similarity(self, a: List[float], b: List[float]) -> float:
        raise NotImplementedError("Real face verification similarity requires calibrated distance thresholds.")


# ------------------------------------------------------------------------------
# 4. Core Face Service
# ------------------------------------------------------------------------------
class FaceService:
    """
    High-level facade orchestrating face enrollment, Fernet encryption,
    1:1 verification challenges, pass restoration, and audit logging.
    """

    MATCH_THRESHOLD: float = 0.70  # Calibrated for SimulatedFaceVerifier

    def __init__(self):
        backend_name = (settings.FACE_BACKEND or "simulated").strip().lower()
        if backend_name == "real":
            try:
                self.verifier: FaceVerifier = RealFaceVerifier()
            except Exception:
                self.verifier = SimulatedFaceVerifier()
        else:
            self.verifier = SimulatedFaceVerifier()
        self.liveness: LivenessChecker = SimulatedLivenessChecker()

    @staticmethod
    def decrypt_embedding(token: str) -> List[float]:
        return decrypt_vector(token)

    def enroll(
        self,
        db: Session,
        rider_id: str,
        embedding: Optional[List[float]] = None,
        image_base64: Optional[str] = None,
        model_name: str = "simulated",
        retention_days: int = 365,
        actor: str = "system",
        role: str = "rider",
    ) -> FaceEnrollResponse:
        """
        Enrolls a rider's facial biometric template.
        - NEVER persists raw image (embeds in memory and immediately drops)
        - Encrypts vector using Fernet
        - Stores in face_templates table with retention policy
        - Returns raw_image_stored: false
        """
        rider = db.query(Rider).filter(Rider.id == rider_id).first()
        if not rider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Rider '{rider_id}' not found"
            )

        # 1. Extract Embedding Vector in Memory
        if embedding and len(embedding) >= 16:
            vec = self.verifier.embed(embedding, rider_id=rider_id)
        elif image_base64:
            # In-memory embedding extraction
            vec = self.verifier.embed(image_base64, rider_id=rider_id)
            # Explicit memory scrub
            image_base64 = None
        else:
            # Deterministic synthetic template
            vec = self.verifier.embed({"rider_id": rider_id}, rider_id=rider_id)

        # 2. Hash & Fernet Encrypt
        vec_json = json.dumps([round(x, 6) for x in vec])
        embedding_hash = hashlib.sha256(vec_json.encode("utf-8")).hexdigest()
        encrypted_token = encrypt_vector(vec)

        # 3. Check for existing template or create new
        existing = (
            db.query(FaceTemplate)
            .filter(FaceTemplate.rider_id == rider_id)
            .order_by(FaceTemplate.created_at.desc())
            .first()
        )

        now = utcnow()
        retention_until = now + timedelta(days=retention_days)

        if existing:
            existing.embedding_hash = embedding_hash
            existing.encrypted_embedding = encrypted_token
            existing.model_name = model_name
            existing.template_version = "v2"
            existing.retention_until = retention_until
            tmpl_id = existing.id
        else:
            tmpl_id = f"tmpl_{uuid.uuid4().hex[:8]}"
            tmpl = FaceTemplate(
                id=tmpl_id,
                rider_id=rider_id,
                template_version="v2",
                model_name=model_name,
                embedding_hash=embedding_hash,
                encrypted_embedding=encrypted_token,
                retention_until=retention_until,
                created_at=now,
            )
            db.add(tmpl)

        db.commit()

        # Audit enrollment
        audit_service.log(
            db=db,
            actor=actor,
            role=role,
            action="FACE_ENROLL",
            entity_type="face_template",
            entity_id=tmpl_id,
            detail=f"Enrolled template for rider {rider_id}. Model={model_name}, raw_image_stored=false",
        )

        return FaceEnrollResponse(
            template_id=tmpl_id,
            rider_id=rider_id,
            model_name=model_name,
            template_version="v2",
            raw_image_stored=False,
            embedding_hash=embedding_hash,
            retention_until=retention_until.isoformat(),
            created_at=now.isoformat(),
        )

    def generate_liveness_prompt(self, challenge_id: str) -> LivenessPromptResponse:
        """Generates dynamic liveness prompt for a face challenge."""
        p = self.liveness.generate_prompt(challenge_id)
        return LivenessPromptResponse(
            challenge_id=challenge_id,
            prompt=p["prompt"],
            nonce=p["nonce"],
            expires_at=p["expires_at"],
        )

    def verify(
        self,
        db: Session,
        challenge_id: str,
        input_payload: Any,
        actor: str = "system",
        role: str = "rider",
    ) -> FaceVerifyResponse:
        """
        Executes strictly 1:1 facial verification against enrolled rider template.
        - Evaluates 3D interactive liveness
        - Decrypts template and computes cosine similarity
        - On PASS: restores session, trusts device ('selfie'), updates trust score
        - On FAIL: triggers FACE_MISMATCH or LIVENESS_FAILED rule -> ESCALATE, opens case
        - Raw images are NEVER stored
        """
        from app.services.session_service import session_service
        from app.services.stepup_service import stepup_service

        # 1. Fetch Challenge and enforce lazy expiry
        chlg = db.query(Challenge).filter(Challenge.id == challenge_id).first()
        if not chlg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Challenge '{challenge_id}' not found"
            )

        stepup_service.lazy_check_expiry(chlg, db)
        if chlg.status == "EXPIRED":
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Challenge has expired. Please request a new step-up verification.",
            )
        if chlg.status in ("PASSED", "RESOLVED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Challenge '{challenge_id}' is already resolved ({chlg.status}).",
            )

        session = db.query(SessionModel).filter(SessionModel.id == chlg.session_id).first()
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session '{chlg.session_id}' associated with challenge not found",
            )

        rider_id = chlg.rider_id or session.rider_id
        rider = db.query(Rider).filter(Rider.id == rider_id).first()

        # 2. Extract / Parse Input
        data = input_payload if isinstance(input_payload, dict) else (
            input_payload.model_dump() if hasattr(input_payload, "model_dump") else {}
        )
        scenario = data.get("scenario") or data.get("scenario_flag")

        # 3. 1:1 Template Retrieval & Decryption (NEVER 1:N)
        tmpl = (
            db.query(FaceTemplate)
            .filter(FaceTemplate.rider_id == rider_id)
            .order_by(FaceTemplate.created_at.desc())
            .first()
        )

        if not tmpl:
            # Auto-enroll deterministic simulated baseline if not explicitly pre-enrolled
            enroll_res = self.enroll(
                db=db,
                rider_id=rider_id,
                model_name="simulated",
                actor="system",
                role="system",
            )
            tmpl = db.query(FaceTemplate).filter(FaceTemplate.id == enroll_res.template_id).first()

        template_vector = decrypt_vector(tmpl.encrypted_embedding)

        # 4. In-Memory Input Embedding Extraction (Scrub raw image immediately)
        if data.get("embedding"):
            input_vector = self.verifier.embed(data["embedding"], rider_id=rider_id)
        elif data.get("image_base64"):
            input_vector = self.verifier.embed(data["image_base64"], rider_id=rider_id)
            data["image_base64"] = None  # Dropped from memory
        else:
            input_vector = self.verifier.embed(
                {"scenario": scenario, "rider_id": rider_id}, rider_id=rider_id
            )

        # 5. Cosine Similarity & Liveness Evaluation
        similarity = self.verifier.similarity(template_vector, input_vector)
        liveness_res = self.liveness.check(data)

        liveness_score = float(liveness_res.get("liveness_score", 0.95))
        liveness_passed = bool(liveness_res.get("passed", True))
        spoof_type = liveness_res.get("spoof_type")

        # Decision predicate
        face_matched = similarity >= self.MATCH_THRESHOLD
        overall_passed = face_matched and liveness_passed

        # 6. Record Liveness Check Audit
        check_id = f"live_{uuid.uuid4().hex[:8]}"
        lc = LivenessCheck(
            id=check_id,
            challenge_id=chlg.id,
            liveness_score=liveness_score,
            confidence=similarity,
            passed=overall_passed,
            spoof_type=spoof_type,
            prompt_results=json.dumps(liveness_res.get("prompt_results", {})),
            created_at=utcnow(),
        )
        db.add(lc)

        now = utcnow()
        device_trusted = False

        if overall_passed:
            # ------------------------------------------------------------------
            # PASS CASCADE: Restore Session, Trust Device, Update Trust History
            # ------------------------------------------------------------------
            chlg.status = "PASSED"
            chlg.resolved_at = now

            # Trust Device via "selfie"
            device = db.query(Device).filter(Device.id == session.device_id).first()
            if device:
                device.trust_level = "trusted"
                device.trust_rating = 1.0
                device.passport_score = 100.0
                device.streak_count = max(device.streak_count, 3)
                device.trusted_via = "selfie"
                device_trusted = True

                link = (
                    db.query(DeviceRider)
                    .filter(
                        DeviceRider.device_id == device.id,
                        DeviceRider.rider_id == rider_id,
                    )
                    .first()
                )
                if link:
                    link.is_primary = True

                # Adapt baseline new_device state
                baseline = (
                    db.query(RiderBaseline).filter(RiderBaseline.rider_id == rider_id).first()
                )
                if baseline:
                    from app.services.baseline_service import baseline_service

                    if hasattr(baseline_service, "handle_otp_passed"):
                        baseline_service.handle_otp_passed(baseline, device.fingerprint)

            # Update Rider Trust Health (+15 pts)
            if rider:
                trust_score_row = (
                    db.query(RiderTrustScore)
                    .filter(RiderTrustScore.rider_id == rider.id)
                    .first()
                )
                old_trust = trust_score_row.trust_score if trust_score_row else 75.0
                new_trust = min(100.0, old_trust + 15.0)

                if trust_score_row:
                    trust_score_row.trust_score = new_trust
                    trust_score_row.last_calculated_at = now
                else:
                    trust_score_row = RiderTrustScore(
                        id=f"ts_{uuid.uuid4().hex[:8]}",
                        rider_id=rider.id,
                        trust_score=new_trust,
                        trend="IMPROVING",
                        confidence=0.95,
                        last_calculated_at=now,
                    )
                    db.add(trust_score_row)

                hist = RiderTrustHistory(
                    id=f"th_{uuid.uuid4().hex[:8]}",
                    rider_id=rider.id,
                    trust_score=new_trust,
                    reason="Step-up face re-verification passed (selfie)",
                    created_at=now,
                )
                db.add(hist)

                if rider.status in ("under_review", "restricted"):
                    rider.status = "active"
                    rider.updated_at = now

            # Re-score session with verified biometrics -> ALLOW
            proof_payload = dict(data.get("proof_payload") or {})
            proof_payload["face_match_confidence"] = similarity
            proof_payload["liveness_score"] = liveness_score
            proof_payload["face_verified"] = True
            proof_payload["otp_passed"] = True
            proof_payload["challenge_passed"] = True

            session, assessment = session_service.handle(
                db=db,
                session_or_event=proof_payload,
                session_id=session.id,
                actor=actor,
                role=role,
                otp_passed=True,
                trigger="face_verify_pass",
            )
            session.status = "IN_PROGRESS"
            session.current_verdict = "ALLOW"
            new_verdict = "ALLOW"
            message = "Face verification and liveness check passed. Device trusted and session restored."

            # Update / auto-release any HELD payouts awaiting liveness verification
            try:
                from app.services.payout_service import payout_service
                payout_service.handle_liveness_verified(db, rider_id=rider_id, challenge_id=chlg.id, now=now)
            except Exception:
                pass

            audit_service.log(
                db=db,
                actor=actor,
                role=role,
                action="FACE_VERIFY_PASSED",
                entity_type="challenge",
                entity_id=chlg.id,
                detail=f"1:1 Face match passed: similarity={similarity:.2f}, liveness={liveness_score:.2f}, device_trusted=true",
            )

        else:
            # ------------------------------------------------------------------
            # FAIL CASCADE: Trigger Rule Floors -> ESCALATE, Open Fraud Case
            # ------------------------------------------------------------------
            chlg.status = "FAILED"
            chlg.resolved_at = now

            # Re-score with mismatch or failed liveness to trigger non-negotiable rule floors
            proof_payload = dict(data.get("proof_payload") or {})
            proof_payload["face_match_confidence"] = similarity if not face_matched else 0.20
            proof_payload["liveness_score"] = liveness_score if not liveness_passed else 0.15
            proof_payload["challenge_failed"] = True

            session, assessment = session_service.handle(
                db=db,
                session_or_event=proof_payload,
                session_id=session.id,
                actor=actor,
                role=role,
                challenge_failed=True,
                trigger="face_verify_fail",
            )
            session.status = "ESCALATED"
            session.current_verdict = "ESCALATE"
            new_verdict = "ESCALATE"

            # Open or enrich critical fraud case
            case_id = f"case_{uuid.uuid4().hex[:8]}"
            failure_reason = "LIVENESS_FAILED" if not liveness_passed else "FACE_MISMATCH"
            threat_detail = (
                f"Face verification failed ({failure_reason}): "
                f"similarity={similarity:.2f} (threshold {self.MATCH_THRESHOLD}), "
                f"liveness={liveness_score:.2f}, spoof_type={spoof_type or 'none'}."
            )

            existing_case = (
                db.query(Case)
                .filter(Case.session_id == session.id)
                .order_by(Case.created_at.desc())
                .first()
            )
            if existing_case:
                existing_case.severity = "CRITICAL"
                existing_case.threat_summary = threat_detail
                existing_case.status = "OPEN"
                existing_case.updated_at = now
            else:
                c = Case(
                    id=case_id,
                    session_id=session.id,
                    rider_id=rider_id,
                    severity="CRITICAL",
                    status="OPEN",
                    threat_summary=threat_detail,
                    created_at=now,
                    updated_at=now,
                )
                db.add(c)

            if rider:
                rider.status = "under_review"
                rider.updated_at = now

            message = f"Face verification failed ({failure_reason}). Session escalated to investigation queue."

            audit_service.log(
                db=db,
                actor=actor,
                role=role,
                action="FACE_VERIFY_FAILED",
                entity_type="challenge",
                entity_id=chlg.id,
                detail=threat_detail,
            )

        db.commit()

        return FaceVerifyResponse(
            challenge_id=chlg.id,
            session_id=session.id,
            rider_id=rider_id,
            passed=overall_passed,
            similarity=similarity,
            threshold=self.MATCH_THRESHOLD,
            liveness_score=liveness_score,
            liveness_passed=liveness_passed,
            spoof_type=spoof_type,
            prompt_results=liveness_res.get("prompt_results"),
            new_verdict=new_verdict,
            device_trusted=device_trusted,
            raw_image_stored=False,
            message=message,
            fallback_available=True,
            fallback_options=["OTP", "document_check", "manual_review"],
        )

    def fallback(
        self,
        db: Session,
        challenge_id: str,
        fallback_type: str = "OTP",
        proof_data: Optional[Dict[str, Any]] = None,
        actor: str = "system",
        role: str = "rider",
    ) -> ChallengeFallbackResponse:
        """
        Executes fallback path when face verification is unavailable or requested by rider/analyst.
        Options:
        - OTP: Downgrades to SMS OTP challenge
        - document_check: Initiates government ID document verification (simulated)
        - manual_review: Escalates directly to human investigator
        """
        chlg = db.query(Challenge).filter(Challenge.id == challenge_id).first()
        if not chlg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Challenge '{challenge_id}' not found"
            )

        session = db.query(SessionModel).filter(SessionModel.id == chlg.session_id).first()
        now = utcnow()
        f_type = fallback_type.upper().strip()

        if f_type == "OTP":
            chlg.challenge_type = "OTP"
            chlg.level = 1
            chlg.status = "PENDING"
            chlg.expires_at = now + timedelta(minutes=10)
            db.commit()

            audit_service.log(
                db=db,
                actor=actor,
                role=role,
                action="CHALLENGE_FALLBACK_OTP",
                entity_type="challenge",
                entity_id=chlg.id,
                detail="Fallback from face verification to SMS OTP.",
            )
            return ChallengeFallbackResponse(
                challenge_id=chlg.id,
                status="PENDING",
                fallback_type="OTP",
                new_verdict="CHALLENGE",
                message="Switched verification method to SMS OTP.",
            )

        elif f_type in ("DOCUMENT_CHECK", "DOC_CHECK"):
            chlg.challenge_type = "DOCUMENT_CHECK"
            chlg.status = "PASSED"
            chlg.resolved_at = now
            if session:
                session.status = "IN_PROGRESS"
                session.current_verdict = "ALLOW"
            db.commit()

            audit_service.log(
                db=db,
                actor=actor,
                role=role,
                action="CHALLENGE_FALLBACK_DOC_CHECK",
                entity_type="challenge",
                entity_id=chlg.id,
                detail="Simulated document check approved.",
            )
            return ChallengeFallbackResponse(
                challenge_id=chlg.id,
                status="PASSED",
                fallback_type="document_check",
                new_verdict="ALLOW",
                message="Document check approved. Session restored.",
            )

        elif f_type in ("MANUAL_REVIEW", "ESCALATE"):
            chlg.status = "ESCALATED"
            chlg.resolved_at = now
            case_id = f"case_{uuid.uuid4().hex[:8]}"
            c = Case(
                id=case_id,
                session_id=chlg.session_id,
                rider_id=chlg.rider_id or (session.rider_id if session else None),
                severity="HIGH",
                status="OPEN",
                threat_summary="Rider requested fallback to manual human review.",
                created_at=now,
                updated_at=now,
            )
            db.add(c)
            if session:
                session.status = "ESCALATED"
                session.current_verdict = "ESCALATE"
            db.commit()

            audit_service.log(
                db=db,
                actor=actor,
                role=role,
                action="CHALLENGE_FALLBACK_MANUAL",
                entity_type="case",
                entity_id=case_id,
                detail="Escalated challenge to manual review case.",
            )
            return ChallengeFallbackResponse(
                challenge_id=chlg.id,
                status="ESCALATED",
                fallback_type="manual_review",
                new_verdict="ESCALATE",
                case_id=case_id,
                message="Escalated to human investigator review queue.",
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported fallback type '{fallback_type}'. Allowed: OTP, document_check, manual_review",
        )


face_service = FaceService()
