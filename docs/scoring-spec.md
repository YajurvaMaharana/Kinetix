# TrustJuggler v2 Scoring & Simulation Specification

This document specifies the real-time scoring engine mathematics, policy decision thresholds, biometrics processing, and the synthetic data generator architecture for the TrustJuggler Account Integrity Platform.

---

## 1. Decision Tiers & Dynamic Policy Thresholds

TrustJuggler maps raw risk scores ($[0, 100]$) into four operational action bands:

| Decision Band | Risk Score Range | Primary Action / Intervention |
|---|---|---|
| **ALLOW** | 0 – 24 | Frictionless dispatch; session marked clean |
| **MONITOR** | 25 – 44 | Passive telemetry enrichment; elevated surveillance |
| **CHALLENGE** | 45 – 74 | Step-up authentication: **OTP (45–59)** or **Liveness Selfie (60–74)** |
| **ESCALATE** | 75 – 100 | Immediate dispatch hold, automated case generation, analyst review |

### Dynamic Trust Health Adjustments
- Rider historical trust health shifts the **MONITOR** and **CHALLENGE** boundaries dynamically by up to $\pm 5$ points.
- **Critical Policy Invariant**: The **ESCALATE** threshold ($75$) and deterministic rule floors **NEVER** move.

---

## 2. The 10 Behavior Metrics

All mid-session and login events evaluate 10 continuous behavioral telemetry metrics. Each metric is normalized using a robust z-score computed against the rider's personal historical baseline (median and median absolute deviation [MAD]):

$$\text{Robust } z = \frac{|x - \text{median}|}{1.4826 \times \max(\text{MAD}, \epsilon)}$$

> **New Device Attenuation**: When a session is initiated on a new device, touch and typing biometrics (`tap_interval_ms`, `typing_cps`, `swipe_velocity_px_s`) are attenuated by **$0.5\times$** to avoid penalizing hardware/keyboard form-factor changes.

### Metric Catalog

| # | Metric Name | Typical Range | Unit | Physical & Behavioral Interpretation |
|---|---|---|---|---|
| 1 | `tap_interval_ms` | 120 – 260 | ms | In-app button tap duration and tactile dwell timing |
| 2 | `typing_cps` | 2.5 – 6.5 | chars/sec | Text typing cadence during customer/support messaging |
| 3 | `swipe_velocity_px_s` | 600 – 1600 | px/s | Order swipe and drawer scroll velocity |
| 4 | `interaction_timing_cv` | 0.15 – 0.50 | ratio | Coefficient of variation in touch event intervals |
| 5 | `nav_path_similarity` | 0.70 – 0.95 | cosine sim | Cosine similarity vs rider's screen transition Markov matrix |
| 6 | `accept_latency_s` | 2.0 – 14.0 | sec | Latency between order offer broadcast and rider acceptance |
| 7 | `shift_hour_dist` | 0.0 – 8.0 | hours | Circular distance from rider's typical shift start mean |
| 8 | `avg_speed_kmh` | 15.0 – 38.0 | km/h | Average vehicle speed over delivery legs |
| 9 | `route_adherence` | 0.70 – 0.97 | ratio | Adherence to expected urban street network trajectories |
| 10 | `trip_cadence_per_hr` | 1.2 – 4.0 | trips/hr | Completed order turnaround frequency |

---

## 3. Scoring Formulation & Rules Engine

### Raw Risk Formulation
The raw continuous risk score is a composite multi-modal weighted equation:

$$\begin{aligned}
\text{raw} = \;& 38 \times \text{behavior\_dev} + 12 \times \text{anomaly} + 18 \times \text{sensitive} \\
& + 10 \times \text{env} + 16 \times (\text{env} \times \text{behavior\_dev}) + 10 \times \text{device\_risk} \\
& + 12 \times \text{graph\_risk} + \text{rule\_points} \\
& - (12 \times \text{continuity} + 5 \times \text{known\_zone} + 4 \times \text{trusted\_device} + 4 \times \text{trust\_health\_bonus})
\end{aligned}$$

Clamped to $[0, 100]$.

### Temporal Smoothing
Mid-session risks are smoothed across events to prevent single-event spikes:

$$\text{risk}_t = \max(\text{new}, 0.7 \times \text{prev} + 0.3 \times \text{new})$$

### Invariant Bounds & Overrides
- **`ordinary_change`**: Caps maximum risk score at **$44$** (guarantees no CHALLENGE or ESCALATE for genuine life changes).
- **`suspected_handoff`**: Floors minimum risk score at **$75$** (guarantees ESCALATE).

### Deterministic Rule Floors

| Threat Rule Code | Added Points | Mandatory Floor | Threat Tag |
|---|---|---|---|
| `IMPOSSIBLE_TRAVEL` | $+25$ | Floor $60$ | `IMPOSSIBLE_TRAVEL` |
| `GPS_SPOOFING` | $+20$ | Floor $60$ | `GPS_SPOOFING` |
| `CONCURRENT_SESSION` | $+20$ | Floor $60$ | `ACCOUNT_HANDOFF` |
| `FACE_MISMATCH` | $+30$ | Floor $75$ | `ACCOUNT_HANDOFF` |
| `LIVENESS_FAILED` | $+30$ | Floor $75$ | `ACCOUNT_HANDOFF` |
| `MULTI_ACCOUNT_DEVICE_RING` | $+15$ | Floor $60$ | `FRAUD_RING` |

---

## 4. Simulation Engine Specification

The synthetic generator (`backend/simulator/`) produces $100\%$ realistic, privacy-compliant synthetic data reflecting Indian urban delivery operations.

### Persona Generation (`personas.py`)
- **Seeded Determinism**: All personas and sessions are parameterized by `np.random.RandomState(seed)`.
- **Metro Geographies**: 5 Tier-1 Indian cities, each configured with 5 distinct delivery zones and precise GPS centroids:
  - **Mumbai**: Bandra West, Andheri East, Powai, Dadar, Colaba
  - **Pune**: Kothrud, Viman Nagar, Hinjewadi, Koregaon Park, Baner
  - **Bengaluru**: Koramangala, Indiranagar, Whitefield, HSR Layout, Electronic City
  - **Delhi**: Connaught Place, Hauz Khas, Saket, Dwarka, Rohini
  - **Hyderabad**: HITEC City, Madhapur, Banjara Hills, Gachibowli, Secunderabad
- **Hardware Profile**: Popular Indian delivery handsets (Redmi Note 12, Samsung M34, Realme 11, OnePlus Nord CE 3, Vivo T2, POCO X5, Moto G54), Android 12–14.
- **Biometric Identity**:
  - Enrolled Face: 128-dimensional synthetic unit vector, encrypted using **Fernet** (`settings.TJ_FERNET_KEY`) and hashed with SHA-256 (`embedding_hash`). No raw image data is stored.
  - Payout Account: Tokenized account and routing identifiers (`tokenize()` via HMAC-SHA256 with `settings.TJ_PEPPER`).
- **Markov Navigation Transitions**: $7 \times 7$ screen transition probability matrix over `['home', 'orders_list', 'order_detail', 'navigation', 'customer_chat', 'earnings', 'profile']`.
- **Spread Invariant**: Within-rider noise ($SD \approx 6-10\%$ of range) is strictly smaller than between-rider variance ($p < 0.001$).

### Event & History Generation (`generator.py`)
- **Normal History**: Generates 30 days of authentic delivery shifts per persona, including:
  - Plausible location pings along urban road curvature with realistic speed variations and GPS noise ($\pm 0.0003^\circ$).
  - Order state machine events (`trip_accepted`, `trip_picked_up`, `trip_completed`).
  - Screen navigation walks governed by the persona's Markov matrix.
  - Baseline computation via `compute_baseline()`.
- **Ordinary Life Changes (`make_ordinary_change`)**:
  - `new_phone`: New device token, $5-20\%$ touch biometrics shift, core behavior unchanged.
  - `relocation`: Inter-city relocation with gradual shift across sessions.
  - `new_zone`: Delivery in a novel city zone.
  - `new_phone_and_zone`: Combined hardware update and zone expansion.
  - Ground truth and label: `ordinary_change`.

### Attack Archetypes (`attacks.py`)
- **Account Handoffs (`make_handoff`)**:
  - Variants: `classic`, `no_selfie`, `concurrent`, `slow_burn`.
  - Session biometrics and telemetry driven by a distinct adversary persona.
- **GPS Spoofing (`make_gps_spoof`)**:
  - `mock_location_detected = True`.
  - Straightness ratio $\ge 0.998$, speed variance $\le 0.05\text{ km/h}$.
- **Impossible Travel (`make_impossible_travel`)**:
  - Teleportation jump across distant cities within $10$ minutes ($> 4000\text{ km/h}$).
- **Fraud Rings (`make_fraud_ring`)**:
  - Collusion clusters ($3 - 6$ riders) sharing identical hardware device token, bank payout token, and IP subnet token, exhibiting emulator signatures (`is_emulator = True`).
- **Payout Hijack (`make_payout_hijack`)**:
  - Unauthorized payout destination replacement followed immediately by an automated withdrawal request within seconds.

---

## 5. Seeding CLI & Evaluation Dataset (`seed_cli.py`)

### Execution Command
```bash
python -m simulator.seed_cli --riders 200 --days 30 --seed 42
```

### Performance SLA
- Target execution time: **$< 30$ seconds** for 200 riders $\times$ 30 days of history + 400 evaluation sessions + SQLite persistence + CSV export.
- Actual benchmark: **$\approx 17.5$ seconds**.

### Held-out Evaluation Set (`scenario_run_id="eval_set"`)
A balanced 400-session test corpus:
- **150 Normal Sessions**: Legitimate shifts matching rider baselines.
- **100 Ordinary Change Sessions**: 25 `new_phone`, 25 `relocation`, 25 `new_zone`, 25 `new_phone_and_zone`.
- **150 Attack Sessions**:
  - 30 Classic Handoff
  - 15 No-Selfie Handoff
  - 15 Concurrent Handoff
  - 15 Slow Burn Handoff
  - 20 GPS Spoof
  - 15 Impossible Travel
  - 20 Payout Hijack
  - 20 Fraud Ring members across $\ge 6$ independent collusion clusters

### Exported Datasets
- `backend/ml/data/train.csv`: 1,000 representative historical baseline sessions for model training.
- `backend/ml/data/eval.csv`: 400 held-out evaluation sessions with all 10 metrics, robust z-scores, telemetry signals, and ground truth labels.
