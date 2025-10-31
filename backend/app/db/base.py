from sqlalchemy.ext.declarative import declarative_base

# Create Base class for models
Base = declarative_base()

# Import all models here so Alembic can detect them
from app.models.models import *  # noqa
