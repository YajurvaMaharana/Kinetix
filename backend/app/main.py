from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.v1.router import api_router
from app.config import settings
from app.db.session import create_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown lifecycle handler.
    Initializes database tables on startup.
    Loads the IsolationForest anomaly model once at startup into memory.
    """
    create_all()
    from app.scoring.anomaly import load_isolation_forest
    load_isolation_forest()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="TrustJuggler v2: Continuous Behavioral Trust, Ring Detection & Fraud Prevention Engine",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS for frontend access (defaulting to Next.js on port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str
    model_version: str
    policy_version: str


@app.get("/api/v1/health", response_model=HealthResponse, tags=["Health"])
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def get_health() -> HealthResponse:
    """
    Health check endpoint returning service readiness,
    active ML model version, and behavioral policy version.
    """
    return HealthResponse(
        status="healthy",
        model_version=settings.MODEL_VERSION,
        policy_version=settings.POLICY_VERSION,
    )


# Mount routers: both with /api/v1 prefix and root level for versatility
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router)


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "docs": "/docs",
        "health": "/api/v1/health",
        "model_version": settings.MODEL_VERSION,
        "policy_version": settings.POLICY_VERSION,
    }
