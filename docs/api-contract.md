# TrustJuggler v2 — API Contract & Specification

**Specification Version**: `2.0.0`  
**Base URL**: `http://localhost:8000/api/v1`  
**Authentication & RBAC**: Passed via HTTP Header `X-Role: <role>`  
- Supported roles: `admin`, `analyst`, `investigator`, `finance`, `rider`, `system` (default: `analyst`)

---

## Architecture & Data Flow Overview

```
 [ Client App / Mobile SDK ]
             │
             ▼  (Telemetry, Biometrics, Device Passport)
┌──────────────────────────────────────────────┐
│  POST /api/v1/sessions/evaluate              │
└──────────────────────┬───────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌──────────────┐┌──────────────┐┌──────────────┐
│  ML Scoring  ││ Graph Engine ││ Policy Matrix│
│ (RandomForest││ (NetworkX /  ││ (Cut-lines & │
│  + Heuristics││  Collusion)  ││  Friction)   │
└──────┬───────┘└──────┬───────┘└──────┬───────┘
       └───────────────┼───────────────┘
                       │
                       ▼
          [ Trust Score & Verdict ]
         /             |          \
     ALLOW        CHALLENGE     INVESTIGATE / BLOCK
       |               |                 |
  (Proceed)     (Face Liveness)     (Open Case & Payout Escrow Hold)
```

---

## 1. System Health

### `GET /api/v1/health` (and alias `/health`)
Returns service operational status, active ML scoring model version, and behavioral policy matrix version.

**Request**:
```http
GET /api/v1/health HTTP/1.1
Host: localhost:8000
```

**Response `200 OK`**:
```json
{
  "status": "healthy",
  "model_version": "v2.0.0-rf-heuristic",
  "policy_version": "v2.4.0"
}
```

---

## 2. Behavioral Session Evaluation

### `POST /api/v1/sessions/evaluate`
Submits active trip telemetry, hardware attestation, and biometrics for real-time scoring.

**Headers**:
- `Content-Type: application/json`
- `X-Role: system` (or `analyst`)

**Request Body**:
```json
{
  "session_id": "sess_norm_9001",
  "rider_id": "rider_us_east_4102",
  "driver_id": "drv_8821",
  "timestamp": "2026-10-17T18:30:00Z",
  "device_passport": {
    "device_id_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "device_model": "iPhone 15 Pro",
    "os_version": "iOS 18.2",
    "app_version": "2.4.1",
    "ip_address": "198.51.100.42",
    "carrier": "T-Mobile US",
    "vpn_detected": false,
    "mock_location_detected": false,
    "rooted_or_jailbroken": false,
    "screen_resolution": "1179x2556",
    "battery_drain_rate_pct_hr": 3.2
  },
  "biometrics": {
    "face_present": true,
    "face_match_confidence": 0.98,
    "liveness_score": 0.96,
    "biometric_backend": "simulated"
  },
  "telemetry": {
    "speed_kmh": 38.5,
    "acceleration_variance": 0.14,
    "gyro_stability": 0.92,
    "typing_cadence_cpm": 240,
    "route_deviation_pct": 2.1,
    "trip_distance_km": 6.8,
    "elapsed_minutes": 14.5
  },
  "location": {
    "lat": 40.7128,
    "lng": -74.0060,
    "accuracy_meters": 4.5,
    "geofence_id": "nyc_manhattan_core",
    "zone_risk_level": "LOW"
  },
  "financial": {
    "fare_amount": 28.50,
    "currency": "USD",
    "payment_method": "apple_pay",
    "tip_amount": 5.00,
    "promo_applied": false
  }
}
```

**Response `200 OK`**:
```json
{
  "assessment_id": "eval_norm_9001",
  "session_id": "sess_norm_9001",
  "rider_id": "rider_us_east_4102",
  "trust_score": 96.0,
  "verdict": "ALLOW",
  "risk_tier": "LOW",
  "threat_tags": [
    "CLEAN"
  ],
  "factors": [
    {
      "name": "Hardware Attestation",
      "category": "DEVICE",
      "impact": "POSITIVE",
      "weight": 0.25,
      "score": 0.98,
      "description": "Device hardware cryptographic passport valid, non-rooted genuine iPhone."
    },
    {
      "name": "Biometric Authenticity",
      "category": "BIOMETRIC",
      "impact": "POSITIVE",
      "weight": 0.30,
      "score": 0.97,
      "description": "High-fidelity facial liveness and cosine match with registered baseline."
    },
    {
      "name": "Kinematic Consistency",
      "category": "TELEMETRY",
      "impact": "POSITIVE",
      "weight": 0.25,
      "score": 0.94,
      "description": "Smooth acceleration and gyro motion align with urban vehicle travel."
    },
    {
      "name": "Cluster Association",
      "category": "GRAPH",
      "impact": "POSITIVE",
      "weight": 0.20,
      "score": 0.99,
      "description": "Zero edges to known fraudulent syndicates or recycled payment tokens."
    }
  ],
  "challenge": null,
  "case_id": null,
  "payout_decision": {
    "status": "APPROVED",
    "hold_reason": null,
    "hold_period_hours": 0
  },
  "evaluated_at": "2026-10-17T18:30:02Z"
}
```

*(See `shared/fixtures/` for handoff, spoof, and ring test scenarios)*

---

### `GET /api/v1/sessions/{session_id}`
Fetches the telemetry snapshot and latest trust assessment for an active or completed session.

**Response `200 OK`**:
```json
{
  "session_id": "sess_handoff_9003",
  "rider_id": "rider_us_south_6021",
  "driver_id": "drv_7190",
  "status": "CHALLENGED",
  "latest_assessment_id": "eval_handoff_9003",
  "trust_score": 42.0,
  "created_at": "2026-10-17T19:00:00Z"
}
```

---

## 3. Step-Up Verification & Challenges

### `POST /api/v1/challenges/verify`
Validates proof submitted by client (e.g. face selfie liveness capture, SMS OTP, or device re-auth).

**Request Body**:
```json
{
  "challenge_id": "chlg_face_9003",
  "session_id": "sess_handoff_9003",
  "challenge_type": "FACE_LIVENESS",
  "proof_payload": {
    "liveness_frames_count": 8,
    "face_embedding": [0.012, -0.045, 0.089, "...", 0.003],
    "client_nonce": "f6b219a"
  }
}
```

**Response `200 OK`**:
```json
{
  "challenge_id": "chlg_face_9003",
  "status": "PASSED",
  "verified": true,
  "trust_score_delta": +35.0,
  "new_verdict": "ALLOW",
  "message": "Step-up liveness verified successfully. Payout escrow hold cleared."
}
```

---

## 4. Case Management (Analyst Workflow)

### `GET /api/v1/cases`
Queries flagged security cases with filtering by severity, status, and assignment.

**Headers**:
- `X-Role: analyst`

**Response `200 OK`**:
```json
[
  {
    "case_id": "case_spoof_9004",
    "session_id": "sess_spoof_9004",
    "rider_id": "rider_global_susp_7719",
    "severity": "HIGH",
    "status": "OPEN",
    "assigned_to": null,
    "threat_summary": "GPS spoofing and x86 emulator detected during trip",
    "created_at": "2026-10-17T19:15:02Z",
    "updated_at": "2026-10-17T19:15:02Z"
  }
]
```

### `GET /api/v1/cases/{case_id}`
Returns case details including linked audit logs and telemetry timeline.

### `PATCH /api/v1/cases/{case_id}`
Updates case status, assignee, or analyst disposition note.

**Request Body**:
```json
{
  "status": "RESOLVED_LEGIT",
  "assigned_to": "analyst_sarah_m",
  "notes": "Verified client was testing in secondary simulator environment."
}
```

---

## 5. Syndicate Graph & Ring Detection

### `GET /api/v1/graph/clusters`
Returns discovered fraud rings and collusion clusters computed from shared devices, banks, and GPS colocation.

**Response `200 OK`**:
```json
[
  {
    "cluster_id": "CLUSTER-RING-409",
    "name": "Redmi Device Farm Syndicate #4",
    "nodes_count": 14,
    "shared_identifiers": [
      "DEV_HASH_778899",
      "ROUTING_ACCT_US_9921",
      "SF_TENDERLOIN_GPS_CELL"
    ],
    "risk_score": 98.4,
    "status": "ACTIVE"
  }
]
```

### `GET /api/v1/graph/nodes/{node_id}`
Inspects entity graph neighbors (devices, drivers, riders, payout accounts).

---

## 6. Payout Safety & Escrow Controls

### `POST /api/v1/payouts/evaluate`
Gating checks for driver and referral payouts prior to disbursement.

**Request Body**:
```json
{
  "payout_id": "pay_99812",
  "rider_id": "rider_syndicate_node_014",
  "driver_id": "drv_syndicate_node_014",
  "amount": 175.00,
  "currency": "USD",
  "destination_account": "acct_routing_992184"
}
```

**Response `200 OK`**:
```json
{
  "payout_id": "pay_99812",
  "status": "BLOCKED",
  "decision": "DENIED",
  "hold_reason": "Linked to active syndicate cluster CLUSTER-RING-409",
  "hold_period_hours": 720,
  "evaluated_at": "2026-10-17T19:30:02Z"
}
```

---

## 7. Policy Simulator & Cut-Lines

### `GET /api/v1/policies`
Returns currently active policy thresholds and cut-lines.

### `POST /api/v1/policies/simulate`
Simulates the impact of moving trust score cut-lines on historical sessions.

**Request Body**:
```json
{
  "allow_threshold": 75.0,
  "challenge_threshold": 50.0,
  "investigate_threshold": 25.0,
  "block_threshold": 10.0
}
```

**Response `200 OK`**:
```json
{
  "policy_id": "sim_2026_test_01",
  "sessions_evaluated": 10000,
  "simulated_pass_rate": 0.942,
  "simulated_friction_rate": 0.048,
  "simulated_fraud_catch_rate": 0.981,
  "estimated_chargeback_reduction_pct": 34.5
}
```

---

## 8. Demo Controls

### `POST /api/v1/demo/reset`
Wipes the demo database clean.

### `POST /api/v1/demo/seed`
Loads baseline riders, device passports, and sample fraud ring scenarios.
