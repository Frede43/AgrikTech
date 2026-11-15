"""Store one-time registration challenges and throttle delivery OTP guesses.

Revision ID: e4f5a6b7c8d9
Revises: c3d4e5f6a7b8
Create Date: 2026-11-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("registration_challenges"):
        op.create_table(
            "registration_challenges",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("phone_number", sa.String(), nullable=False),
            sa.Column("token_hash", sa.String(), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_registration_challenges_id", "registration_challenges", ["id"])
        op.create_index("ix_registration_challenges_phone_number", "registration_challenges", ["phone_number"], unique=True)
        op.create_index("ix_registration_challenges_token_hash", "registration_challenges", ["token_hash"], unique=True)

    order_columns = {column["name"] for column in inspector.get_columns("orders")}
    if "delivery_otp_attempts" not in order_columns:
        op.add_column("orders", sa.Column("delivery_otp_attempts", sa.Integer(), nullable=False, server_default="0"))
    if "delivery_otp_locked_until" not in order_columns:
        op.add_column("orders", sa.Column("delivery_otp_locked_until", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    if sa.inspect(bind).has_table("orders"):
        order_columns = {column["name"] for column in sa.inspect(bind).get_columns("orders")}
        if "delivery_otp_locked_until" in order_columns:
            op.drop_column("orders", "delivery_otp_locked_until")
        if "delivery_otp_attempts" in order_columns:
            op.drop_column("orders", "delivery_otp_attempts")
    if sa.inspect(bind).has_table("registration_challenges"):
        op.drop_index("ix_registration_challenges_token_hash", table_name="registration_challenges")
        op.drop_index("ix_registration_challenges_phone_number", table_name="registration_challenges")
        op.drop_index("ix_registration_challenges_id", table_name="registration_challenges")
        op.drop_table("registration_challenges")
