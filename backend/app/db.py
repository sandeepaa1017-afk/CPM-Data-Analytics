from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings, normalize_database_url


settings = get_settings()
engine = create_engine(
    normalize_database_url(
        settings.database_url,
        require_ssl=settings.app_env == "production",
    ),
    pool_pre_ping=True,
    connect_args={"options": "-c timezone=Asia/Kolkata"},
)
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
