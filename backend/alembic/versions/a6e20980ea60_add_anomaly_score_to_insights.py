"""add_anomaly_score_to_insights

Revision ID: a6e20980ea60
Revises: d50412f72c75
Create Date: 2025-11-03 19:09:34.162595

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a6e20980ea60'
down_revision: Union[str, None] = 'd50412f72c75'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add anomaly_score column to insights table
    op.add_column('insights', sa.Column('anomaly_score', sa.Float(), nullable=True))
    
    # Add index on anomaly_score for faster queries
    op.create_index('ix_insights_anomaly_score', 'insights', ['anomaly_score'])


def downgrade() -> None:
    # Remove index
    op.drop_index('ix_insights_anomaly_score', 'insights')
    
    # Remove column
    op.drop_column('insights', 'anomaly_score')
