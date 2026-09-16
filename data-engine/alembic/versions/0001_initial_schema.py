"""Initial schema for LuminAI Data Engine

Revision ID: 0001_initial_schema
Revises: None
Create Date: 2026-09-16 22:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. staging_records
    op.create_table(
        "staging_records",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("source_id", sa.String(length=255), nullable=False),
        sa.Column("raw_id", sa.String(length=255), nullable=True),
        sa.Column("data", sa.Text(), nullable=False),
        sa.Column("staged_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_staging_records_tenant_id", "staging_records", ["tenant_id"])
    op.create_index("ix_staging_records_source_id", "staging_records", ["source_id"])

    # 2. golden_records
    op.create_table(
        "golden_records",
        sa.Column("golden_id", sa.String(length=255), primary_key=True, nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("cluster_size", sa.Integer(), server_default="1", nullable=False),
        sa.Column("source_record_ids", sa.Text(), nullable=False),
        sa.Column("attributes", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_golden_records_tenant_id", "golden_records", ["tenant_id"])

    # 3. er_candidates
    op.create_table(
        "er_candidates",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("record_id_a", sa.String(length=255), nullable=False),
        sa.Column("record_id_b", sa.String(length=255), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="PENDING", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_er_candidates_tenant_id", "er_candidates", ["tenant_id"])
    op.create_index("ix_er_candidates_status", "er_candidates", ["status"])

    # 4. provenance
    op.create_table(
        "provenance",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("golden_id", sa.String(length=255), nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("attribute_name", sa.String(length=255), nullable=False),
        sa.Column("attribute_value", sa.Text(), nullable=True),
        sa.Column("source_record_id", sa.String(length=255), nullable=False),
        sa.Column("source_id", sa.String(length=255), nullable=False),
        sa.Column("confidence_score", sa.Float(), server_default="1.0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_provenance_golden_id", "provenance", ["golden_id"])
    op.create_index("ix_provenance_tenant_id", "provenance", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_provenance_tenant_id", table_name="provenance")
    op.drop_index("ix_provenance_golden_id", table_name="provenance")
    op.drop_table("provenance")

    op.drop_index("ix_er_candidates_status", table_name="er_candidates")
    op.drop_index("ix_er_candidates_tenant_id", table_name="er_candidates")
    op.drop_table("er_candidates")

    op.drop_index("ix_golden_records_tenant_id", table_name="golden_records")
    op.drop_table("golden_records")

    op.drop_index("ix_staging_records_source_id", table_name="staging_records")
    op.drop_index("ix_staging_records_tenant_id", table_name="staging_records")
    op.drop_table("staging_records")
