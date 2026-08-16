"""Initial migration with OBR and KYC

Revision ID: d63efde21547
Revises:
Create Date: 2026-03-24 13:34:52.507113

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd63efde21547'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Cette révision a été générée par autogenerate contre une base qui avait
    déjà toutes les tables (créées via `Base.metadata.create_all()` en dev),
    donc son contenu d'origine ne capturait que des ALTER/ADD COLUMN — pas les
    CREATE TABLE. Sur une base neuve (ex. PostgreSQL en production), cela
    échouait avec "relation ... does not exist". On délègue donc directement
    à SQLAlchemy, qui crée tout le schéma courant (ordre des FK géré
    automatiquement) et ignore les tables déjà présentes.
    """
    import backend.models as models

    bind = op.get_bind()
    models.Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    """Downgrade schema : supprime tout le schéma applicatif."""
    import backend.models as models

    bind = op.get_bind()
    models.Base.metadata.drop_all(bind=bind, checkfirst=True)
