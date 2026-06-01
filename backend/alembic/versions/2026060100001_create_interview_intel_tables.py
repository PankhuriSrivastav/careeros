"""create interview intel tables

Revision ID: 2026060100001
Revises: 
Create Date: 2026-06-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '2026060100001'
down_revision: Union[str, Sequence[str], None] = '2026051200004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    
    # Create interview_sessions table
    if 'interview_sessions' not in existing_tables:
        op.create_table(
            'interview_sessions',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text("gen_random_uuid()")),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
            sa.Column('company_name', sa.String(), nullable=False),
            sa.Column('jd_text', sa.Text(), nullable=True),
            sa.Column('resume_snapshot', sa.Text(), nullable=True),  # JSON stored as text
            sa.Column('mode', sa.String(), nullable=False, server_default='full'),  # full / single_round
            sa.Column('status', sa.String(), nullable=False, server_default='in_progress'),  # in_progress / completed
            sa.Column('overall_score', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        )
    
    # Create interview_rounds table
    if 'interview_rounds' not in existing_tables:
        op.create_table(
            'interview_rounds',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text("gen_random_uuid()")),
            sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
            sa.Column('round_type', sa.String(), nullable=False),  # dsa / technical / system_design / hr
            sa.Column('round_number', sa.Integer(), nullable=False),  # 1/2/3/4
            sa.Column('interviewer_name', sa.String(), nullable=False),
            sa.Column('interviewer_persona', sa.Text(), nullable=True),
            sa.Column('status', sa.String(), nullable=False, server_default='pending'),  # pending / in_progress / completed
            sa.Column('score', sa.Integer(), nullable=True),
            sa.Column('feedback', sa.Text(), nullable=True),  # JSON stored as text
            sa.Column('started_at', sa.DateTime(), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
        )
    
    # Create interview_messages table
    if 'interview_messages' not in existing_tables:
        op.create_table(
            'interview_messages',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text("gen_random_uuid()")),
            sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
            sa.Column('round_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
            sa.Column('role', sa.String(), nullable=False),  # interviewer / user
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        )
    
    # Create interview_debrief table
    if 'interview_debrief' not in existing_tables:
        op.create_table(
            'interview_debrief',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text("gen_random_uuid()")),
            sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True, index=True),
            sa.Column('overall_score', sa.Integer(), nullable=False),
            sa.Column('overall_feedback', sa.Text(), nullable=True),  # JSON stored as text
            sa.Column('round_breakdowns', sa.Text(), nullable=True),  # JSON stored as text
            sa.Column('strengths', sa.Text(), nullable=True),  # JSON array stored as text
            sa.Column('improvements', sa.Text(), nullable=True),  # JSON array stored as text
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        )


def downgrade() -> None:
    op.drop_table('interview_debrief')
    op.drop_table('interview_messages')
    op.drop_table('interview_rounds')
    op.drop_table('interview_sessions')
