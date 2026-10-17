import os
from typing import List

from pydantic import BaseModel, Field


class Settings(BaseModel):
    """
    TrustJuggler v2 Application Configuration.
    Reads from environment variables with production-ready defaults.
    """
    PROJECT_NAME: str = "TrustJuggler v2"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = Field(default_factory=lambda: os.getenv("DEBUG", "false").lower() in ("true", "1"))

    # Versioning
    MODEL_VERSION: str = Field(
        default_factory=lambda: os.getenv("MODEL_VERSION", "v2.0.0-rf-heuristic")
    )
    POLICY_VERSION: str = Field(
        default_factory=lambda: os.getenv("POLICY_VERSION", "v2.4.0")
    )

    # Database
    DATABASE_URL: str = Field(
        default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./trustjuggler.db")
    )

    # Cryptography & Device Passport Security
    TJ_FERNET_KEY: str = Field(
        default_factory=lambda: os.getenv(
            "TJ_FERNET_KEY",
            "cDhNQUV5b0R0eG92c3Q3VURxQ3UycDRoUG85Y2V6Sm4="
        )
    )
    TJ_PEPPER: str = Field(
        default_factory=lambda: os.getenv(
            "TJ_PEPPER",
            "trustjuggler_super_secure_hash_pepper_2026_v2"
        )
    )

    # Face Verification Backend
    FACE_BACKEND: str = Field(
        default_factory=lambda: os.getenv("FACE_BACKEND", "simulated")
    )

    # CORS Allowed Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]


settings = Settings()
