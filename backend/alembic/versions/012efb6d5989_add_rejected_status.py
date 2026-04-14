"""add rejected status

Revision ID: 012efb6d5989
Revises: 86f3cb5a7508
Create Date: 2026-04-14 17:18:26.240312

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '012efb6d5989'
down_revision: Union[str, Sequence[str], None] = '86f3cb5a7508'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE receiptstatus ADD VALUE IF NOT EXISTS 'REJECTED';")

def downgrade() -> None:
    """Downgrade schema."""
    pass
