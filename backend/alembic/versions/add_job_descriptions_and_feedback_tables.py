"""create job_descriptions and jd_feedback tables

Revision ID: 2026051200003
Revises: 2026051200002
Create Date: 2026-05-22 12:02:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '2026051200003'
down_revision: Union[str, Sequence[str], None] = '2026051200002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if 'job_descriptions' table already exists to prevent error on re-run
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    
    if 'job_descriptions' not in existing_tables:
        op.create_table(
            'job_descriptions',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text("gen_random_uuid()")),
            sa.Column('company_name', sa.String(), nullable=False, index=True),
            sa.Column('role', sa.String(), nullable=False),
            sa.Column('job_description', sa.Text(), nullable=False),
            sa.Column('extracted_skills', postgresql.ARRAY(sa.Text()), nullable=True),
            sa.Column('extracted_keywords', postgresql.ARRAY(sa.Text()), nullable=True),
            sa.Column('source_type', sa.String(), default='community'),
            sa.Column('is_verified', sa.Boolean(), default=False),
            sa.Column('is_active', sa.Boolean(), default=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
            sa.Column('added_by_user_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('times_used', sa.Integer(), default=0),
            sa.Column('share_consent', sa.Boolean(), default=False),
        )
    
    if 'jd_feedback' not in existing_tables:
        op.create_table(
            'jd_feedback',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text("gen_random_uuid()")),
            sa.Column('jd_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('is_accurate', sa.Boolean(), nullable=True),
            sa.Column('comment', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        )


def downgrade() -> None:
    op.drop_table('jd_feedback')
    op.drop_table('job_descriptions')
