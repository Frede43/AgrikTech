"""Add delivery_fee to orders

Revision ID: b2c3d4e5f6a7
Revises: a1f2c3d4e5f6
Create Date: 2026-08-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1f2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Voir models.Order.delivery_fee : part de total_price destinée au
    livreur (calculée par utils.compute_delivery_fee), distincte de
    subtotal_price/vat_amount qui restent produit-uniquement pour ne pas
    fausser la commission fermier.
    """
    bind = op.get_bind()
    columns = [c["name"] for c in sa.inspect(bind).get_columns("orders")]
    if "delivery_fee" in columns:
        return
    op.add_column(
        "orders",
        sa.Column("delivery_fee", sa.Numeric(12, 2), nullable=True, server_default="0.0"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    columns = [c["name"] for c in sa.inspect(bind).get_columns("orders")]
    if "delivery_fee" not in columns:
        return
    op.drop_column("orders", "delivery_fee")
