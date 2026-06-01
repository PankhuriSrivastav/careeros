"""merge interview intel and coding profiles

Revision ID: bc4049190269
Revises: 2026060100001, 64a6bf2b02dc
Create Date: 2026-06-01 16:45:28.720239

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bc4049190269'
down_revision: Union[str, Sequence[str], None] = ('2026060100001', '64a6bf2b02dc')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
