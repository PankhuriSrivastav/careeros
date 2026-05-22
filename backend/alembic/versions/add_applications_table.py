"""create applications table

Revision ID: 2026051200002
Revises: 2026051200001
Create Date: 2026-05-22 12:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '2026051200002'
down_revision: Union[str, Sequence[str], None] = '2026051200001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if 'applications' table already exists to prevent error on re-run
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    
    if 'applications' not in existing_tables:
        op.create_table(
            'applications',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text("gen_random_uuid()")),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
            sa.Column('company', sa.String(), nullable=False),
            sa.Column('role', sa.String(), nullable=False),
            sa.Column('status', sa.String(), nullable=False),
            sa.Column('applied_date', sa.String(), nullable=False),
            sa.Column('salary', sa.String(), nullable=True),
            sa.Column('notes', sa.String(), nullable=True),
            sa.Column('job_description', sa.Text(), nullable=True),
            sa.Column('jd_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), onupdate=sa.text('now()')),
        )
    else:
        # Table already exists; skip creation.
        pass


def downgrade() -> None:
    op.drop_table('applications')
