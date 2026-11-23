"""Add user authentication and customer identities.

Revision ID: 0002_auth_customers
Revises: 0001_initial_layers
"""
from alembic import op
import sqlalchemy as sa


revision = "0002_auth_customers"
down_revision = "0001_initial_layers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "employees",
        sa.Column("branch", sa.String(length=120), nullable=True),
        schema="silver",
    )
    op.add_column(
        "employees",
        sa.Column("email", sa.String(length=254), nullable=True),
        schema="silver",
    )

    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("username", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("employee_id", sa.String(length=64), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "role IN ('admin', 'manager', 'employee')",
            name="ck_silver_users_role",
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["silver.employees.id"],
            name="fk_silver_users_employee_id_silver_employees",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_silver_users"),
        sa.UniqueConstraint("employee_id", name="uq_silver_users_employee_id"),
        sa.UniqueConstraint("username", name="uq_silver_users_username"),
        schema="silver",
    )
    op.execute("CREATE SEQUENCE silver.customer_id_seq START WITH 1")
    op.create_table(
        "customers",
        sa.Column("phone_normalized", sa.String(length=32), nullable=False),
        sa.Column(
            "id",
            sa.String(length=32),
            server_default=sa.text(
                "'C' || lpad(nextval('silver.customer_id_seq')::text, 2, '0')"
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint(
            "phone_normalized",
            name="pk_silver_customers",
        ),
        sa.UniqueConstraint("id", name="uq_silver_customers_id"),
        schema="silver",
    )


def downgrade() -> None:
    op.drop_table("customers", schema="silver")
    op.execute("DROP SEQUENCE silver.customer_id_seq")
    op.drop_table("users", schema="silver")
    op.drop_column("employees", "email", schema="silver")
    op.drop_column("employees", "branch", schema="silver")
