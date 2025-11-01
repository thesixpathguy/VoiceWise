"""add_transcript_embedding_column

Revision ID: af2cb9c3c0cb
Revises: ac30e721d854
Create Date: 2025-11-01 19:14:36.418208

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = 'af2cb9c3c0cb'
down_revision: Union[str, None] = 'ac30e721d854'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    
    # Add transcript_embedding column
    op.add_column('calls', sa.Column('transcript_embedding', Vector(384), nullable=True))
    
    # Add index on phone_number for faster searches
    op.create_index('ix_calls_phone_number', 'calls', ['phone_number'])


def downgrade() -> None:
    # Remove index
    op.drop_index('ix_calls_phone_number', 'calls')
    
    # Remove column
    op.drop_column('calls', 'transcript_embedding')
