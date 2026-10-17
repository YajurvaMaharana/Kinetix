# TrustJuggler v2: Privacy, Ethics & Fairness Architecture

## 1. Principles of Ethical Account Integrity
TrustJuggler operates on the principle of **Proportional Verification**:
- Legitimate delivery workers and gig economy riders must never be subjected to punitive, unexplained account suspensions or discriminatory biometric friction.
- Passive multi-modal behavioral dynamics (motor cadence, travel consistency, network continuity) serve as the first line of defense, ensuring >95% of sessions operate with zero friction (`ALLOW`).
- Every friction mechanism is graduated, transparent, non-hostile, and accompanied by immediate redress pathways.

---

## 2. Consent & Purpose Limitation
### 2.1 Explicit Granular Consent
- **Consent Attributes**: Each rider record tracks `consent_version` (e.g. `v1.0`) and `consent_at` timestamp.
- **Minimal Telemetry Mode**: When a rider has not provided explicit consent or has withdrawn consent:
  - High-frequency motor kinematics (gyroscope variance, swipe curves, touch pressure) are suppressed and replaced with neutral baselines.
  - Continuous behavioral tracking is disabled; the scoring engine flags `CONSENT_MINIMAL_MODE`.
  - The assessment strictly clamps risk scores at $\le 55$ (preventing unfair lockouts solely due to missing consent).
- **Purpose Limitation**: Telemetry, biometric vectors, and device signals are collected exclusively for real-time account takeover prevention and payout fraud mitigation. Data is strictly prohibited from being utilized for advertising, rider performance grading, credit evaluation, or secondary commercial monetization.

---

## 3. Data Minimization & Cryptographic Privacy Standards
TrustJuggler guarantees privacy-by-design at the API boundary:
### 3.1 Zero Raw IP & Hardware Fingerprint Guarantee
- **HMAC-SHA256 Tokenization**: All incoming IPv4/IPv6 addresses and hardware device fingerprints are tokenized at the edge using HMAC-SHA256 keyed with a secret platform pepper (`TJ_PEPPER`).
- **Scrubbing Engine**: Any free-form JSON payloads, telemetry dictionaries, and audit log text are recursively scrubbed via `scrub_raw_pii_string()` and `scrub_raw_pii_dict()` before reaching persistent storage.
- **Model-Level Defensive Validations**: SQLAlchemy `@validates` hooks on `Session.ip_address`, `Device.fingerprint`, `SessionEvent.payload_json`, and `AuditLog.detail` intercept and tokenize any stray raw identifiers.
- **Automated Startup Self-Check**: The test suite and startup routines run `scan_db_for_raw_pii` and `scan_sqlite_file_for_pii` across the physical SQLite database file; discovery of an unhashed IP or raw fingerprint string immediately causes pipeline failure.

### 3.2 Cryptographic Vector Protection
- **Zero Raw Image Persistence**: Raw facial photographs, camera frames, and selfie uploads are **NEVER stored on disk or in databases**. Images are processed purely in-memory to extract mathematical embeddings and immediately scrubbed (`raw_image_stored: false`).
- **Fernet Encryption at Rest**: All biometric vector embeddings are encrypted using AES-128-CBC with HMAC-SHA256 authentication (`TJ_FERNET_KEY`) before insertion into `face_templates`.
- **One-to-One (1:1) Verification Only**: TrustJuggler strictly performs 1:1 template comparisons against the authenticated rider's enrolled vector. The system never executes 1:N surveillance searches across platforms.

---

## 4. Data Retention & Storage Limitation
To prevent perpetual digital surveillance, TrustJuggler enforces automated retention lifecycles:
- **Granular Behavioral Snapshots (`behavior_snapshots`)**: Automatically purged after $N$ days (configurable via policy, default: 90 days).
- **Session Telemetry Events (`session_events`)**: High-frequency touch, motion, and network events purged after 90 days.
- **Biometric Templates (`face_templates`)**: Automatically purged when `retention_until` is reached.
- **Permanent Aggregations Preserved**: Long-term mathematical profiles (`rider_baselines`), fraud incident reports (`cases`), and regulatory audit entries (`audit_logs`) are retained for safety governance and compliance audits.
- **Admin Purge API & CLI**: Executed via authenticated `POST /admin/retention/purge` and command-line automation `make purge` (`python -m app.scripts.retention_purge --days 90`), returning verifiable counts of deleted items and retained compliance logs.

---

## 5. Role-Based Access Control (RBAC) & PII Masking
Data access is strictly segmented across organizational personas:
- **Role Scopes**:
  - `admin`: System configuration, retention purge execution, unmasked audit review.
  - `analyst` / `investigator`: Review console queue triage, investigation dossier access.
  - `rider`: Dedicated self-service view of own session explanations and personal appeal submissions.
- **Response Masking**: For analyst and investigator queries, rider PII is systematically masked:
  - Full Names: Masked to first initial and last initial (e.g., `Jane Doe` $\rightarrow$ `J*** D***`).
  - Phone Numbers: Masked preserving country code and last 3 digits (e.g., `+1 555-0199` $\rightarrow$ `+1 ***-**99`).
- **Cross-Rider Data Isolation**: Endpoints `/rider-view/sessions/{id}` and `/appeals/{id}` enforce strict ownership checks; any attempt by a rider to read or appeal another rider's records immediately triggers `403 Forbidden`.

---

## 6. Transparent Rider Explanations
Riders subject to security checks have a fundamental right to clear, non-technical explanations:
- **Zero Thresholds / Zero Internal Scores**: The rider-facing explanation (`GET /rider-view/sessions/{id}`) completely omits machine learning confidence scores, threshold numbers (e.g. 45, 60), model weights, or fraud detection rules.
- **Plain-Language Reasons**: Plain English explanations derived from `explain.rider_safe_text`:
  - *"We noticed you are delivering from a new device."*
  - *"Interaction rhythm patterns differed from regular usage baseline."*
  - *"Recent sensitive account or payout modifications were registered."*
- **Actionable Steps (`what_you_can_do`)**: Clear paths forward are provided:
  - `selfie`: Quick instant face liveness verification.
  - `otp`: One-time SMS passcode entry.
  - `appeal`: Submission of a formal redress appeal for analyst review.
  - `support`: 24/7 direct contact with safety operations.

---

## 7. Human-in-the-Loop Appeals & Redress Workflow
TrustJuggler guarantees that automated machine learning decisions are never final:
- **Submission (`POST /appeals`)**: Riders can submit formal appeals with explanation text and supporting context.
- **Analyst Adjudication (`PATCH /appeals/{id}`)**: Operations analysts review the complete 360-degree case dossier before ruling with a mandatory reviewer note:
  - **Upheld**: Security restrictions remain; documented justification provided.
  - **Overturned (Full Redress)**:
    1. Account restrictions immediately lifted (`rider.status = 'active'`).
    2. Linked fraud case marked `RESOLVED_FALSE_POSITIVE`.
    3. Eligible held payouts released to destination accounts (`RELEASED`).
    4. Rider trust score restored with a +10 points recovery bonus.
    5. Reviewer feedback snapshot recorded in `reviewer_actions` for adaptive ML policy calibration.
    6. Complete tamper-evident audit log generated (`APPEAL_OVERTURNED`).

---

## 8. Fairness Note: Biometric Facial Verification & Fallbacks
Biometric facial matching is strictly reserved as a **Level-2 Step-Up Friction Mechanism** under heightened risk triggers.

### 8.1 Demographic Variance & Sensor Equity
- **Environmental & Optical Factors**: Facial recognition accuracy significantly fluctuates under variable ambient lighting (night shifts, glare, low-cost front cameras, cracked smartphone screens).
- **Demographic Disparities**: Computer vision models can exhibit disparate false rejection rates across different skin tones, gender identities, ages, and facial hair or religious headwear.
- **Disabilities & Motor Variations**: Neurological or physical conditions (e.g., tremors, facial paralysis) can interfere with specific active micro-gestures.

### 8.2 Mandatory Protections & Fallback Safeguards
Because biometric matching is non-trivial and prone to disparate impact:
1. **Interactive 3D Liveness Checks**: Liveness verification prevents 2D static photograph spoofing and digital screen replays without penalizing genuine facial nuances.
2. **Mandatory Fallback Paths**: Any rider unable to complete facial verification can immediately choose:
   - **SMS OTP Verification**: Low-friction secondary device authentication.
   - **Document Check**: High-confidence government ID credential review.
   - **Manual Review**: Escalation to human fraud analysts without immediate account termination.
3. **No Automated Permanent Bans**: A failed facial challenge never triggers permanent account termination; it places the session in escalated investigation where a human investigator must review the context.
