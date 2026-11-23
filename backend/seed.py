from sqlalchemy import select

from app.config import get_settings
from app.db import SessionLocal
from app.models.silver import User
from app.security import hash_password


def seed() -> None:
    settings = get_settings()
    if not settings.admin_username or not settings.admin_password:
        raise RuntimeError(
            "Set ADMIN_USERNAME and ADMIN_PASSWORD in backend/.env before seeding."
        )

    with SessionLocal() as db:
        existing_admin = db.scalar(
            select(User).where(User.username == settings.admin_username.strip())
        )
        if existing_admin is None:
            db.add(
                User(
                    username=settings.admin_username.strip(),
                    password_hash=hash_password(settings.admin_password),
                    role="admin",
                )
            )
        elif existing_admin.role != "admin":
            raise RuntimeError("ADMIN_USERNAME is already assigned to a non-admin user.")

        db.commit()

    print("Admin account checked; no sample employees or calls were created.")


if __name__ == "__main__":
    seed()
