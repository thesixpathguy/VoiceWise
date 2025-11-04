"""Add custom instructions to calls and instruction answers to insights

Revision ID: add_custom_instructions
Revises: aed8e616466c
Create Date: 2024-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_custom_instructions'
down_revision = 'aed8e616466c'  # Update with your latest migration
branch_labels = None
depends_on = None


def upgrade():
    # Add custom_instructions column to calls table
    op.add_column('calls', sa.Column('custom_instructions', postgresql.ARRAY(sa.Text()), nullable=True))
    
    # Add custom_instruction_answers column to insights table (JSON)
    op.add_column('insights', sa.Column('custom_instruction_answers', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade():
    # Remove columns
    op.drop_column('insights', 'custom_instruction_answers')
    op.drop_column('calls', 'custom_instructions')

