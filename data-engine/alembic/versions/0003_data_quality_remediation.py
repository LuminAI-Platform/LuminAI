"""Add quality and conflict tracking to golden_records, plus data quality reports and transformation audit tables

Revision ID: 0003_data_quality_remediation
Revises: 0002_golden_record_versioning
Create Date: 2026-10-18 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0003_data_quality_remediation"
down_revision: Union[str, None] = "0002_golden_record_versioning"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add quality_state, quality_score, confidence_score, and conflicts to golden_records
    op.add_column(
        "golden_records",
        sa.Column("quality_state", sa.String(length=50), server_default="VERIFIED", nullable=False),
    )
    op.add_column(
        "golden_records",
        sa.Column("quality_score", sa.Float(), server_default="1.0", nullable=False),
    )
    op.add_column(
        "golden_records",
        sa.Column("confidence_score", sa.Float(), server_default="1.0", nullable=False),
    )
    op.add_column(
        "golden_records",
        sa.Column("conflicts", sa.Text(), nullable=True),
    )

    # 2. Create data_quality_reports table
    op.create_table(
        "data_quality_reports",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("dataset_id", sa.String(length=255), nullable=False),
        sa.Column("overall_score", sa.Float(), nullable=False),
        sa.Column("dimension_scores", sa.Text(), nullable=False),
        sa.Column("verified_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("needs_review_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("rejected_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("profiling_report", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_data_quality_reports_tenant_id", "data_quality_reports", ["tenant_id"]
    )
    op.create_index(
        "ix_data_quality_reports_dataset_id", "data_quality_reports", ["dataset_id"]
    )

    # 3. Create transformation_audit_records table
    op.create_table(
        "transformation_audit_records",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("tenant_id", sa.String(length=255), nullable=False),
        sa.Column("record_id", sa.String(length=255), nullable=False),
        sa.Column("stage", sa.String(length=50), nullable=False),
        sa.Column("step_name", sa.String(length=100), nullable=False),
        sa.Column("field_name", sa.String(length=255), nullable=True),
        sa.Column("original_value", sa.Text(), nullable=True),
        sa.Column("transformed_value", sa.Text(), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_transformation_audit_records_tenant_id",
        "transformation_audit_records",
        ["tenant_id"],
    )
    op.create_index(
        "ix_transformation_audit_records_record_id",
        "transformation_audit_records",
        ["record_id"],
    )


def downgrade() -> None:
    op.drop_table("transformation_audit_records")
    op.drop_table("data_quality_reports")
    op.drop_column("golden_records", "conflicts")
    op.drop_column("golden_records", "confidence_score")
    op.drop_column("golden_records", "quality_score")
    op.drop_column("golden_records", "quality_state")
