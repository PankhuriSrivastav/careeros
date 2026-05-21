"""create opportunities table

Revision ID: 92c61ea75877
Revises: 
Create Date: 2026-05-12 21:59:11.825366

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '92c61ea75877'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if 'opportunities' table already exists to prevent error on re-run
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    
    if 'opportunities' not in existing_tables:
        op.create_table(
            'opportunities',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text("gen_random_uuid()")),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('company_name', sa.String(), nullable=False),
            sa.Column('role', sa.String(), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('source_url', sa.String(), nullable=False),
            sa.Column('source_platform', sa.String(), nullable=True),
            sa.Column('trust_score', sa.Integer(), default=100),
            sa.Column('match_percent', sa.Integer(), default=0),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        )
    else:
        # Table already exists; skip creation.
        pass


def downgrade() -> None:
    op.drop_table('opportunities')