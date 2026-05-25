"""create referral_outreach table

Revision ID: 2026051200004
Revises: b305fa59dd17
Create Date: 2026-05-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '2026051200004'
down_revision: Union[str, Sequence[str], None] = 'b305fa59dd17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create referral_outreach table."""
    # Check if table already exists to prevent error on re-run
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    
    if 'referral_outreach' not in existing_tables:
        op.create_table(
            'referral_outreach',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                      server_default=sa.text("gen_random_uuid()")),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
            sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('company', sa.String(), nullable=False),
            sa.Column('role', sa.String(), nullable=False),
            sa.Column('profile_url', sa.String(), nullable=False),
            sa.Column('profile_name', sa.String(), nullable=False),
            sa.Column('profile_college', sa.String(), nullable=True),
            sa.Column('message_drafted', sa.Text(), nullable=False),
            sa.Column('status', sa.String(), default='Draft'),
            sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        )
        
        # Create index on (user_id, company) for filtering by user and company
        op.create_index(
            'ix_referral_outreach_user_company',
            'referral_outreach',
            ['user_id', 'company']
        )
        
        # Create index on status for filtering
        op.create_index(
            'ix_referral_outreach_status',
            'referral_outreach',
            ['status']
        )


def downgrade() -> None:
    """Drop referral_outreach table."""
    op.drop_table('referral_outreach')
