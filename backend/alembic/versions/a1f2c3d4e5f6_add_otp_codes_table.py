"""Add otp_codes table (persistance des OTP)

Revision ID: a1f2c3d4e5f6
Revises: d63efde21547
Create Date: 2026-08-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1f2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'd63efde21547'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    La révision d63efde21547 crée désormais tout le schéma courant via
    Base.metadata (donc otp_codes aussi, puisque le modèle existe déjà à ce
    moment-là). On ne recrée ici que si la table n'existe pas encore, pour
    rester applicable sur une base migrée avant ce correctif.
    """
    bind = op.get_bind()
    if sa.inspect(bind).has_table('otp_codes'):
        return

    op.create_table(
        'otp_codes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('phone_number', sa.String(), nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_sent_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_otp_codes_id'), 'otp_codes', ['id'], unique=False)
    op.create_index(op.f('ix_otp_codes_phone_number'), 'otp_codes', ['phone_number'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    if not sa.inspect(bind).has_table('otp_codes'):
        return
    op.drop_index(op.f('ix_otp_codes_phone_number'), table_name='otp_codes')
    op.drop_index(op.f('ix_otp_codes_id'), table_name='otp_codes')
    op.drop_table('otp_codes')
