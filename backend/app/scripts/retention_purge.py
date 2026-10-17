#!/usr/bin/env python3
"""
CLI Script to execute retention policy purge.
Usage:
    python -m app.scripts.retention_purge --days 90
"""

import argparse
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db.session import SessionLocal  # noqa: E402
from app.services.retention_service import retention_service  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Purge expired telemetry, snapshots, and face templates.")
    parser.add_argument("--days", type=int, default=90, help="Retention period in days (default: 90)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        res = retention_service.purge_expired_data(db, days=args.days, actor="cli_admin", role="admin")
        print(f"[OK] Retention purge complete for days={args.days}:")
        print(f"     Snapshots deleted:     {res['snapshots_deleted']}")
        print(f"     Session events deleted: {res['session_events_deleted']}")
        print(f"     Face templates deleted: {res['face_templates_deleted']}")
        print(f"     Audit logs retained:   {res['audit_logs_retained']}")
        print(f"     Baselines retained:    {res['baselines_retained']}")
    except Exception as e:
        print(f"[ERROR] Failed to execute retention purge: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
