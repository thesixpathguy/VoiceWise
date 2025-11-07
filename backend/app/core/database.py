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
    query_params = parse_qs(parsed.query)
    
    # Determine SSL mode based on environment
    # Local development: localhost or 127.0.0.1 = disable SSL
    # Production (Supabase): require SSL
    is_local = parsed.hostname in ('localhost', '127.0.0.1')
    default_sslmode = 'disable' if is_local else 'require'
    
    # Add SSL mode if not present
    if 'sslmode' not in query_params:
        query_params['sslmode'] = [default_sslmode]
    
    # Rebuild URL with SSL parameters
    new_query = urlencode(query_params, doseq=True)
    new_parsed = parsed._replace(query=new_query)
    return urlunparse(new_parsed)

# Create database engine with SSL support
database_url = get_database_url_with_ssl(settings.DATABASE_URL)

# Create engine with SSL connection args for PostgreSQL
connect_args = {}
if "postgresql" in database_url or "postgres" in database_url:
    # Determine SSL mode: local development disables SSL, production requires it
    is_local = "localhost" in database_url or "127.0.0.1" in database_url
    sslmode = "disable" if is_local else "require"
    connect_args = {
        "sslmode": sslmode
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
