# ==============================================================================
# TrustJuggler v2 Monorepo Makefile
# ==============================================================================

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

# OS Detection
ifeq ($(OS),Windows_NT)
	VENV_BIN := backend/.venv/Scripts
	PYTHON := $(VENV_BIN)/python.exe
	PIP := $(VENV_BIN)/python.exe -m pip
	UVICORN := $(VENV_BIN)/uvicorn.exe
	PYTEST := $(VENV_BIN)/pytest.exe
	RUFF := $(VENV_BIN)/ruff.exe
	RM_RF := rm -rf
else
	VENV_BIN := backend/.venv/bin
	PYTHON := $(VENV_BIN)/python
	PIP := $(VENV_BIN)/pip
	UVICORN := $(VENV_BIN)/uvicorn
	PYTEST := $(VENV_BIN)/pytest
	RUFF := $(VENV_BIN)/ruff
	RM_RF := rm -rf
endif

.PHONY: all help setup dev dev-backend dev-frontend seed train test lint demo reset purge

help:
	@echo "TrustJuggler v2 Monorepo Management"
	@echo "-----------------------------------"
	@echo "make setup          Install backend venv & deps and frontend npm packages"
	@echo "make dev            Launch backend (:8000) and frontend (:3000) concurrently"
	@echo "make dev-backend    Launch FastAPI backend server on http://localhost:8000"
	@echo "make dev-frontend   Launch Next.js 14 frontend on http://localhost:3000"
	@echo "make seed           Seed SQLite database with fixtures and syndicate clusters"
	@echo "make train          Train and export behavioral ML classifier artifact"
	@echo "make test           Run backend pytest suite and frontend test suite"
	@echo "make lint           Run backend ruff checks and frontend next lint"
	@echo "make demo           Full demo pipeline: reset + seed + train"
	@echo "make purge          Purge all caches, virtualenv, node_modules, and artifacts"

# ------------------------------------------------------------------------------
# 1. Setup
# ------------------------------------------------------------------------------
setup:
	@echo "[*] Setting up Python virtual environment..."
	@python -m venv backend/.venv || python3 -m venv backend/.venv
	@$(PIP) install --upgrade pip
	@$(PIP) install -r backend/requirements.txt
	@$(PIP) install -r backend/requirements-dev.txt
	@echo "[*] Setting up Frontend dependencies..."
	@npm --prefix frontend install
	@echo "[OK] Setup complete! Run 'make dev' to start local servers."

# ------------------------------------------------------------------------------
# 2. Local Development Servers
# ------------------------------------------------------------------------------
dev-backend:
	@echo "[*] Starting FastAPI Backend on http://localhost:8000 (docs at /docs)..."
	@cd backend && ../$(PYTHON) -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

dev-frontend:
	@echo "[*] Starting Next.js 14 Frontend on http://localhost:3000..."
	@npm --prefix frontend run dev -- -p 3000

dev:
	@echo "[*] Launching TrustJuggler v2 Services (:8000 + :3000)..."
	@npx --yes concurrently -k -n "backend,frontend" -c "blue,magenta" \
		"make dev-backend" \
		"make dev-frontend"

# ------------------------------------------------------------------------------
# 3. Data & ML Pipeline
# ------------------------------------------------------------------------------
seed:
	@echo "[*] Seeding database with baseline identities and collusion rings..."
	@$(PYTHON) backend/app/scripts/seed.py

train:
	@echo "[*] Training behavioral Random Forest classifier..."
	@$(PYTHON) backend/app/scripts/train.py

# ------------------------------------------------------------------------------
# 4. Testing & Code Quality
# ------------------------------------------------------------------------------
test:
	@echo "[*] Running Backend Pytest Suite with FACE_BACKEND=simulated..."
	@FACE_BACKEND=simulated $(PYTEST) backend/tests/ -v
	@echo "[*] Running Frontend Test Suite..."
	@npm --prefix frontend test --if-present

lint:
	@echo "[*] Running Backend Ruff Lint..."
	@$(RUFF) check backend/
	@echo "[*] Running Frontend ESLint..."
	@npm --prefix frontend run lint

# ------------------------------------------------------------------------------
# 5. Demo Automation & Maintenance
# ------------------------------------------------------------------------------
reset:
	@echo "[*] Resetting demo state and database..."
	@$(RM_RF) backend/*.db backend/*.sqlite3 *.db *.sqlite3

demo: reset seed train
	@echo "[OK] TrustJuggler v2 Demo environment ready! Run 'make dev' to launch."

purge:
	@echo "[*] Purging all build artifacts, dependencies, and temporary caches..."
	@$(RM_RF) backend/.venv backend/__pycache__ backend/*/__pycache__ backend/*/*/__pycache__
	@$(RM_RF) frontend/node_modules frontend/.next
	@$(RM_RF) .pytest_cache backend/.pytest_cache .ruff_cache backend/.ruff_cache
	@$(RM_RF) backend/*.db backend/*.sqlite3 *.db *.sqlite3
	@$(RM_RF) backend/app/ml/artifacts/*.joblib
	@echo "[OK] Purge complete."
