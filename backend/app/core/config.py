from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase Configuration
    SUPABASE_URL: str = Field(default="https://placeholder.supabase.co")
    SUPABASE_ANON_KEY: str = Field(default="placeholder-anon-key")
    SUPABASE_PUBLISHABLE_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None

    DATABASE_URL: Optional[str] = None
    BILLING_CRON_SECRET: Optional[str] = None

    # Application Configuration
    ENVIRONMENT: str = Field(default="development")
    LOG_LEVEL: str = Field(default="INFO")
    PORT: int = Field(default=8000)
    HOST: str = Field(default="0.0.0.0")
    FRONTEND_ORIGIN: str = Field(default="http://localhost:3000")
    ALLOWED_ORIGINS: List[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    @field_validator("SUPABASE_ANON_KEY", mode="before")
    @classmethod
    def resolve_anon_key(cls, v: Optional[str], info) -> str:
        # If SUPABASE_ANON_KEY is not provided or empty, check SUPABASE_PUBLISHABLE_KEY
        if not v and info.data.get("SUPABASE_PUBLISHABLE_KEY"):
            return info.data["SUPABASE_PUBLISHABLE_KEY"]
        return v or "placeholder-anon-key"

    @property
    def anon_key(self) -> str:
        return self.SUPABASE_PUBLISHABLE_KEY or self.SUPABASE_ANON_KEY

    @property
    def cors_origins(self) -> List[str]:
        origins = list(self.ALLOWED_ORIGINS)
        if self.FRONTEND_ORIGIN and self.FRONTEND_ORIGIN not in origins:
            origins.append(self.FRONTEND_ORIGIN)
        return origins


settings = Settings()
