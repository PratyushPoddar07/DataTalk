from pydantic_settings import BaseSettings
from typing import List, Optional
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "QueryMind AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Database — defaults to SQLite so the app can boot without PostgreSQL
    DATABASE_URL: str = "sqlite:///querymind.db"
    MONGODB_URL: str = "mongodb://localhost:27017"
    REDIS_URL: str = "redis://localhost:6379"
    
    # AI Services — must be set via Vercel Environment Variables in production
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    
    # Vector Database
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    
    # Security — must be set via Vercel Environment Variables in production
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS — include common Vercel preview/production domains
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,https://*.vercel.app"
    
    # Celery (optional — not available in serverless)
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    
    # Monitoring
    ENABLE_METRICS: bool = False
    
    # SQL Generation
    MAX_QUERY_COMPLEXITY: int = 10
    QUERY_TIMEOUT_SECONDS: int = 30
    
    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        # Don't fail if .env doesn't exist (Vercel uses dashboard env vars)
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
