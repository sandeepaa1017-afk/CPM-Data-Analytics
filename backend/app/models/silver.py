from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="pk_silver_employees"),
        {"schema": "silver"},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    branch: Mapped[str | None] = mapped_column(String(120), nullable=True)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        server_default=text("true"),
    )


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="pk_silver_devices"),
        {"schema": "silver"},
    )

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    employee_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey(
            "silver.employees.id",
            name="fk_silver_devices_employee_id_silver_employees",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    last_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    fcm_token: Mapped[str | None] = mapped_column(String(512), nullable=True)
    sync_request_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    sync_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    sync_request_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    sync_request_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class Call(Base):
    __tablename__ = "calls"
    __table_args__ = (
        CheckConstraint(
            "call_type IN ('incoming', 'outgoing', 'missed', 'rejected')",
            name="ck_silver_calls_call_type",
        ),
        CheckConstraint(
            "status IN ('answered', 'missed')",
            name="ck_silver_calls_status",
        ),
        CheckConstraint(
            "duration_sec >= 0",
            name="ck_silver_calls_duration_nonnegative",
        ),
        PrimaryKeyConstraint("id", name="pk_silver_calls"),
        UniqueConstraint("source_hash", name="uq_silver_calls_source_hash"),
        Index(
            "ix_silver_calls_employee_call_datetime",
            "employee_id",
            "call_datetime",
        ),
        Index("ix_silver_calls_call_type", "call_type"),
        Index("ix_silver_calls_status", "status"),
        Index("ix_silver_calls_phone_normalized", "phone_normalized"),
        {"schema": "silver"},
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    employee_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey(
            "silver.employees.id",
            name="fk_silver_calls_employee_id_silver_employees",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    phone_normalized: Mapped[str] = mapped_column(String(32), nullable=False)
    call_type: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    duration_sec: Mapped[int] = mapped_column(nullable=False)
    call_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    source_hash: Mapped[str] = mapped_column(String(64), nullable=False)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'manager', 'employee')",
            name="ck_silver_users_role",
        ),
        PrimaryKeyConstraint("id", name="pk_silver_users"),
        UniqueConstraint("employee_id", name="uq_silver_users_employee_id"),
        UniqueConstraint("username", name="uq_silver_users_username"),
        {"schema": "silver"},
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    username: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    employee_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey(
            "silver.employees.id",
            name="fk_silver_users_employee_id_silver_employees",
            ondelete="CASCADE",
        ),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        server_default=text("true"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (
        PrimaryKeyConstraint("phone_normalized", name="pk_silver_customers"),
        UniqueConstraint("id", name="uq_silver_customers_id"),
        {"schema": "silver"},
    )

    phone_normalized: Mapped[str] = mapped_column(String(32), primary_key=True)
    id: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        server_default=text("silver.next_customer_id()"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
