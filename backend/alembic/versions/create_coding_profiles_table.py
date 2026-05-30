"""create coding_profiles table

Revision ID: create_coding_profiles
Revises: 2026051200004
Create Date: 2026-05-25 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'create_coding_profiles'
down_revision = '2026051200004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'coding_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),  # UUID type
        sa.Column('source', sa.String(), nullable=False),  # "leetcode", "hackerrank", "manual", "combined"
        sa.Column('topic_counts', sa.Text(), nullable=False),  # JSON as text
        sa.Column('difficulty_breakdown', sa.Text(), nullable=False),  # JSON as text
        sa.Column('total_solved', sa.Integer(), nullable=False),
        sa.Column('weekly_pace', sa.String(), nullable=True),  # float as string
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_coding_profiles_user_id', 'coding_profiles', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_coding_profiles_user_id', table_name='coding_profiles')
    op.drop_table('coding_profiles')
