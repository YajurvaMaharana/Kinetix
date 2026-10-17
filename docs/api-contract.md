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

### Challenge Object & Ladder Schema
TrustJuggler v2 employs a proportional 4-tier step-up challenge ladder:
- **Level 0**: Passive monitor (`MONITOR`, risk < 45 or verdict `ALLOW`/`MONITOR`). Never issues active challenges.
- **Level 1**: OTP verification (`OTP`, risk 45–59).
- **Level 2**: Liveness selfie + face match (`FACE_LIVENESS`, risk 60–74, payout lock, or Level 1 OTP failed).
- **Level 3**: Manual review / document check (`MANUAL_REVIEW`, verdict `ESCALATE`, or biometric failure). Opens Security Case and restricts rider.

#### Cooldowns & Suppression:
- `cooldown_key = rider_id + reason_code` (e.g. `rider_us_south_6021:NEW_DEVICE_BEHAVIOR_SHIFT`).
- **30-Minute OTP Cooldown**: Following a `PASS`, repeat OTP challenges for the same key are suppressed for 30 minutes.
- **24-Hour Level-2 Lift**: Following a `PASS`, Level 2 liveness challenges are lifted for 24 hours.
- **Daily Liveness Cap**: Maximum 2 liveness challenges per rider per rolling 24-hour day.
- **Suppression State**: Suppressed challenges are stored with `status: "suppressed"` and the assessment factors explain why no challenge was issued.
- **Challenge Expiry**: 10-minute lifetime lazily evaluated on read (`status: "EXPIRED"`).

```json
{
  "challenge_id": "chlg_8f1b2c3d",
  "session_id": "sess_handoff_9003",
  "rider_id": "rider_us_south_6021",
  "challenge_type": "OTP",
  "status": "PENDING",
  "level": 1,
  "reason_code": "NEW_DEVICE_BEHAVIOR_SHIFT",
  "cooldown_key": "rider_us_south_6021:NEW_DEVICE_BEHAVIOR_SHIFT",
  "suppression_reason": null,
  "expires_at": "2026-10-17T19:10:00Z",
  "created_at": "2026-10-17T19:00:00Z",
  "resolved_at": null
}
```

---

### `POST /api/v1/challenges/{challenge_id}/respond`
Submits proof or response for an active OTP or Face Liveness challenge.
- **OTP Verification**: If `otp_code` is `"123456"`, challenge passes.
- **Pass Handling**: Re-scores session with verification flags, marks device trusted (`trust_level: "trusted"`), updates trust score and audit log, and restores session to `IN_PROGRESS` / `ALLOW`.
- **Failure Escalation**: OTP failed escalates to Level 2 (`FACE_LIVENESS`); Level 2 failed escalates to Level 3 (`MANUAL_REVIEW`), opens an automated Security Case, restricts the rider, and holds payouts.

**Request Body**:
```json
{
  "passed": true,
  "otp_code": "123456",
  "liveness_score": 0.96,
  "confidence": 0.94,
  "proof_payload": {
    "device_nonce": "e3b0c442",
    "frames_evaluated": 12
  }
}
```

**Response `200 OK`**:
```json
{
  "challenge_id": "chlg_8f1b2c3d",
  "session_id": "sess_handoff_9003",
  "rider_id": "rider_us_south_6021",
  "challenge_type": "OTP",
  "status": "PASSED",
  "level": 1,
  "reason_code": "NEW_DEVICE_BEHAVIOR_SHIFT",
  "cooldown_key": "rider_us_south_6021:NEW_DEVICE_BEHAVIOR_SHIFT",
  "resolved_at": "2026-10-17T19:02:15Z",
  "verified": true,
  "new_verdict": "ALLOW",
  "message": "Challenge OTP passed successfully. Device trusted and session restored."
}
```

---

### `GET /api/v1/riders/{rider_id}/challenges`
Retrieves chronological step-up verification challenge history for a rider.
Performs lazy expiry evaluation on any `PENDING` challenges whose 10-minute timeout has elapsed.

**Response `200 OK`**:
```json
[
  {
    "challenge_id": "chlg_8f1b2c3d",
    "session_id": "sess_handoff_9003",
    "rider_id": "rider_us_south_6021",
    "challenge_type": "OTP",
    "status": "PASSED",
    "level": 1,
    "reason_code": "NEW_DEVICE_BEHAVIOR_SHIFT",
    "cooldown_key": "rider_us_south_6021:NEW_DEVICE_BEHAVIOR_SHIFT",
    "created_at": "2026-10-17T19:00:00Z",
    "expires_at": "2026-10-17T19:10:00Z",
    "resolved_at": "2026-10-17T19:02:15Z",
    "verified": true
  },
  {
    "challenge_id": "chlg_supp_1002",
    "session_id": "sess_handoff_9004",
    "rider_id": "rider_us_south_6021",
    "challenge_type": "OTP",
    "status": "suppressed",
    "level": 1,
    "reason_code": "NEW_DEVICE_BEHAVIOR_SHIFT",
    "cooldown_key": "rider_us_south_6021:NEW_DEVICE_BEHAVIOR_SHIFT",
    "created_at": "2026-10-17T19:15:00Z",
    "expires_at": "2026-10-17T19:25:00Z",
    "resolved_at": "2026-10-17T19:15:00Z",
    "verified": false
  }
]
```

---

### `GET /api/v1/challenges/{challenge_id}`
Retrieves a single challenge with lazy expiry evaluation.

**Response `200 OK`**:
```json
{
  "challenge_id": "chlg_8f1b2c3d",
  "session_id": "sess_handoff_9003",
  "rider_id": "rider_us_south_6021",
  "challenge_type": "OTP",
  "status": "PASSED",
  "level": 1,
  "reason_code": "NEW_DEVICE_BEHAVIOR_SHIFT",
  "cooldown_key": "rider_us_south_6021:NEW_DEVICE_BEHAVIOR_SHIFT",
  "created_at": "2026-10-17T19:00:00Z",
  "expires_at": "2026-10-17T19:10:00Z",
  "resolved_at": "2026-10-17T19:02:15Z",
  "verified": true
}
```

---

### `POST /api/v1/riders/{rider_id}/face/enroll`
Enrolls a Fernet-encrypted facial biometric template.
- Raw images are embedded in memory and discarded immediately (`raw_image_stored: false`).
- Vectors are stored encrypted using Fernet (`TJ_FERNET_KEY`).

**Request Body**:
```json
{
  "embedding": [0.052, -0.019, 0.088, "...128 dimensions..."],
  "model_name": "simulated",
  "retention_days": 365
}
```

**Response `201 Created`**:
```json
{
  "template_id": "tmpl_9a12c4",
  "rider_id": "rider_us_south_6021",
  "model_name": "simulated",
  "template_version": "v2",
  "raw_image_stored": false,
  "embedding_hash": "a1b2c3d4e5f6...",
  "retention_until": "2027-10-18T00:00:00Z",
  "created_at": "2026-10-18T00:00:00Z"
}
```

---

### `GET /api/v1/challenges/{challenge_id}/liveness-prompt`
Generates a dynamic 3D interactive liveness prompt (`blink`, `turn_head_left`, `turn_head_right`, `smile`) with a cryptographic nonce.

**Response `200 OK`**:
```json
{
  "challenge_id": "chlg_8f1b2c3d",
  "prompt": "blink",
  "nonce": "e3b0c442",
  "expires_at": "2026-10-17T19:05:00Z"
}
```

---

### `POST /api/v1/challenges/{challenge_id}/face-verify`
Executes strictly 1:1 biometric facial verification and 3D liveness against enrolled template.
- **Threshold**: 0.70 cosine similarity.
- **PASS**: Restores session to `ALLOW`, marks device trusted (`trusted_via: "selfie"`), awards +15 trust health points.
- **FAIL**: Triggers `FACE_MISMATCH` or `LIVENESS_FAILED` rule floors (floor 75 -> `ESCALATE`), opens critical fraud case, restricts rider.
- **Raw Images**: Never persisted to disk or database (`raw_image_stored: false`).

**Request Body**:
```json
{
  "scenario": "genuine_face",
  "prompt_response": {
    "action": "blink",
    "nonce": "e3b0c442"
  }
}
```

**Response `200 OK` (Pass)**:
```json
{
  "challenge_id": "chlg_8f1b2c3d",
  "session_id": "sess_handoff_9003",
  "rider_id": "rider_us_south_6021",
  "passed": true,
  "similarity": 0.88,
  "threshold": 0.70,
  "liveness_score": 0.95,
  "liveness_passed": true,
  "spoof_type": null,
  "new_verdict": "ALLOW",
  "device_trusted": true,
  "raw_image_stored": false,
  "message": "Face verification and liveness check passed. Device trusted and session restored.",
  "fallback_available": true,
  "fallback_options": ["OTP", "document_check", "manual_review"]
}
```

---

### `POST /api/v1/challenges/{challenge_id}/fallback`
Provides graceful fallbacks when face check is unavailable or inconclusive.
- **Options**: `OTP` (switches to SMS OTP), `document_check` (simulated government ID), `manual_review` (escalates to human investigator).

**Request Body**:
```json
{
  "fallback_type": "OTP"
}
```

**Response `200 OK`**:
```json
{
  "challenge_id": "chlg_8f1b2c3d",
  "status": "PENDING",
  "fallback_type": "OTP",
  "new_verdict": "CHALLENGE",
  "message": "Switched verification method to SMS OTP."
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
