"""create user_resumes table

Revision ID: 2026051200001
Revises: 92c61ea75877
Create Date: 2026-05-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '2026051200001'
down_revision: Union[str, Sequence[str], None] = '92c61ea75877'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if 'user_resumes' table already exists to prevent error on re-run
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    
    if 'user_resumes' not in existing_tables:
        op.create_table(
            'user_resumes',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text("gen_random_uuid()")),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
            sa.Column('resume_text', sa.Text(), nullable=False),
            sa.Column('keywords', sa.Text(), nullable=False),
            sa.Column('label', sa.String(), nullable=True),
            sa.Column('ats_score', sa.Integer(), nullable=True),
            sa.Column('score_diff', sa.Integer(), nullable=True),
            sa.Column('is_tailored', sa.Boolean(), default=False),
            sa.Column('tailored_for_company', sa.String(), nullable=True),
            sa.Column('tailored_for_application_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        )
    else:
        # Table already exists; skip creation.
        pass


def downgrade() -> None:
    op.drop_table('user_resumes')
