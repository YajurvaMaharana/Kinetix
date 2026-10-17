# TrustJuggler v2

> **Continuous Behavioral Trust, Identity Passporting & Syndicate Ring Defense for Mobility Platforms.**

Instead of treating driver and passenger identity as a brittle one-time check at onboarding, **TrustJuggler v2** continuously evaluates every trip session against dynamic behavioral baselines. It synthesizes device hardware attestations, biometric face liveness, kinematic sensor telemetry, and graph-based syndicate detection to prevent account handoffs, GPS spoofing, and payout draining collusion rings.

---

## ⚡ 3-Command Quickstart

Get the entire monorepo stack up and running in 3 commands:

```bash
# 1. Setup Python virtual environment, dependencies & Next.js frontend
make setup

# 2. Seed database fixtures and train the baseline Random Forest behavioral model
make demo

# 3. Launch Backend (:8000) and Frontend (:3000) concurrently
make dev
```

> **Direct Windows PowerShell Alternative (if `make` is not installed):**
> ```powershell
> python -m venv backend/.venv; backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt -r backend/requirements-dev.txt; npm --prefix frontend install
> backend/.venv/Scripts/python.exe backend/app/scripts/seed.py; backend/.venv/Scripts/python.exe backend/app/scripts/train.py
> Start-Process powershell -ArgumentList "cd backend; .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
> Start-Process powershell -ArgumentList "cd frontend; npm run dev -- -p 3000"
> ```

- **Frontend Console**: [http://localhost:3000](http://localhost:3000)
- **FastAPI OpenAPI Swagger**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Service Health Check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

## 🏗️ Architecture Sketch

```
                        [ Driver & Rider Mobile Clients ]
                                       │
                         (Kinematics, Biometrics, Attestation)
                                       ▼
                 ┌───────────────────────────────────────────┐
                 │          FastAPI Gateway (:8000)          │
                 │   - CORS (:3000) & Session Token Auth     │
                 │   - RBAC & Data Masking (X-Role Header)   │
                 └─────────────────────┬─────────────────────┘
                                       │
     ┌─────────────────────────────────┼─────────────────────────────────┐
     ▼                                 ▼                                 ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│     Device Passport     │ │   Biometrics & Motion   │ │  Syndicate Graph Engine │
│  - Fernet Encryption    │ │  - Face Liveness Match   │ │  - NetworkX Clustering  │
│  - Salt/Pepper Hashing  │ │  - Kinematic Telemetry   │ │  - Device Farm Sharing  │
│  - Emulator & Root Flag │ │  - Typing Cadence Jitter │ │  - Circular Bank Routes │
└────────────┬────────────┘ └────────────┬────────────┘ └────────────┬────────────┘
             └─────────────────────────┐ │ ┌─────────────────────────┘
                                       ▼ ▼ ▼
                     ┌───────────────────────────────────────┐
                     │     ML Trust Scoring & Policy Matrix  │
                     │   - Random Forest Classifier (v2)     │
                     │   - Real-time Cut-line Thresholds     │
                     └───────────────────┬───────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
  [ ALLOW ]                       [ CHALLENGE ]                    [ INVESTIGATE ]
Score: 75 - 100                   Score: 45 - 74                   Score: 20 - 44
Instant Fare Clearance            Face Liveness Step-Up            Escrow 24h Hold & Queue
        │                                │                                │
        └────────────────────────────────┴────────────────────────────────┘
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │     Next.js 14 Frontend Console       │
                     │  - Live Monitor   - Simulator Sliders │
                     │  - Case Queue     - Syndicate Graph   │
                     │  - Payout Gating  - Policy Simulator  │
                     └───────────────────────────────────────┘
```

---

## 🎯 Behavioral Tier & Cut-Line Decision Matrix

Trust scores range from **0.0 to 100.0** calculated per session tick. Thresholds dynamically trigger proportional platform interventions:

| Risk Tier | Trust Score | Engine Verdict | Friction & Action Taken | Typical Behavioral Signature |
| :--- | :---: | :---: | :--- | :--- |
| **LOW** | `75 – 100` | **`ALLOW`** | **Zero Friction**: Silent passage, instant payment authorization, uninterrupted trip. | Genuine device hardware passport, baseline facial match ($\ge 0.90$), regular acceleration and driving cadence. |
| **LOW** | `65 – 74` | **`ALLOW`** | **Low Friction**: Background telemetry re-sampling, zero rider disruption. | Ordinary change: new device login or interstate commute with verified biometrics. |
| **MEDIUM** | `45 – 64` | **`CHALLENGE`** | **Proportional Step-Up**: Immediate mid-trip Face Liveness challenge or SMS OTP. Payout escrow held for 2 hours. | Account handoff: sudden cadence drop ($<100$ cpm), high gyro jitter, unverified facial likeness. |
| **HIGH** | `20 – 44` | **`INVESTIGATE`** | **Human Review**: Escalated to Analyst Case Manager; payout held in 24h escrow. | Emulator detected (`x86 Android`), mock GPS location provider active, impossible speed jumps. |
| **CRITICAL** | `0 – 19` | **`BLOCK`** | **Immediate Lockdown**: Session terminated, payout denied, device & bank account frozen. | Collusion syndicate: hardware hash linked to $\ge 5$ identities, circular rides, fake incentive harvesting. |

---

## 👥 Team Roles & RBAC Matrix

All API endpoints enforce Role-Based Access Control (RBAC) via the `X-Role` HTTP header. Sensitive Personally Identifiable Information (PII), bank details, and hardware hashes are dynamically masked according to persona privileges:

| Team Role | Focus Area | `X-Role` Header | Access Permissions & Masking Rules |
| :--- | :--- | :---: | :--- |
| **ML / Fraud Engineer** | Model training, heuristic tuning, and telemetry evaluation | `system` / `admin` | Full access to raw telemetry features, model training endpoints, evaluation metrics, and ROC-AUC benchmarks. |
| **Platform / Backend Engineer** | Gateway security, database schemas, encryption & API contracts | `system` / `admin` | Full database access, secret key management (`TJ_FERNET_KEY`, `TJ_PEPPER`), and CI pipeline automation. |
| **Full-Stack / UI Engineer** | Dashboard, simulator sliders, and analyst workflow UX | `analyst` / `admin` | Next.js 14 component development, live monitor streams, real-time WebSocket/REST client integration. |
| **Fraud Analyst & Investigator** | Case resolution, dispute review, and ring disruption | `analyst` / `investigator` | Read-only access to PII and unmasked device graphs; permissions to resolve cases (`RESOLVED_LEGIT` or `CONFIRMED_FRAUD`). |
| **Finance & Compliance Officer** | Payout safety, chargeback defense, and privacy compliance | `finance` / `compliance` | Access to unmasked financial routes and escrow release; enforces GDPR/CCPA PII masking on driver identities. |

---

## 📂 Monorepo Structure

```
TrustJuggler/
├── Makefile                 # Automation: setup, dev, seed, train, test, lint, demo, purge
├── README.md                # Quickstart, architecture, cut-lines, team roles
├── .gitignore               # Python, Node, SQLite, artifacts, caches, .env
├── docs/
│   └── api-contract.md      # Complete v2 specification with request/response schemas
├── shared/
│   └── fixtures/            # 5 standard request/response test fixtures
│       ├── session_normal.json           <-> assessment_normal.json
│       ├── session_ordinary_change.json <-> assessment_ordinary_change.json
│       ├── session_handoff.json          <-> assessment_handoff.json
│       ├── session_spoof.json            <-> assessment_spoof.json
│       └── session_ring.json             <-> assessment_ring.json
├── backend/
│   ├── pyproject.toml       # Ruff (line-length 100) & Pytest configuration
│   ├── requirements.txt     # FastAPI, Uvicorn, SQLAlchemy, Pydantic, Scikit-learn, etc.
│   ├── requirements-dev.txt # Pytest, HTTPX, Ruff
│   ├── requirements-face.txt# Optional DeepFace & InsightFace biometrics backends
│   ├── app/
│   │   ├── main.py          # CORS configuration & /api/v1/health
│   │   ├── config.py        # Pydantic settings: DATABASE_URL, Fernet, Pepper, FACE_BACKEND
│   │   ├── deps.py          # get_db, get_role from X-Role, require_role, PII mask helpers
│   │   ├── api/v1/          # Modular API endpoints
│   │   ├── core/            # Cryptographic hashing & passport security
│   │   ├── db/              # SQLAlchemy session and Base models
│   │   ├── ml/              # Model artifacts & feature pipelines
│   │   ├── models/          # Database ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Scoring, clustering, and policy engines
│   │   └── scripts/         # Seed fixtures & ML model training scripts
│   └── tests/
│       └── test_health.py   # Health endpoint & CORS unit tests
├── frontend/
│   ├── .env.example         # NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
│   ├── package.json         # Next.js 14, Tailwind CSS, Lucide Icons
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx   # Global dark mode layout & navigation bar
│   │   │   ├── page.tsx     # Home dashboard: calls /health, latency, scenario cards
│   │   │   ├── monitor/     # Real-time session stream
│   │   │   ├── simulator/   # Anomaly injection sliders
│   │   │   ├── cases/       # Analyst case queue
│   │   │   ├── graph/       # Collusion ring clusters
│   │   │   ├── payouts/     # Payout escrow gating
│   │   │   ├── policy/      # Cut-line simulation
│   │   │   ├── demo/        # 1-click database reset & seed
│   │   │   └── evaluation/  # ROC-AUC accuracy benchmarks
│   │   └── lib/
│   │       ├── api.ts       # Typed fetch wrapper with X-Role header injection
│   │       └── types.ts     # Complete v2 TypeScript interfaces
└── .github/
    ├── pull_request_template.md
    └── workflows/
        └── ci.yml           # Backend ruff+pytest, frontend lint+test+build
```

---

## 🛠️ Makefile Commands

| Command | Action |
| :--- | :--- |
| `make setup` | Installs backend Python venv & dependencies and frontend npm packages |
| `make dev` | Launches both backend (:8000) and frontend (:3000) concurrently |
| `make seed` | Populates SQLite database with test fixtures and collusion rings |
| `make train` | Fits and serializes the baseline behavioral Random Forest model |
| `make test` | Runs backend Pytest (`FACE_BACKEND=simulated`) & frontend tests |
| `make lint` | Validates Python code with Ruff and Next.js with ESLint |
| `make demo` | Automates end-to-end demo prep: `reset` + `seed` + `train` |
| `make purge` | Deep cleans `.venv`, `node_modules`, `.next`, caches, and SQLite databases |

---

## 📜 License & Compliance

TrustJuggler is built for enterprise mobility fraud prevention under internal dual-licensing. Cryptographic hashing of hardware serials and phone numbers ensures CCPA/GDPR compliance with zero plain-text biometric retention.
