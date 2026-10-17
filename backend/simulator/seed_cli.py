"""
TrustJuggler Seed CLI.
Executes end-to-end synthetic data generation for riders, devices, baselines,
encrypted face enrollments, payout accounts, 30-day behavioral histories,
and a 400-session held-out evaluation dataset (scenario_run_id="eval_set").
Exports CSV datasets to backend/ml/data/{train.csv,eval.csv}.

Usage:
    python -m simulator.seed_cli --riders 200 --days 30 --seed 42
"""

import argparse
import csv
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

import numpy as np

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import text  # noqa: E402

from app.db.session import SessionLocal, create_all, drop_all, engine  # noqa: E402
from app.models.entities import (  # noqa: E402
    Device,
    DeviceRider,
    FaceTemplate,
    PayoutAccount,
    Rider,
    RiderBaseline,
    RiderTrustScore,
)
from app.models.entities import (  # noqa: E402
    Session as SessionModel,
)
from simulator.attacks import (  # noqa: E402
    make_fraud_ring,
    make_gps_spoof,
    make_handoff,
    make_impossible_travel,
    make_payout_hijack,
)
from simulator.baseline import METRIC_NAMES, compute_baseline, compute_robust_z  # noqa: E402
from simulator.generator import (  # noqa: E402
    generate_history,
    generate_single_session,
    make_ordinary_change,
)
from simulator.personas import RiderPersona, generate_persona  # noqa: E402


def extract_csv_row(sess: Dict[str, Any], baseline_metrics: Dict[str, Dict[str, float]]) -> Dict[str, Any]:
    """Flattens a session dictionary into a CSV-friendly row."""
    is_new_dev = sess.get("threat_tags", []) == ["ORDINARY_CHANGE"] and "new_phone" in sess.get("session_id", "")
    row = {
        "session_id": sess["session_id"],
        "rider_id": sess["rider_id"],
        "device_id": sess["device_id"],
        "device_fingerprint": sess["device_fingerprint"],
        "ip_address": sess["ip_address"],
        "city": sess.get("city", "Mumbai"),
        "zone_id": sess.get("zone_id", ""),
        "latitude": sess.get("latitude", 0.0),
        "longitude": sess.get("longitude", 0.0),
        "start_hour": sess.get("start_hour", 12.0),
        "created_at": sess.get("created_at", ""),
        "label": sess.get("label", "normal"),
        "ground_truth_label": sess.get("ground_truth_label", "normal"),
        "threat_tags": ";".join(sess.get("threat_tags", [])),
        "scenario_run_id": sess.get("scenario_run_id", ""),
        # 10 Behavior Metrics
        "tap_interval_ms": sess.get("tap_interval_ms", 0.0),
        "typing_cps": sess.get("typing_cps", 0.0),
        "swipe_velocity_px_s": sess.get("swipe_velocity_px_s", 0.0),
        "interaction_timing_cv": sess.get("interaction_timing_cv", 0.0),
        "nav_path_similarity": sess.get("nav_path_similarity", 0.0),
        "accept_latency_s": sess.get("accept_latency_s", 0.0),
        "shift_hour_dist": sess.get("shift_hour_dist", 0.0),
        "avg_speed_kmh": sess.get("avg_speed_kmh", 0.0),
        "route_adherence": sess.get("route_adherence", 0.0),
        "trip_cadence_per_hr": sess.get("trip_cadence_per_hr", 0.0),
    }

    # Robust z-scores against baseline
    for m in METRIC_NAMES:
        val = sess.get(m, 0.0)
        row[f"z_{m}"] = compute_robust_z(val, m, baseline_metrics, new_device=is_new_dev)

    # Telemetry and contextual signals
    telem = sess.get("telemetry", {})
    biom = sess.get("biometrics", {})
    row["mock_location_detected"] = int(telem.get("mock_location_detected", False))
    row["speed_variance"] = telem.get("speed_variance", 15.0)
    row["straightness_ratio"] = telem.get("straightness_ratio", 0.82)
    row["is_emulator"] = int(sess.get("is_emulator", False))
    row["is_rooted"] = int(sess.get("is_rooted", False))
    row["face_match_confidence"] = biom.get("face_match_confidence", 0.95)
    row["liveness_score"] = biom.get("liveness_score", 0.95)
    row["impossible_travel"] = int(telem.get("impossible_travel_detected", False))
    row["concurrent_session"] = int(telem.get("concurrent_session_detected", False))
    row["shared_device_count"] = telem.get("shared_device_count", 1)
    row["shared_payout_count"] = telem.get("shared_payout_count", 1)

    return row


def run_seeding(
    n_riders: int = 200,
    n_days: int = 30,
    seed: int = 42,
    persist_db: bool = True,
) -> Dict[str, Any]:
    """
    Main seeding routine. Generates personas, histories, baselines, and held-out eval set.
    Writes train.csv and eval.csv.
    """
    start_time = time.perf_counter()
    rng = np.random.RandomState(seed)

    print(f"[*] Starting TrustJuggler Simulator Seeding (riders={n_riders}, days={n_days}, seed={seed})...")

    # Re-create database tables cleanly if persisting to DB
    if persist_db:
        drop_all(engine)
        create_all(engine)
        # SQLite speed optimizations for bulk loading
        with engine.connect() as conn:
            conn.execute(text("PRAGMA synchronous = OFF;"))
            conn.execute(text("PRAGMA journal_mode = MEMORY;"))
            conn.commit()

    # 1. Sample Rider Personas
    print(f"[*] Sampling {n_riders} RiderPersonas across 5 Indian metro cities...")
    personas: List[RiderPersona] = []
    for idx in range(n_riders):
        p = generate_persona(idx, rng)
        personas.append(p)

    # 2. Generate 30 days of history and calculate baseline profiles
    print(f"[*] Generating {n_days}-day history trajectories and computing baselines...")
    rider_histories: Dict[str, List[Dict[str, Any]]] = {}
    rider_baselines: Dict[str, Dict[str, Any]] = {}
    train_rows: List[Dict[str, Any]] = []

    # DB Entities buffers for bulk insert
    db_riders = []
    db_devices = []
    db_device_riders = []
    db_faces = []
    db_payouts = []
    db_baselines = []
    db_trust_scores = []
    db_sessions = []

    for p in personas:
        hist = generate_history(p, days=n_days, rng=rng)
        rider_histories[p.rider_id] = hist

        # Shared compute_baseline
        baseline = compute_baseline(hist)
        rider_baselines[p.rider_id] = baseline

        # Add sample of history sessions to training set
        for s in hist[-5:]:  # Last 5 normal sessions from each rider
            train_rows.append(extract_csv_row(s, baseline["metrics"]))

        if persist_db:
            db_riders.append({
                "id": p.rider_id,
                "display_name": p.display_name,
                "phone_number": p.phone_number,
                "email": f"{p.rider_id}@trustjuggler.internal",
                "status": "active",
            })
            db_devices.append({
                "id": p.primary_device["id"],
                "fingerprint": p.primary_device["fingerprint"],
                "model": p.primary_device["model"],
                "os_version": p.primary_device["os_version"],
                "app_version": p.primary_device["app_version"],
                "is_emulator": p.primary_device["is_emulator"],
                "is_rooted": p.primary_device["is_rooted"],
                "trust_rating": p.primary_device["trust_rating"],
            })
            db_device_riders.append({
                "id": f"dr_{p.rider_id}_{p.primary_device['id']}",
                "device_id": p.primary_device["id"],
                "rider_id": p.rider_id,
                "is_primary": True,
            })
            db_faces.append({
                "id": p.face_id,
                "rider_id": p.rider_id,
                "template_version": "v1",
                "embedding_hash": p.face_embedding_hash,
                "encrypted_embedding": p.encrypted_face_embedding,
            })
            db_payouts.append({
                "id": p.payout_account["id"],
                "rider_id": p.rider_id,
                "account_number_token": p.payout_account["account_token"],
                "routing_token": p.payout_account["routing_token"],
                "account_type": p.payout_account["account_type"],
                "is_flagged": False,
            })
            db_baselines.append({
                "id": f"base_{p.rider_id}",
                "rider_id": p.rider_id,
                "avg_speed_kmh": baseline["metrics"]["avg_speed_kmh"]["median"],
                "avg_cadence_cpm": baseline["metrics"]["trip_cadence_per_hr"]["median"] * 60.0,
                "home_lat": baseline["home_lat"],
                "home_lng": baseline["home_lng"],
                "typical_hours": baseline["typical_hours"],
                "metrics_json": json.dumps(baseline["metrics"]),
                "profiles_json": json.dumps({
                    "zone_profile": baseline["zone_profile"],
                    "hour_profile": baseline["hour_profile"],
                    "nav_profile": baseline["nav_profile"],
                }),
            })
            db_trust_scores.append({
                "id": f"trust_{p.rider_id}",
                "rider_id": p.rider_id,
                "trust_score": 92.0,
                "trend": "STABLE",
                "confidence": 0.95,
            })

    # 3. Build Held-out Evaluation Set (scenario_run_id='eval_set')
    # Required: 150 normal, 100 ordinary_change, 150 attacks (incl. >= 6 fraud rings)
    print("[*] Generating 400 held-out evaluation sessions (scenario_run_id='eval_set')...")
    eval_sessions: List[Dict[str, Any]] = []

    # A. 150 Normal Sessions
    for i in range(150):
        rider_p = personas[i % len(personas)]
        sess = generate_single_session(
            persona=rider_p,
            session_id=f"sess_eval_norm_{i:03d}",
            timestamp=time_offset(day=31, hour_idx=i % 24),
            rng=rng,
            label="normal",
            ground_truth_label="normal",
            scenario_run_id="eval_set",
        )
        eval_sessions.append(sess)

    # B. 100 Ordinary Change Sessions
    kinds = ["new_phone", "relocation", "new_zone", "new_phone_and_zone"]
    for i in range(100):
        rider_p = personas[(i + 15) % len(personas)]
        kind = kinds[i % len(kinds)]
        sess = make_ordinary_change(
            persona=rider_p,
            kind=kind,
            day_idx=32,
            rng=rng,
        )
        sess["session_id"] = f"sess_eval_ord_{i:03d}_{kind}"
        sess["scenario_run_id"] = "eval_set"
        eval_sessions.append(sess)

    # C. 150 Attack Sessions
    # 1. Classic Handoff: 30 sessions
    for i in range(30):
        victim = personas[i % len(personas)]
        attacker = personas[(i + 50) % len(personas)]
        sess = make_handoff(victim, attacker, variant="classic", day_idx=33, rng=rng)
        sess["session_id"] = f"sess_eval_atk_handoff_classic_{i:03d}"
        sess["scenario_run_id"] = "eval_set"
        eval_sessions.append(sess)

    # 2. No-Selfie Handoff: 15 sessions
    for i in range(15):
        victim = personas[(i + 30) % len(personas)]
        attacker = personas[(i + 80) % len(personas)]
        sess = make_handoff(victim, attacker, variant="no_selfie", day_idx=33, rng=rng)
        sess["session_id"] = f"sess_eval_atk_handoff_noselfie_{i:03d}"
        sess["scenario_run_id"] = "eval_set"
        eval_sessions.append(sess)

    # 3. Concurrent Handoff: 15 sessions
    for i in range(15):
        victim = personas[(i + 45) % len(personas)]
        attacker = personas[(i + 95) % len(personas)]
        sess = make_handoff(victim, attacker, variant="concurrent", day_idx=33, rng=rng)
        sess["session_id"] = f"sess_eval_atk_handoff_concurrent_{i:03d}"
        sess["scenario_run_id"] = "eval_set"
        eval_sessions.append(sess)

    # 4. Slow Burn Handoff: 15 sessions
    for i in range(15):
        victim = personas[(i + 60) % len(personas)]
        attacker = personas[(i + 110) % len(personas)]
        sess = make_handoff(victim, attacker, variant="slow_burn", day_idx=33, rng=rng)
        sess["session_id"] = f"sess_eval_atk_handoff_slowburn_{i:03d}"
        sess["scenario_run_id"] = "eval_set"
        eval_sessions.append(sess)

    # 5. GPS Spoof: 20 sessions
    for i in range(20):
        rider_p = personas[(i + 75) % len(personas)]
        sess = make_gps_spoof(rider_p, day_idx=34, rng=rng)
        sess["session_id"] = f"sess_eval_atk_spoof_{i:03d}"
        sess["scenario_run_id"] = "eval_set"
        eval_sessions.append(sess)

    # 6. Impossible Travel: 15 sessions
    for i in range(15):
        rider_p = personas[(i + 95) % len(personas)]
        sess = make_impossible_travel(rider_p, day_idx=34, rng=rng)
        sess["session_id"] = f"sess_eval_atk_imptravel_{i:03d}"
        sess["scenario_run_id"] = "eval_set"
        eval_sessions.append(sess)

    # 7. Payout Redirect Hijack: 20 sessions
    for i in range(20):
        rider_p = personas[(i + 110) % len(personas)]
        sess = make_payout_hijack(rider_p, day_idx=35, rng=rng)
        sess["session_id"] = f"sess_eval_atk_payout_{i:03d}"
        sess["scenario_run_id"] = "eval_set"
        eval_sessions.append(sess)

    # 8. Fraud Rings: >= 6 rings, total 20 sessions (4 rings of 3, 2 rings of 4 = 20)
    ring_configs = [3, 3, 3, 3, 4, 4]  # 6 distinct rings
    ring_rider_cursor = 130
    ring_count = len(ring_configs)
    for r_idx, ring_size in enumerate(ring_configs):
        ring_personas = personas[ring_rider_cursor : ring_rider_cursor + ring_size]
        ring_rider_cursor += ring_size
        ring_sess_list = make_fraud_ring(
            personas=ring_personas,
            ring_id=f"ring_{r_idx + 1:02d}",
            day_idx=35,
            rng=rng,
        )
        for s in ring_sess_list:
            s["scenario_run_id"] = "eval_set"
            eval_sessions.append(s)

    # 4. Prepare Evaluation CSV Rows
    eval_rows: List[Dict[str, Any]] = []
    for s in eval_sessions:
        r_base = rider_baselines.get(s["rider_id"], {}).get("metrics", {})
        eval_rows.append(extract_csv_row(s, r_base))

        if persist_db:
            db_sessions.append({
                "id": s["session_id"],
                "rider_id": s["rider_id"],
                "device_id": s["device_id"],
                "status": "COMPLETED",
                "ip_address": s["ip_address"],
                "current_risk_score": 10.0 if s["label"] == "normal" else (35.0 if s["label"] == "ordinary_change" else 85.0),
                "current_verdict": "ALLOW" if s["label"] == "normal" else ("MONITOR" if s["label"] == "ordinary_change" else "ESCALATE"),
                "scenario_run_id": s.get("scenario_run_id"),
                "ground_truth_label": s.get("ground_truth_label"),
            })

    # 5. Database Batch Insertions
    if persist_db:
        print("[*] Persisting entities into SQLite database...")
        db = SessionLocal()
        try:
            db.bulk_insert_mappings(Rider, db_riders)
            db.bulk_insert_mappings(Device, db_devices)
            db.bulk_insert_mappings(DeviceRider, db_device_riders)
            db.bulk_insert_mappings(FaceTemplate, db_faces)
            db.bulk_insert_mappings(PayoutAccount, db_payouts)
            db.bulk_insert_mappings(RiderBaseline, db_baselines)
            db.bulk_insert_mappings(RiderTrustScore, db_trust_scores)
            db.bulk_insert_mappings(SessionModel, db_sessions)
            db.commit()
        finally:
            db.close()

    # 6. Export CSV Datasets
    data_dir = backend_dir / "ml" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    train_csv_path = data_dir / "train.csv"
    eval_csv_path = data_dir / "eval.csv"

    print(f"[*] Exporting CSV datasets to {data_dir}...")
    if train_rows:
        with open(train_csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(train_rows[0].keys()))
            writer.writeheader()
            writer.writerows(train_rows)

    if eval_rows:
        with open(eval_csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(eval_rows[0].keys()))
            writer.writeheader()
            writer.writerows(eval_rows)

    elapsed_s = round(time.perf_counter() - start_time, 2)

    # 7. Print Formatted Label Summary
    normal_eval_count = sum(1 for s in eval_sessions if s["label"] == "normal")
    ord_eval_count = sum(1 for s in eval_sessions if s["label"] == "ordinary_change")
    atk_eval_count = sum(1 for s in eval_sessions if s["label"] == "suspected_handoff")

    print("\n" + "=" * 70)
    print("TrustJuggler Synthetic Seeding & Evaluation Dataset Summary")
    print("=" * 70)
    print(f"Riders Seeded:          {n_riders}")
    print(f"Historical Days:        {n_days}")
    print(f"Rider Baselines:        {len(rider_baselines)} (10 metrics + zone/hour/nav profiles)")
    print(f"Face Enrollments:       {len(db_faces)} (Fernet encrypted)")
    print(f"Payout Accounts:        {len(db_payouts)} (HMAC tokenized)")
    print("-" * 70)
    print("Held-out Evaluation Set (scenario_run_id='eval_set'):")
    print(f"  - normal:             {normal_eval_count}")
    print(f"  - ordinary_change:    {ord_eval_count}")
    print(f"  - attacks:            {atk_eval_count}")
    print("    * handoff_classic:        30")
    print("    * handoff_no_selfie:      15")
    print("    * handoff_concurrent:     15")
    print("    * handoff_slow_burn:      15")
    print("    * gps_spoof:              20")
    print("    * impossible_travel:      15")
    print("    * payout_hijack:          20")
    print(f"    * fraud_rings ({ring_count} rings):  20")
    print(f"  - Total Eval Sessions: {len(eval_sessions)}")
    print("-" * 70)
    print("Exported Datasets:")
    print(f"  - Train CSV:  {train_csv_path} ({len(train_rows)} rows)")
    print(f"  - Eval CSV:   {eval_csv_path} ({len(eval_rows)} rows)")
    print(f"Seeding Execution Time: {elapsed_s} seconds (ACCEPTANCE: < 30s)")
    print("=" * 70 + "\n")

    return {
        "riders_count": n_riders,
        "eval_sessions_count": len(eval_sessions),
        "normal_eval_count": normal_eval_count,
        "ordinary_change_count": ord_eval_count,
        "attacks_count": atk_eval_count,
        "train_rows_count": len(train_rows),
        "elapsed_seconds": elapsed_s,
        "train_csv_path": str(train_csv_path),
        "eval_csv_path": str(eval_csv_path),
        "ring_count": ring_count,
    }


def time_offset(day: int, hour_idx: int) -> Any:
    """Helper for reproducible timestamp offset."""
    from datetime import datetime, timedelta, timezone
    base = datetime.now(timezone.utc) + timedelta(days=day)
    return base.replace(hour=hour_idx % 24, minute=15, second=0, microsecond=0)


def main():
    parser = argparse.ArgumentParser(description="TrustJuggler Simulator Seeding CLI")
    parser.add_argument("--riders", type=int, default=200, help="Number of riders to seed")
    parser.add_argument("--days", type=int, default=30, help="Days of historical sessions")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed")
    parser.add_argument("--no-db", action="store_true", help="Skip SQLite database persistence")

    args = parser.parse_args()
    run_seeding(
        n_riders=args.riders,
        n_days=args.days,
        seed=args.seed,
        persist_db=not args.no_db,
    )


if __name__ == "__main__":
    main()
