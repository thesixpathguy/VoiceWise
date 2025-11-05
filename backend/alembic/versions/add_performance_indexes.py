"""add_performance_indexes

Revision ID: add_performance_indexes_001
Revises: a6e20980ea60
Create Date: 2025-11-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_performance_indexes_001'
# Merge both heads: add_custom_instructions and af2cb9c3c0cb (via e2537ca37501)
down_revision: Union[str, Sequence[str], None] = ['add_custom_instructions', 'af2cb9c3c0cb']
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add performance indexes for common query patterns:
    - Composite indexes for date filtering with gym_id
    - Index on confidence for filtering
    - Composite indexes for joins + score ordering
    - Composite indexes for confidence + score filtering/ordering
    """
    
    # ===== CALLS TABLE INDEXES =====
    
    # Composite index for date filtering with gym_id (common in chart queries)
    op.create_index(
        'idx_calls_gym_id_created_at',
        'calls',
        ['gym_id', 'created_at'],
        unique=False
    )
    
    # Index for status filtering
    op.create_index(
        'idx_calls_status',
        'calls',
        ['status'],
        unique=False
    )
    
    # ===== INSIGHTS TABLE INDEXES =====
    
    # Index on confidence (CRITICAL - used in almost all queries)
    op.create_index(
        'ix_insights_confidence',
        'insights',
        ['confidence'],
        unique=False
    )
    
    # Composite index for joins + churn score ordering (common in chart queries)
    op.create_index(
        'idx_insights_call_id_churn_score',
        'insights',
        ['call_id', 'churn_score'],
        unique=False
    )
    
    # Composite index for joins + revenue score ordering
    op.create_index(
        'idx_insights_call_id_revenue_score',
        'insights',
        ['call_id', 'revenue_interest_score'],
        unique=False
    )
    
    # Composite index for confidence filtering + churn score ordering
    op.create_index(
        'idx_insights_confidence_churn_score',
        'insights',
        ['confidence', 'churn_score'],
        unique=False
    )
    
    # Composite index for confidence filtering + revenue score ordering
    op.create_index(
        'idx_insights_confidence_revenue_score',
        'insights',
        ['confidence', 'revenue_interest_score'],
        unique=False
    )
    
    # Composite index for date-based trend queries with confidence
    op.create_index(
        'idx_insights_extracted_at_confidence',
        'insights',
        ['extracted_at', 'confidence'],
        unique=False
    )


def downgrade() -> None:
    """
    Remove all performance indexes added in this migration
    """
    
    # Remove insights indexes
    op.drop_index('idx_insights_extracted_at_confidence', 'insights')
    op.drop_index('idx_insights_confidence_revenue_score', 'insights')
    op.drop_index('idx_insights_confidence_churn_score', 'insights')
    op.drop_index('idx_insights_call_id_revenue_score', 'insights')
    op.drop_index('idx_insights_call_id_churn_score', 'insights')
    op.drop_index('ix_insights_confidence', 'insights')
    
    # Remove calls indexes
    op.drop_index('idx_calls_status', 'calls')
    op.drop_index('idx_calls_gym_id_created_at', 'calls')

