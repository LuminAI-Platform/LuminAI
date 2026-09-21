"""Add versioning and golden_record_history table

Revision ID: 0002_golden_record_versioning
Revises: 0001_initial_schema
Create Date: 2026-09-21 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002_golden_record_versioning"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add version and updated_at to golden_records
    op.add_column(
        "golden_records",
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
    )
    op.add_column(
        "golden_records",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 2. Create golden_record_history table
    op.create_table(
        "golden_record_history",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("golden_id", sa.String(length=255), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("cluster_size", sa.Integer(), server_default="1", nullable=False),
        sa.Column("source_record_ids", sa.Text(), nullable=False),
        sa.Column("attributes", sa.Text(), nullable=False),
        sa.Column("action", sa.String(length=50), server_default="CREATED", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_golden_record_history_golden_id", "golden_record_history", ["golden_id"])
    op.create_index("ix_golden_record_history_tenant_id", "golden_record_history", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_golden_record_history_tenant_id", table_name="golden_record_history")
    op.drop_index("ix_golden_record_history_golden_id", table_name="golden_record_history")
    op.drop_table("golden_record_history")

    op.drop_column("golden_records", "updated_at")
    op.drop_column("golden_records", "version")
