import os
from enum import Enum


class EnvVariable(Enum):
    # Project Config Variables.
    SECRET_KEY = os.environ.get(
        "SECRET_KEY",
        "django-insecure-orqestra-dev-key-change-in-production",
    )
    ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1")
    DEBUG = os.environ.get("DEBUG", "True")
    ALLOWED_CORS_DOMAINS = os.environ.get(
        "ALLOWED_CORS_DOMAINS", "http://localhost:8080,http://localhost:5173"
    )

    # AWS Config Variables.
    AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
    AWS_DEFAULT_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
    AWS_LAMBDA_EXECUTION_ROLE_ARN = os.environ.get("AWS_LAMBDA_EXECUTION_ROLE_ARN", "")
    AWS_ENDPOINT_URL = os.environ.get("AWS_ENDPOINT_URL", "")

    # Server Config Variables.
    HOST = os.environ.get("HOST", "0.0.0.0")
    PORT = os.environ.get("PORT", "3001")

    # DB Variables.
    DB_NAME = os.environ.get("DB_NAME", "postgres")
    DB_USER = os.environ.get("DB_USER", "postgres")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "postgres")
    DB_HOST = os.environ.get("DB_HOST", "db")
    DB_PORT = os.environ.get("DB_PORT", "5432")
