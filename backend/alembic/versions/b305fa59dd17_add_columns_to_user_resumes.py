"""add columns to user_resumes

Revision ID: b305fa59dd17
Revises: 2026051200003
Create Date: 2026-05-22 15:00:35.356710

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b305fa59dd17'
down_revision: Union[str, Sequence[str], None] = '2026051200003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Only add missing columns to user_resumes table
    op.add_column('user_resumes', sa.Column('label', sa.String(), nullable=True))
    op.add_column('user_resumes', sa.Column('ats_score', sa.Integer(), nullable=True))
    op.add_column('user_resumes', sa.Column('score_diff', sa.Integer(), nullable=True))
    op.add_column('user_resumes', sa.Column('is_tailored', sa.Boolean(), default=False, nullable=True))
    op.add_column('user_resumes', sa.Column('tailored_for_company', sa.String(), nullable=True))
    op.add_column('user_resumes', sa.Column('tailored_for_application_id', postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user_resumes', 'tailored_for_application_id')
    op.drop_column('user_resumes', 'tailored_for_company')
    op.drop_column('user_resumes', 'is_tailored')
    op.drop_column('user_resumes', 'score_diff')
    op.drop_column('user_resumes', 'ats_score')
    op.drop_column('user_resumes', 'label')
    op.alter_column('job_descriptions', 'source_type',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               existing_nullable=True,
               existing_server_default=sa.text("'community'::text"))
    op.alter_column('job_descriptions', 'role',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               nullable=False)
    op.alter_column('job_descriptions', 'company_name',
               existing_type=sa.String(),
               type_=sa.TEXT(),
               nullable=False)
    op.create_foreign_key(op.f('jd_feedback_jd_id_fkey'), 'jd_feedback', 'job_descriptions', ['jd_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(op.f('applications_jd_id_fkey'), 'applications', 'job_descriptions', ['jd_id'], ['id'])
    op.alter_column('applications', 'user_id',
               existing_type=sa.UUID(),
               type_=sa.VARCHAR(),
               existing_nullable=True)
    op.alter_column('applications', 'id',
               existing_type=sa.UUID(),
               type_=sa.VARCHAR(),
               existing_nullable=False)
    # ### end Alembic commands ###
