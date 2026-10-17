from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import settings

# SQLite connection handling (check_same_thread=False for SQLite)
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG,
    future=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a transactional SQLAlchemy database session.
    Automatically closes session after request finishes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all(target_engine=None):
    """
    Initializes and creates all database tables.
    """
    eng = target_engine or engine
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=eng)


def drop_all(target_engine=None):
    """
    Drops all tables (used for test setup/teardown and demo resets).
    """
    eng = target_engine or engine
    from sqlalchemy import text

    import app.models  # noqa: F401
    try:
        with eng.connect() as conn:
            if eng.dialect.name == "sqlite":
                conn.execute(text("PRAGMA foreign_keys = OFF;"))
            conn.commit()
    except Exception:
        pass
    Base.metadata.drop_all(bind=eng)
