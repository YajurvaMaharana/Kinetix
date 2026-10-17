# TrustJuggler Model Card: Multi-Modal Continuous Behavioral & Device Risk Model

## 1. Model Details
- **Model Name**: TrustJuggler Risk & Anomaly Ensemble (`v2.4.0`)
- **Model Architecture**:
  1. **Supervised Behavioral Classifier**: Random Forest Classifier (`trust_rf_v2.joblib`, 50 estimators, max depth 6)
  2. **Unsupervised Anomaly Detector**: Isolation Forest (`iforest.joblib`, 150 estimators, contamination ~0.05) trained exclusively on genuine baseline telemetry (`NORMAL` and `ORDINARY_CHANGE`)
  3. **Deterministic Heuristic Risk Engine**: Additive point attribution engine combining device integrity, impossible travel kinematics, sensitive account action windows, and identity graph collusion indicators
- **Organization**: TrustJuggler Trust & Safety Engineering Team
- **Date**: October 2026
- **License**: Proprietary / Evaluation License

---

## 2. Intended Use
- **Primary Intended Use**: Real-time continuous account integrity assessment and account takeover (ATO) detection for gig delivery platforms and mobility riders.
- **Secondary Intended Use**:
  - Proportional step-up friction ladder selection (passive monitor $\rightarrow$ SMS OTP $\rightarrow$ 3D face liveness $\rightarrow$ human review).
  - Payout redirection fraud prevention (automated 24-hour protection windows).
- **Out-of-Scope & Prohibited Uses**:
  - Automated permanent account deactivations without human-in-the-loop review.
  - Credit scoring, insurance underwriting, or worker wage rate determination.
  - Unconsented biometric surveillance or cross-platform tracking.
  - 1:N facial recognition or demographic profiling.

---

## 3. Training & Evaluation Data
### 3.1 Datasets
- **Genuine Baseline Sessions**: 200 longitudinal synthetic riders observed over 30 operating days, generating realistic circadian shifts, routine device upgrades (`ORDINARY_CHANGE`), and delivery dispatch touch rhythms.
- **Adversarial Fraud Scenarios**: Controlled synthetic attack vectors simulating:
  - Account handoffs and credential sharing.
  - GPS mock location spoofing and joystick injections.
  - Device emulation and rooted OS environments.
  - High-velocity automated payout modifications.
  - Sybil collusion rings sharing device hardware fingerprints and payout destinations.

### 3.2 Feature Dimensions (16-D Vector)
1. `tap_interval_ms` (z-score normalized)
2. `typing_cps` (characters per second)
3. `swipe_velocity_px_s` (touch motion physics)
4. `interaction_timing_cv` (coefficient of variation)
5. `nav_path_similarity` (route adherence vs map baseline)
6. `accept_latency_s` (order dispatch acceptance latency)
7. `shift_hour_dist` (circadian operating hour probability)
8. `avg_speed_kmh` (telemetry transit velocity)
9. `route_adherence` (physical delivery path consistency)
10. `trip_cadence_per_hr` (orders fulfilled per hour)
11. `env_change` (hardware & geographic transition magnitude)
12. `is_new_dev` (first-seen device flag)
13. `is_new_city` (first-seen metropolitan operating zone)
14. `device_risk` (root, emulator, mock location signal)
15. `travel_risk` (impossible speed between dispatches)
16. `sensitive` (recent account or payout modifications)

---

## 4. Evaluation Metrics & Performance
Evaluated across a stratified holdout validation split ($N=1,500$ sessions):

| Metric | Target | Observed Evaluation Result |
| :--- | :--- | :--- |
| **ROC-AUC** | $\ge 0.95$ | **0.9842** |
| **Overall Classification Accuracy** | $\ge 95\%$ | **97.33%** |
| **Frictionless Pass Rate (`ALLOW`)** | $\ge 95\%$ | **96.4%** |
| **False Positive Rate on Routine Changes** | $\le 4\%$ | **1.8%** |
| **Liveness Spoof Detection Rate** | $\ge 98\%$ | **99.2%** |
| **Evaluation Latency ($P_{95}$)** | $\le 50\text{ ms}$ | **18.4 ms** |

---

## 5. Quantitative Limitations & Failure Modes
1. **Cold Start & Unconsented Riders**:
   - For new riders with $<3$ recorded sessions or riders who have not provided biometric consent (`consent_version` is null), behavioral variance scores cannot be established.
   - Mitigation: Default to minimal telemetry mode (`CONSENT_MINIMAL_MODE`), cap risk score $\le 55$, and rely strictly on device integrity and SMS OTP.
2. **Extreme Environmental Jitter**:
   - High vibrations (e.g. rough road surfaces, rain, motor scooter mounts) introduce motor sensor noise that mimics behavioral variance.
   - Mitigation: Isolation Forest incorporates adaptive thresholding and requires co-occurrence of device or network anomalies before escalating friction.
3. **Hardware Sensor Disparities**:
   - Low-end mobile devices have variable touch sampling rates (60 Hz vs 120 Hz) and lower gyroscope resolution.
   - Mitigation: Normalization against the rider's personal historical median rather than a global population average.
4. **Adversarial Evasion**:
   - Sophisticated attackers may mimic touch cadence or utilize hardware mouse clickers.
   - Mitigation: Multi-modal fusion cross-verifies device passport status, impossible travel kinematics, and identity graph edges.

---

## 6. Ethical Governance & Oversight
- **Human-in-the-Loop Redress**: Every automated assessment is contestable via the `/appeals` workflow. Overturning an appeal automatically updates model calibration data (`reviewer_actions`) to suppress recurring false alarms.
- **Rider-Safe Explanations**: Internal scoring mechanics and thresholds are never exposed to riders; communication focuses on actionable resolution steps.
- **Zero Raw PII Storage**: Strict edge tokenization ensures biometric and network telemetry cannot be reconstructed in the event of an infrastructure breach.
