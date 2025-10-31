from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings and configuration"""
    
    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_KEY: str = ""
    
    # Database
    DATABASE_URL: str
    
    # API Keys
    BLAND_AI_API_KEY: str
    GROQ_API_KEY: str
    BLAND_AI_WEBHOOK_URL: str = ""
    
    # Server
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    
    # Gym
    GYM_NAME: str = "VoiceWise Gym"
    GYM_ID: str = "gym_001"
    
    # Whisper Model
    WHISPER_MODEL: str = "small"  # Options: tiny, base, small, medium, large
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


# Global settings instance
settings = Settings()
