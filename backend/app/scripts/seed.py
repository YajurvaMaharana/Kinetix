import json
import shutil
import sys
from datetime import timedelta
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import settings  # noqa: E402
from app.db.session import SessionLocal, create_all, engine  # noqa: E402
from app.models.entities import (  # noqa: E402
    AuditLog,
    BehaviorSnapshot,
    Case,
    Challenge,
    Device,
    DeviceRider,
    FraudCluster,
    PayoutAccount,
    PayoutRequest,
    PolicyConfig,
    ReviewerAction,
    Rider,
    RiderBaseline,
    RiderTrustScore,
    RiskAssessment,
    RiskFactor,
    Session,
    utcnow,
)
from app.services.privacy import tokenize  # noqa: E402


def seed_database():
    """
    Seeds local database with baseline accounts, device passports, test fixtures,
    fraud syndicates, and realistic analyst review queue cases.
    """
    print(f"[*] Initializing TrustJuggler v2 Database at: {settings.DATABASE_URL}")
    create_all(engine)

    db = SessionLocal()
    now = utcnow()

    try:
        # 1. Seed Active Behavioral Policy
        existing_policy = db.query(PolicyConfig).filter(PolicyConfig.id == "policy_v2_default").first()
        if not existing_policy:
            policy = PolicyConfig(
                id="policy_v2_default",
                version="v2.4.0",
                allow_threshold=20.0,
                monitor_threshold=50.0,
                challenge_threshold=75.0,
                escalate_threshold=80.0,
                is_active=True,
                created_at=now,
            )
            db.add(policy)

        # 2. Seed Baseline Riders
        riders_data = [
            ("rider_global_susp_7719", "Alex Mercer", "+15550197719", "alex.mercer@trustjuggler.test", "active"),
            ("rider_syndicate_node_014", "Morgan Vance", "+15550199014", "morgan.vance@trustjuggler.test", "restricted"),
            ("rider_us_south_6021", "Jordan Hayes", "+15550196021", "jordan.hayes@trustjuggler.test", "active"),
            ("rider_us_midwest_1889", "Taylor Brooks", "+15550191889", "taylor.brooks@trustjuggler.test", "active"),
            ("rider_us_west_4412", "Casey Miller", "+15550194412", "casey.miller@trustjuggler.test", "restricted"),
            ("rider_global_vpn_3301", "Sam Rivera", "+15550193301", "sam.rivera@trustjuggler.test", "active"),
            ("rider_case_1", "Robin Chen", "+15550199991", "robin.chen@trustjuggler.test", "active"),
        ]

        for rid, name, phone, email, st in riders_data:
            r = db.query(Rider).filter(Rider.id == rid).first()
            if not r:
                r = Rider(
                    id=rid,
                    display_name=name,
                    phone_number=phone,
                    email=email,
                    status=st,
                    created_at=now - timedelta(days=30),
                )
                db.add(r)
                db.flush()

                # Rider Baseline
                base = db.query(RiderBaseline).filter(RiderBaseline.rider_id == rid).first()
                if not base:
                    base = RiderBaseline(
                        id=f"base_{rid}",
                        rider_id=rid,
                        avg_speed_kmh=32.5,
                        avg_cadence_cpm=210.0,
                        home_lat=37.7749,
                        home_lng=-122.4194,
                        typical_hours="08:00-20:00",
                        updated_at=now - timedelta(days=5),
                    )
                    db.add(base)

                # Trust Score
                trust = db.query(RiderTrustScore).filter(RiderTrustScore.rider_id == rid).first()
                if not trust:
                    trust = RiderTrustScore(
                        id=f"ts_{rid}",
                        rider_id=rid,
                        trust_score=25.0 if st == "restricted" else 88.0,
                        trend="STABLE" if st != "restricted" else "DEGRADING",
                        confidence=0.92,
                        last_calculated_at=now - timedelta(hours=2),
                    )
                    db.add(trust)

        # 3. Seed Devices & Passports
        devices_data = [
            ("dev_spoof_01", "ff00112233445566778899aabbccddeeff00112233445566778899aabbccddee", "Generic Android SDK x86", "Android 12", "2.1.0", True, True, True, 15.0, "high_risk"),
            ("dev_ring_01", "778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566", "Xiaomi Redmi 9A", "Android 11", "2.3.0", False, True, False, 22.0, "high_risk"),
            ("dev_s24_01", "s24ultra_genuine_hardware_attest_9901", "Samsung Galaxy S24 Ultra", "Android 14", "2.4.0", False, False, False, 98.0, "trusted"),
            ("dev_pixel_01", "pixel8pro_genuine_hardware_attest_9902", "Google Pixel 8 Pro", "Android 14", "2.4.0", False, False, False, 95.0, "trusted"),
        ]

        for dev_id, fp, model, os_v, app_v, is_em, is_rt, mock_l, p_score, t_lvl in devices_data:
            d = db.query(Device).filter(Device.id == dev_id).first()
            if not d:
                d = Device(
                    id=dev_id,
                    fingerprint=fp,
                    model=model,
                    os_version=os_v,
                    app_version=app_v,
                    is_emulator=is_em,
                    is_rooted=is_rt,
                    mock_location_seen=mock_l,
                    network_reputation=0.15 if is_em else 0.95,
                    passport_score=p_score,
                    trust_level=t_lvl,
                    streak_count=0 if is_em else 48,
                    trust_rating=0.2 if is_em else 0.98,
                    created_at=now - timedelta(days=60),
                )
                db.add(d)

        db.flush()

        # Link Device Riders
        dev_links = [
            ("dev_spoof_01", "rider_global_susp_7719", True),
            ("dev_ring_01", "rider_syndicate_node_014", True),
            ("dev_s24_01", "rider_us_midwest_1889", True),
            ("dev_pixel_01", "rider_us_south_6021", True),
        ]
        for did, rid, is_p in dev_links:
            dl = db.query(DeviceRider).filter(DeviceRider.device_id == did, DeviceRider.rider_id == rid).first()
            if not dl:
                db.add(DeviceRider(
                    id=f"dr_{did}_{rid}",
                    device_id=did,
                    rider_id=rid,
                    is_primary=is_p,
                    first_used_at=now - timedelta(days=20),
                    last_used_at=now - timedelta(minutes=15),
                ))

        # 4. Seed Syndicate Fraud Cluster
        cluster = db.query(FraudCluster).filter(FraudCluster.id == "CLUSTER-RING-409").first()
        if not cluster:
            cluster = FraudCluster(
                id="CLUSTER-RING-409",
                name="Redmi Device Farm - Circular Collusion Syndicate",
                nodes_count=14,
                shared_identifiers="['dev_ring_01', 'act_payout_collusion_01', 'ip_subnet_185.220', 'drv_syndicate_node_014']",
                risk_score=94.5,
                status="ACTIVE",
                created_at=now - timedelta(days=3),
            )
            db.add(cluster)

        # 5. Seed Sessions
        sessions_data = [
            ("sess_spoof_9004", "rider_global_susp_7719", "drv_1120", "dev_spoof_01", "45.148.10.2", "completed", 72.4, "CHALLENGE"),
            ("sess_ring_9005", "rider_syndicate_node_014", "drv_syndicate_node_014", "dev_ring_01", "185.220.101.5", "blocked", 89.1, "ESCALATE"),
            ("sess_handoff_9003", "rider_us_south_6021", "drv_6021", "dev_pixel_01", "66.249.64.1", "challenged", 65.0, "CHALLENGE"),
            ("sess_ord_chg_9002", "rider_us_midwest_1889", "drv_1889", "dev_s24_01", "172.56.21.89", "completed", 22.0, "ALLOW"),
        ]

        for sid, rid, drv_id, did, ip, st, r_score, verd in sessions_data:
            s = db.query(Session).filter(Session.id == sid).first()
            if not s:
                s = Session(
                    id=sid,
                    rider_id=rid,
                    driver_id=drv_id,
                    device_id=did,
                    ip_address=ip,
                    status=st,
                    current_risk_score=r_score,
                    current_verdict=verd,
                    created_at=now - timedelta(minutes=45),
                    updated_at=now - timedelta(minutes=15),
                )
                db.add(s)
                db.flush()

                # Telemetry Behavior Snapshot
                db.add(BehaviorSnapshot(
                    id=f"snap_{sid}",
                    session_id=sid,
                    speed_kmh=220.0 if "spoof" in sid else 34.0,
                    acceleration_variance=0.0 if "spoof" in sid else 1.2,
                    gyro_stability=1.0 if "spoof" in sid else 0.85,
                    typing_cadence_cpm=0 if "spoof" in sid else 215.0,
                    route_deviation_pct=74.0 if "spoof" in sid else 2.0,
                    created_at=now - timedelta(minutes=30),
                ))

        # 6. Seed Risk Assessments & Factors
        assessments_data = [
            ("eval_spoof_9004", "sess_spoof_9004", 72.4, 75.0, "INVESTIGATE", "HIGH", "gps_spoof", ["GEO_SPOOF", "EMULATOR_DETECTED"], [
                ("Synthetic Device Fingerprint", "DEVICE", "NEGATIVE", 0.35, 0.05, "Android x86 SDK emulator detected with root hooks and 0.0% battery drain rate."),
                ("Mock Location Injected", "LOCATION", "NEGATIVE", 0.35, 0.02, "Mock location provider flag is true; telemetry reports impossible speed (220 km/h) with zero sensor jitter."),
                ("Biometric Absence", "BIOMETRIC", "NEGATIVE", 0.20, 0.05, "No genuine face sensor stream provided; synthetic injection detected."),
            ]),
            ("eval_ring_9005", "sess_ring_9005", 89.1, 92.0, "BLOCK", "CRITICAL", "syndicate", ["COLLUSION_RING", "DEVICE_FARM", "PAYOUT_RISK"], [
                ("Syndicate Graph Cluster Match", "GRAPH", "NEGATIVE", 0.40, 0.01, "Device hash and payout routing account directly intersect Graph Cluster 'CLUSTER-RING-409' (14 connected nodes, circular rider-driver collusion)."),
                ("Device Farm Hardware Reuse", "DEVICE", "NEGATIVE", 0.30, 0.04, "Redmi 9A device fingerprint previously bound to 9 distinct rider accounts in the last 72 hours."),
                ("High Velocity Promo Extraction", "PAYOUT", "NEGATIVE", 0.10, 0.05, "Coordinated zero-mile trip with maximum promo credit extraction."),
            ]),
            ("eval_handoff_9003", "sess_handoff_9003", 65.0, 68.0, "CHALLENGE", "HIGH", "account_handoff", ["ACCOUNT_HANDOFF"], [
                ("Biometric Identity Mismatch", "BIOMETRIC", "NEGATIVE", 0.40, 0.28, "Active face capture exhibits low cosine similarity (0.38) with enrolled rider profile."),
                ("Telemetric Dynamics Divergence", "TELEMETRY", "NEGATIVE", 0.30, 0.41, "Abrupt change in phone handling, high acceleration jitter, and keystroke cadence crash."),
            ]),
        ]

        for aid, sid, r_score, raw_r, verd, tier, clss, tags, factors in assessments_data:
            a = db.query(RiskAssessment).filter(RiskAssessment.id == aid).first()
            if not a:
                a = RiskAssessment(
                    id=aid,
                    session_id=sid,
                    risk_score=r_score,
                    raw_risk=raw_r,
                    verdict=verd,
                    risk_tier=tier,
                    classification=clss,
                    threat_tags_json=json.dumps(tags),
                    created_at=now - timedelta(minutes=40),
                )
                db.add(a)
                db.flush()

                for idx, (fname, fcat, fimp, fw, fs, fdesc) in enumerate(factors):
                    rf = RiskFactor(
                        id=f"rf_{aid}_{idx}_{fname[:8].lower().replace(' ', '_')}",
                        assessment_id=aid,
                        name=fname,
                        category=fcat,
                        impact=fimp,
                        weight=fw,
                        score=fs,
                        description=fdesc,
                    )
                    db.add(rf)

        # 7. Seed Challenges
        challenges_data = [
            ("chlg_hw_9004", "sess_spoof_9004", "rider_global_susp_7719", "DEVICE_REAUTH", "PENDING", 2, "EMULATOR_DETECTED"),
            ("chlg_face_9003", "sess_handoff_9003", "rider_us_south_6021", "FACE_LIVENESS", "PENDING", 1, "FACE_MISMATCH"),
        ]
        for cid, sid, rid, ctype, cstat, lvl, rcode in challenges_data:
            c = db.query(Challenge).filter(Challenge.id == cid).first()
            if not c:
                db.add(Challenge(
                    id=cid,
                    session_id=sid,
                    rider_id=rid,
                    challenge_type=ctype,
                    status=cstat,
                    level=lvl,
                    reason_code=rcode,
                    expires_at=now + timedelta(minutes=25),
                    created_at=now - timedelta(minutes=20),
                ))

        # 8. Seed Payout Accounts & Requests
        acc1 = db.query(PayoutAccount).filter(PayoutAccount.id == "pa_spoof_01").first()
        if not acc1:
            acc1 = PayoutAccount(
                id="pa_spoof_01",
                rider_id="rider_global_susp_7719",
                account_number_token=tokenize("ACCT-9921-US"),
                routing_token=tokenize("ROUT-021000021"),
                account_type="checking",
            )
            db.add(acc1)
            db.flush()

        payouts_data = [
            ("payout_held_9004", "rider_global_susp_7719", "sess_spoof_9004", 140.0, "HELD", "Held 24h pending emulator investigation case_spoof_9004", "chlg_hw_9004"),
            ("payout_denied_9005", "rider_syndicate_node_014", "sess_ring_9005", 95.0, "BLOCKED", "Immediate blocking due to confirmed collusion syndicate membership (CLUSTER-RING-409)", None),
        ]
        for pid, rid, sid, amt, pst, hreason, chid in payouts_data:
            pr = db.query(PayoutRequest).filter(PayoutRequest.id == pid).first()
            if not pr:
                db.add(PayoutRequest(
                    id=pid,
                    rider_id=rid,
                    session_id=sid,
                    amount=amt,
                    status=pst,
                    hold_reason=hreason,
                    reason=hreason,
                    challenge_id=chid,
                    created_at=now - timedelta(minutes=35),
                ))

        # 9. Seed Queue Cases
        cases_data = [
            (
                "case_spoof_9004",
                "sess_spoof_9004",
                "rider_global_susp_7719",
                "HIGH",
                "OPEN",
                72.4,
                "GEO_SPOOF",
                "GPS route jump (>150 km/h) & Android x86 emulator detected during trip.",
                None,
                "Automated security trigger: Emulator environment and mock provider.",
                now - timedelta(minutes=14),
            ),
            (
                "case_ring_9005",
                "sess_ring_9005",
                "rider_syndicate_node_014",
                "CRITICAL",
                "IN_REVIEW",
                89.1,
                "COLLUSION_RING",
                "Linked to active fraud syndicate CLUSTER-RING-409 (14 nodes, recycled bank account).",
                "analyst_sarah_m",
                "Escalated to syndicate investigation team. Target node in collusion ring.",
                now - timedelta(minutes=42),
            ),
            (
                "case_handoff_9003",
                "sess_handoff_9003",
                "rider_us_south_6021",
                "HIGH",
                "OPEN",
                65.0,
                "ACCOUNT_HANDOFF",
                "Mid-session biometric mismatch and erratic telemetry shift.",
                None,
                "Awaiting face liveness challenge completion.",
                now - timedelta(hours=2, minutes=10),
            ),
            (
                "case_payout_9006",
                "sess_spoof_9004",
                "rider_us_west_4412",
                "CRITICAL",
                "IN_REVIEW",
                86.5,
                "PAYOUT_REDIRECT",
                "Rapid bank account routing update followed by immediate maximum withdrawal request.",
                "analyst_alex_k",
                "Payout held pending identity verification.",
                now - timedelta(hours=3, minutes=25),
            ),
            (
                "case_gps_9007",
                None,
                "rider_global_vpn_3301",
                "MEDIUM",
                "RESOLVED_FALSE_POSITIVE",
                48.0,
                "GPS_SPOOFING",
                "Cell tower handoff latency mistaken for jump. Verified genuine rider commute.",
                "analyst_sarah_m",
                "Cleared as benign carrier jitter.",
                now - timedelta(hours=5, minutes=12),
            ),
            (
                "case_spoof_9008",
                "sess_ord_chg_9002",
                "rider_us_midwest_1889",
                "MEDIUM",
                "RESOLVED",
                22.0,
                "ORDINARY_CHANGE",
                "New Samsung S24 device observed with genuine biometric verification.",
                "analyst_alex_k",
                "Ordinary device upgrade confirmed.",
                now - timedelta(hours=7),
            ),
        ]

        for cid, sid, rid, sev, stat, rscore, tag, summary, assigned, note, ctime in cases_data:
            c = db.query(Case).filter(Case.id == cid).first()
            if not c:
                c = Case(
                    id=cid,
                    session_id=sid,
                    rider_id=rid,
                    severity=sev,
                    status=stat,
                    risk_score=rscore,
                    threat_tag=tag,
                    threat_summary=summary,
                    assigned_to=assigned,
                    notes=note,
                    created_at=ctime,
                    updated_at=ctime + timedelta(minutes=5),
                )
                db.add(c)
                db.flush()

                # Seed ReviewerAction for cases that were touched
                if stat in ("IN_REVIEW", "RESOLVED", "RESOLVED_FALSE_POSITIVE"):
                    db.add(ReviewerAction(
                        id=f"act_seed_{cid}",
                        case_id=cid,
                        reviewer_id=assigned or "analyst",
                        action_type=stat,
                        notes=note,
                        assessment_risk=rscore,
                        classification_snapshot="syndicate" if "ring" in cid else "ordinary_change",
                        threat_tag=tag,
                        created_at=ctime + timedelta(minutes=3),
                    ))
                    db.add(AuditLog(
                        id=f"audit_seed_{cid}",
                        actor=assigned or "analyst",
                        role="analyst",
                        action=f"CASE_{stat}",
                        entity_type="case",
                        entity_id=cid,
                        detail=f"Status set to {stat}: {note}",
                        created_at=ctime + timedelta(minutes=3),
                    ))

        db.commit()
        print("[+] Seeded 6 analyst review cases including 'case_spoof_9004' and 'case_ring_9005'.")
        print("[+] Seeded 14-node collusion cluster: CLUSTER-RING-409 (Redmi Device Farm).")
        print("[+] Seeded baseline test riders, devices, sessions, and biometric challenges.")
        print("[OK] Database seeding complete!")

        # Sync secondary copy to backend/trustjuggler.db if different
        root_db = Path(__file__).resolve().parents[3] / "trustjuggler.db"
        backend_db = Path(__file__).resolve().parents[2] / "trustjuggler.db"
        if root_db.exists() and root_db != backend_db:
            try:
                shutil.copy2(root_db, backend_db)
                print(f"[*] Synchronized database replica to: {backend_db}")
            except Exception as sync_err:
                print(f"[!] Note: Replica sync skipped ({sync_err})")

    except Exception as e:
        db.rollback()
        print(f"[!] Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
