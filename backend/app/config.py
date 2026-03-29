"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_env: str = "development"
    app_secret_key: str = "change-me"
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    # Database
    database_url: str = "sqlite:///./esim.db"

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    # JoyTel Warehouse
    joytel_warehouse_url: str = ""
    joytel_customer_code: str = ""
    joytel_customer_auth: str = ""

    # JoyTel RSP+
    joytel_rsp_url: str = "https://esim.joytelecom.com/openapi"
    joytel_app_id: str = ""
    joytel_app_secret: str = ""

    # AWS SES
    aws_region: str = "us-east-1"
    aws_ses_from_email: str = "noreply@example.com"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
