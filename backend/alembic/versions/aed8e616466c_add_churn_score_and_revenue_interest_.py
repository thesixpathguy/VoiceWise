"""add_churn_score_and_revenue_interest_score

Revision ID: aed8e616466c
Revises: a6e20980ea60
Create Date: 2025-11-04 16:13:14.746088

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aed8e616466c'
down_revision: Union[str, None] = 'a6e20980ea60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add churn_score column
    op.add_column('insights', sa.Column('churn_score', sa.Float(), nullable=True))
    
    # Add churn_interest_quote column
    op.add_column('insights', sa.Column('churn_interest_quote', sa.Text(), nullable=True))
    
    # Add revenue_interest_score column (temporary, will replace revenue_interest)
    op.add_column('insights', sa.Column('revenue_interest_score', sa.Float(), nullable=True))
    
    # Migrate data: convert revenue_interest (Boolean) to revenue_interest_score (Float)
    # True -> 1.0, False -> 0.0, NULL -> NULL
    op.execute("""
        UPDATE insights 
        SET revenue_interest_score = CASE 
            WHEN revenue_interest = TRUE THEN 1.0
            WHEN revenue_interest = FALSE THEN 0.0
            ELSE NULL
        END
    """)
    
    # Add indexes for faster queries
    op.create_index('ix_insights_churn_score', 'insights', ['churn_score'])
    op.create_index('ix_insights_revenue_interest_score', 'insights', ['revenue_interest_score'])
    
    # Drop old revenue_interest column and its index
    op.drop_index('ix_insights_revenue_interest', 'insights', if_exists=True)
    op.drop_column('insights', 'revenue_interest')


def downgrade() -> None:
    # Re-add revenue_interest column
    op.add_column('insights', sa.Column('revenue_interest', sa.Boolean(), nullable=True))
    
    # Migrate data back: convert revenue_interest_score to revenue_interest
    # >= 0.5 -> True, < 0.5 -> False, NULL -> NULL
    op.execute("""
        UPDATE insights 
        SET revenue_interest = CASE 
            WHEN revenue_interest_score >= 0.5 THEN TRUE
            WHEN revenue_interest_score < 0.5 THEN FALSE
            ELSE NULL
        END
    """)
    
    # Re-create old index
    op.create_index('ix_insights_revenue_interest', 'insights', ['revenue_interest'])
    
    # Remove indexes
    op.drop_index('ix_insights_revenue_interest_score', 'insights', if_exists=True)
    op.drop_index('ix_insights_churn_score', 'insights', if_exists=True)
    
    # Remove columns
    op.drop_column('insights', 'revenue_interest_score')
    op.drop_column('insights', 'churn_interest_quote')
    op.drop_column('insights', 'churn_score')
