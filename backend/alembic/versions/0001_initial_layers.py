"""Create Bronze, Silver, and Gold tables.

Revision ID: 0001_initial_layers
Revises:
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0001_initial_layers"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS bronze")
    op.execute("CREATE SCHEMA IF NOT EXISTS silver")
    op.execute("CREATE SCHEMA IF NOT EXISTS gold")

    op.create_table(
        "raw_calls",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("device_id", sa.String(length=128), nullable=False),
        sa.Column("employee_id", sa.String(length=64), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "batch_id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_bronze_raw_calls"),
        schema="bronze",
    )

    op.create_table(
        "employees",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_silver_employees"),
        schema="silver",
    )
    op.create_table(
        "devices",
        sa.Column("id", sa.String(length=128), nullable=False),
        sa.Column("employee_id", sa.String(length=64), nullable=False),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["silver.employees.id"],
            name="fk_silver_devices_employee_id_silver_employees",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_silver_devices"),
        schema="silver",
    )
    op.create_table(
        "calls",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("employee_id", sa.String(length=64), nullable=False),
        sa.Column("phone_normalized", sa.String(length=32), nullable=False),
        sa.Column("call_type", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("duration_sec", sa.Integer(), nullable=False),
        sa.Column("call_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.CheckConstraint(
            "call_type IN ('incoming', 'outgoing', 'missed', 'rejected')",
            name="ck_silver_calls_call_type",
        ),
        sa.CheckConstraint(
            "status IN ('answered', 'missed')",
            name="ck_silver_calls_status",
        ),
        sa.CheckConstraint(
            "duration_sec >= 0",
            name="ck_silver_calls_duration_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["silver.employees.id"],
            name="fk_silver_calls_employee_id_silver_employees",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_silver_calls"),
        sa.UniqueConstraint("source_hash", name="uq_silver_calls_source_hash"),
        schema="silver",
    )
    op.create_index(
        "ix_silver_calls_employee_call_datetime",
        "calls",
        ["employee_id", "call_datetime"],
        schema="silver",
    )
    op.create_index("ix_silver_calls_call_type", "calls", ["call_type"], schema="silver")
    op.create_index("ix_silver_calls_status", "calls", ["status"], schema="silver")
    op.create_index(
        "ix_silver_calls_phone_normalized",
        "calls",
        ["phone_normalized"],
        schema="silver",
    )

    op.create_table(
        "daily_employee_stats",
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("employee_id", sa.String(length=64), nullable=False),
        sa.Column("total", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("incoming", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("outgoing", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("missed", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("talk_seconds", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "answered_pct",
            sa.Numeric(precision=5, scale=2),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["silver.employees.id"],
            name="fk_gold_daily_employee_stats_employee_id_silver_employees",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint(
            "date",
            "employee_id",
            name="pk_gold_daily_employee_stats",
        ),
        schema="gold",
    )
    op.create_table(
        "daily_summary",
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("total", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("incoming", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("outgoing", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("missed", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("talk_seconds", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "answered_pct",
            sa.Numeric(precision=5, scale=2),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("date", name="pk_gold_daily_summary"),
        schema="gold",
    )


def downgrade() -> None:
    op.drop_table("daily_summary", schema="gold")
    op.drop_table("daily_employee_stats", schema="gold")
    op.drop_index(
        "ix_silver_calls_phone_normalized",
        table_name="calls",
        schema="silver",
    )
    op.drop_index("ix_silver_calls_status", table_name="calls", schema="silver")
    op.drop_index("ix_silver_calls_call_type", table_name="calls", schema="silver")
    op.drop_index(
        "ix_silver_calls_employee_call_datetime",
        table_name="calls",
        schema="silver",
    )
    op.drop_table("calls", schema="silver")
    op.drop_table("devices", schema="silver")
    op.drop_table("employees", schema="silver")
    op.drop_table("raw_calls", schema="bronze")
