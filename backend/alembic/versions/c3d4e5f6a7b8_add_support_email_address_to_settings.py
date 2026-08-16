"""Add support_email and support_address to system_settings

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Voir models.SystemSettings.support_email/support_address : le footer
    public (contact) et la page admin Paramètres deviennent modifiables
    depuis la base plutôt que codés en dur côté frontend.
    """
    bind = op.get_bind()
    columns = [c["name"] for c in sa.inspect(bind).get_columns("system_settings")]
    if "support_email" not in columns:
        op.add_column(
            "system_settings",
            sa.Column("support_email", sa.String(), nullable=True, server_default="contact@agriconnect.bi"),
        )
    if "support_address" not in columns:
        op.add_column(
            "system_settings",
            sa.Column("support_address", sa.String(), nullable=True, server_default="Bujumbura, Burundi (Rohero II)"),
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    columns = [c["name"] for c in sa.inspect(bind).get_columns("system_settings")]
    if "support_address" in columns:
        op.drop_column("system_settings", "support_address")
    if "support_email" in columns:
        op.drop_column("system_settings", "support_email")
