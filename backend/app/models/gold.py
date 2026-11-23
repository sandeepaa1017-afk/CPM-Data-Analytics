from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Date as SQLDate,
    ForeignKey,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class DailyEmployeeStat(Base):
    __tablename__ = "daily_employee_stats"
    __table_args__ = (
        PrimaryKeyConstraint(
            "date",
            "employee_id",
            name="pk_gold_daily_employee_stats",
        ),
        {"schema": "gold"},
    )

    date: Mapped[date] = mapped_column(SQLDate, primary_key=True)
    employee_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey(
            "silver.employees.id",
            name="fk_gold_daily_employee_stats_employee_id_silver_employees",
            ondelete="RESTRICT",
        ),
        primary_key=True,
    )
    total: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    incoming: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    outgoing: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    missed: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    talk_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
    )
    answered_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        server_default=text("0"),
    )


class DailySummary(Base):
    __tablename__ = "daily_summary"
    __table_args__ = (
        PrimaryKeyConstraint("date", name="pk_gold_daily_summary"),
        {"schema": "gold"},
    )

    date: Mapped[date] = mapped_column(SQLDate, primary_key=True)
    total: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    incoming: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    outgoing: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    missed: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    talk_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
    )
    answered_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        server_default=text("0"),
    )
