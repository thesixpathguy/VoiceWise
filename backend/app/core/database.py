from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

def get_database_url_with_ssl(database_url: str) -> str:
    """
    Ensure DATABASE_URL has proper SSL parameters.
    - For local development: disable SSL
    - For production (Supabase): require SSL
    """
    # Check if it's a PostgreSQL connection
    if "postgresql" not in database_url and "postgres" not in database_url:
        return database_url
    
    parsed = urlparse(database_url)
    
    # Check if it's a local connection (using hostname, not substring match)
    local_hosts = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}
    is_local = parsed.hostname in local_hosts
    
    # Local connections don't need SSL modifications
    if is_local:
        return database_url
    
    # Remote connections (e.g., Supabase) require SSL
    query_params = parse_qs(parsed.query)
    
    # Add SSL mode if not present (require for remote connections)
    if 'sslmode' not in query_params:
        query_params['sslmode'] = ['require']
    
    # Rebuild URL with SSL parameters
    new_query = urlencode(query_params, doseq=True)
    new_parsed = parsed._replace(query=new_query)
    return urlunparse(new_parsed)

# Create database engine with SSL support
database_url = get_database_url_with_ssl(settings.DATABASE_URL)

# Create engine
# SSL mode is already configured in the URL by get_database_url_with_ssl()
engine = create_engine(
    database_url,
    pool_pre_ping=True,  # Verify connections before using
    echo=settings.DEBUG  # Log SQL queries in debug mode
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
