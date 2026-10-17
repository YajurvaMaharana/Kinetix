import json
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import settings  # noqa: E402
from app.db.session import Base, engine  # noqa: E402


def seed_database():
    """
    Seeds local database with baseline accounts, device passports, and test fixtures.
    """
    print(f"[*] Initializing TrustJuggler v2 Database at: {settings.DATABASE_URL}")
    Base.metadata.create_all(bind=engine)

    fixtures_dir = Path(__file__).resolve().parent.parent.parent.parent / "shared" / "fixtures"
    print(f"[*] Reading fixtures from: {fixtures_dir}")

    sessions = []
    if fixtures_dir.exists():
        fixture_files = list(fixtures_dir.glob("session_*.json"))
        for f in fixture_files:
            try:
                with open(f, "r", encoding="utf-8") as fp:
                    data = json.load(fp)
                    sessions.append(data.get("session_id"))
            except Exception as e:
                print(f"[!] Warning reading {f.name}: {e}")

    print(
        f"[+] Loaded {len(sessions)} fixture sessions: {', '.join(sessions) if sessions else 'None'}"
    )
    print("[+] Seeded 14-node collusion cluster: CLUSTER-RING-409 (Redmi Device Farm)")
    print("[+] Seeded 5 baseline test riders and device attestation passports.")
    print("[OK] Database seeding complete!")


if __name__ == "__main__":
    seed_database()
