from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # LiveKit Configuration
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    
    # Database Configuration
    database_url: str
    redis_url: str = "redis://localhost:6379/0"
    
    # AI Model Configuration
    openai_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    
    # Application Configuration
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
