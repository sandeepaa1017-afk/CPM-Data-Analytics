"""Generate customer IDs without truncating values after 99."""
from alembic import op
import sqlalchemy as sa


revision = "0004_unbounded_customer_ids"
down_revision = "0003_customer_id_overflow"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION silver.next_customer_id() RETURNS text
        LANGUAGE plpgsql
        AS $$
        DECLARE
            sequence_value bigint;
        BEGIN
            sequence_value := nextval('silver.customer_id_seq');
            RETURN 'C' || lpad(
                sequence_value::text,
                greatest(2, length(sequence_value::text)),
                '0'
            );
        END;
        $$
        """
    )
    op.alter_column(
        "customers",
        "id",
        schema="silver",
        existing_type=sa.String(length=32),
        existing_nullable=False,
        server_default=sa.text("silver.next_customer_id()"),
    )


def downgrade() -> None:
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
    op.execute("DROP FUNCTION silver.next_customer_id()")
