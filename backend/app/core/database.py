from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

def get_database_url_with_ssl(database_url: str) -> str:
    """
    Ensure DATABASE_URL has SSL parameters for Supabase/PostgreSQL.
    Supabase requires SSL connections.
    """
    # Check if it's a PostgreSQL connection
    if "postgresql" not in database_url and "postgres" not in database_url:
        return database_url
    
    parsed = urlparse(database_url)
    query_params = parse_qs(parsed.query)
    
    # Add SSL mode if not present (Supabase requires SSL)
    if 'sslmode' not in query_params:
        query_params['sslmode'] = ['require']
    
    # Rebuild URL with SSL parameters
    new_query = urlencode(query_params, doseq=True)
    new_parsed = parsed._replace(query=new_query)
    return urlunparse(new_parsed)

# Create database engine with SSL support
database_url = get_database_url_with_ssl(settings.DATABASE_URL)

# Create engine with SSL connection args for PostgreSQL
connect_args = {}
if "postgresql" in database_url or "postgres" in database_url:
    # Supabase requires SSL - ensure it's set
    connect_args = {
        "sslmode": "require"
    }

engine = create_engine(
    database_url,
    pool_pre_ping=True,  # Verify connections before using
    echo=settings.DEBUG,  # Log SQL queries in debug mode
    connect_args=connect_args
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency function to get database session.
    Use with FastAPI's Depends().
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
