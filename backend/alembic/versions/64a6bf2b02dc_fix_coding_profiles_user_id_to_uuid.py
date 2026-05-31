"""fix_coding_profiles_user_id_to_uuid

Revision ID: 64a6bf2b02dc
Revises: create_coding_profiles
Create Date: 2026-05-31 22:13:32.056181

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '64a6bf2b02dc'
down_revision: Union[str, Sequence[str], None] = 'create_coding_profiles'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'coding_profiles',
        'user_id',
        type_=UUID(as_uuid=True),
        postgresql_using='user_id::uuid'  # converts existing text values to UUID
    )
    


def downgrade() -> None:
     op.alter_column(
        'coding_profiles',
        'user_id',
        type_=sa.String(),
        postgresql_using='user_id::text'
    )
