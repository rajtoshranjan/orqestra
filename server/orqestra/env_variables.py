import os
from enum import Enum


class EnvVariable(Enum):
    # Project Config Variables.
    SECRET_KEY = os.environ.get(
        "SECRET_KEY",
        "django-insecure-orqestra-dev-key-change-in-production",
    )
    ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1,server")
    DEBUG = os.environ.get("DEBUG", "True")
    ALLOWED_CORS_DOMAINS = os.environ.get(
        "ALLOWED_CORS_DOMAINS", "http://localhost:8080,http://localhost:5173"
    )

    # Server Config Variables.
    HOST = os.environ.get("HOST", "0.0.0.0")
    PORT = os.environ.get("PORT", "3001")

    # DB Variables.
    DB_NAME = os.environ.get("DB_NAME", "postgres")
    DB_USER = os.environ.get("DB_USER", "postgres")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "postgres")
    DB_HOST = os.environ.get("DB_HOST", "db")
    DB_PORT = os.environ.get("DB_PORT", "5432")

    # Deployer Variables.
    DEPLOYER_MODE = os.environ.get("DEPLOYER_MODE", "local")
    DEPLOYER_LOCAL_URL = os.environ.get("DEPLOYER_LOCAL_URL", "http://deployer:8002")
    DEPLOYER_LAMBDA_FUNCTION_NAME = os.environ.get(
        "DEPLOYER_LAMBDA_FUNCTION_NAME", "orqestra-deployer"
    )
    SERVER_BASE_URL = os.environ.get("SERVER_BASE_URL", "http://server:3001")

    # Redis Variables
    REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
    REDIS_PORT = os.environ.get("REDIS_PORT", "6379")

