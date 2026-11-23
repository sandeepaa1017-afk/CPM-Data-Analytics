"""Store push registration and manager sync requests on devices."""
from alembic import op
import sqlalchemy as sa


revision = "0005_manager_push_sync"
down_revision = "0004_unbounded_customer_ids"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "devices",
        sa.Column("fcm_token", sa.String(length=512), nullable=True),
        schema="silver",
    )
    op.add_column(
        "devices",
        sa.Column("sync_request_id", sa.String(length=36), nullable=True),
        schema="silver",
    )
    op.add_column(
        "devices",
        sa.Column("sync_requested_at", sa.DateTime(timezone=True), nullable=True),
        schema="silver",
    )
    op.add_column(
        "devices",
        sa.Column("sync_request_status", sa.String(length=16), nullable=True),
        schema="silver",
    )
    op.add_column(
        "devices",
        sa.Column("sync_request_message", sa.Text(), nullable=True),
        schema="silver",
    )


def downgrade() -> None:
    op.drop_column("devices", "sync_request_message", schema="silver")
    op.drop_column("devices", "sync_request_status", schema="silver")
    op.drop_column("devices", "sync_requested_at", schema="silver")
    op.drop_column("devices", "sync_request_id", schema="silver")
    op.drop_column("devices", "fcm_token", schema="silver")
