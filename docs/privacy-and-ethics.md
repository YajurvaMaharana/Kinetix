# TrustJuggler v2: Privacy, Ethics & Fairness Architecture

## 1. Principles of Ethical Account Integrity
TrustJuggler operates on the principle of **Proportional Verification**:
- Legitimate delivery workers and gig economy riders must never be subjected to punitive, unexplained account suspensions or discriminatory biometric friction.
- Passive multi-modal behavioral dynamics (motor cadence, travel consistency, network continuity) serve as the first line of defense, ensuring >95% of sessions operate with zero friction (`ALLOW`).

---

## 2. Fairness Note: Biometric Facial Verification
Biometric facial matching is strictly reserved as a **Level-2 Step-Up Friction Mechanism** under heightened risk triggers (e.g. payout account updates, critical device deviations, or failed OTP verifications).

### 2.1 Demographic Variance & Sensor Equity
- **Environmental & Optical Factors**: Facial recognition accuracy significantly fluctuates under variable ambient lighting (night shifts, glare, low-cost front cameras, cracked smartphone screens).
- **Demographic Disparities**: Commercial and open-source computer vision models can exhibit disparate false rejection rates across different skin tones, gender identities, ages, and facial hair or religious headwear.
- **Disabilities & Motor Variations**: Neurological or physical conditions (e.g., tremors, facial paralysis) can interfere with specific active micro-gestures.

### 2.2 Mandatory Protections & Fallback Safeguards
Because biometric matching is non-trivial and prone to disparate impact:
1. **Interactive 3D Liveness Checks**: Liveness verification prevents 2D static photograph spoofing and digital screen replays without penalizing genuine facial nuances.
2. **Mandatory Fallback Paths**: Any rider unable to complete facial verification can immediately choose:
   - **SMS OTP Verification**: Low-friction secondary device authentication.
   - **Document Check**: High-confidence government ID credential review.
   - **Manual Review**: Escalation to human fraud analysts without immediate account termination.
3. **No Automated Bans**: A failed facial challenge never triggers permanent account termination; it places the session in escalated investigation where a human investigator must review the context.

---

## 3. Data Protection & Cryptographic Privacy Standards
TrustJuggler guarantees privacy-by-design at the API boundary:
- **Zero Raw Image Persistence**: Raw facial photographs, camera frames, and selfie uploads are **NEVER stored on disk or in databases**. Images are processed purely in-memory to extract mathematical embeddings and immediately scrubbed.
- **Fernet Encryption at Rest**: All biometric vector embeddings are encrypted using AES-128-CBC with HMAC authentication (`TJ_FERNET_KEY`) before insertion into `face_templates`.
- **One-to-One (1:1) Verification Only**: TrustJuggler strictly performs 1:1 template comparisons against the authenticated rider's enrolled vector. The system never executes 1:N surveillance searches across all platform users.
- **Data Minimization & Tokenization**: Device hardware fingerprints and IP addresses are hashed using HMAC-SHA256 (`TJ_PEPPER`) at the API edge. Raw identifiers are never stored or logged.
- **Role-Based Access Control (RBAC)**: Rider names and phone numbers are automatically masked (`Jane Doe` -> `J*** D***`) for analyst roles.
