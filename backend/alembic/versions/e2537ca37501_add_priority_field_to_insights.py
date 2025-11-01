"""add_priority_field_to_insights

Revision ID: e2537ca37501
Revises: af2cb9c3c0cb
Create Date: 2025-11-01 20:16:24.320218

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2537ca37501'
down_revision: Union[str, None] = 'af2cb9c3c0cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
