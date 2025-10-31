"""Supabase client configuration"""
from supabase import create_client, Client
from app.core.config import settings


def get_supabase_client() -> Client:
    """Create and return a Supabase client instance"""
    return create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=settings.SUPABASE_KEY
    )


def get_supabase_admin_client() -> Client:
    """Create and return a Supabase admin client with service key"""
    service_key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY
    return create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=service_key
    )


# Global client instance
supabase: Client = get_supabase_client()
