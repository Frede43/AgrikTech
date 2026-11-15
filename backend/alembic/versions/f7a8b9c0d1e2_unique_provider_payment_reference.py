"""Store and uniquely constrain mobile money provider references.

Revision ID: f7a8b9c0d1e2
Revises: e4f5a6b7c8d9
Create Date: 2026-11-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("transaction_logs")}
    indexes = {index["name"] for index in sa.inspect(bind).get_indexes("transaction_logs")}

    if "provider_reference" not in columns:
        op.add_column("transaction_logs", sa.Column("provider_reference", sa.String(), nullable=True))
    if "ix_transaction_logs_provider_reference" not in indexes:
        op.create_index(
            "ix_transaction_logs_provider_reference",
            "transaction_logs",
            ["provider_reference"],
            unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("transaction_logs"):
        indexes = {index["name"] for index in inspector.get_indexes("transaction_logs")}
        columns = {column["name"] for column in inspector.get_columns("transaction_logs")}
        if "ix_transaction_logs_provider_reference" in indexes:
            op.drop_index("ix_transaction_logs_provider_reference", table_name="transaction_logs")
        if "provider_reference" in columns:
            op.drop_column("transaction_logs", "provider_reference")
