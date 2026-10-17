## Description

Provide a clear and concise description of the changes introduced in this PR. Mention relevant architectural components (Scoring, Biometrics, Graph/Collusion, Telemetry, Policy Simulator, Frontend UI).

Fixes #(issue) / Relates to #(ticket)

---

## Type of Change

- [ ] New feature (non-breaking change adding functionality)
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] Breaking change (fix or feature changing API contracts or schemas)
- [ ] Refactoring / Code style / Typing
- [ ] Performance optimization
- [ ] Documentation / Fixtures / CI update

---

## TrustJuggler v2 Contract & Quality Checklist

- [ ] Behavioral scoring or cut-line changes align with `docs/api-contract.md`
- [ ] API responses include `X-Role` compatibility and appropriate PII/financial masking
- [ ] Fixtures under `shared/fixtures/` updated or added if contract schemas changed
- [ ] Backend tests passing: `pytest backend/tests/ -v` (with `FACE_BACKEND=simulated`)
- [ ] Backend linting clean: `ruff check backend/`
- [ ] Frontend compiles and builds cleanly: `npm run build` in `frontend/`
- [ ] Frontend linter clean: `npm run lint`

---

## Verification & Manual Testing Steps

1. Step 1:
2. Step 2:
3. Observed results & screenshots (if UI changes):
