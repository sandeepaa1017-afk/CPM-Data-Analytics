"""Keep generated customer IDs unique beyond 99."""
from alembic import op
import sqlalchemy as sa


revision = "0003_customer_id_overflow"
down_revision = "0002_auth_customers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "customers",
        "id",
        schema="silver",
        existing_type=sa.String(length=32),
        existing_nullable=False,
        server_default=sa.text(
            "'C' || to_char(nextval('silver.customer_id_seq'), 'FM00')"
        ),
    )


def downgrade() -> None:
    op.alter_column(
        "customers",
        "id",
        schema="silver",
        existing_type=sa.String(length=32),
        existing_nullable=False,
        server_default=sa.text(
            "'C' || lpad(nextval('silver.customer_id_seq')::text, 2, '0')"
        ),
    )
