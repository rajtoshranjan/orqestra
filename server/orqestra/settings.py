import sys
from datetime import timedelta
from pathlib import Path

from utils.parsers import unwrap_boolean, unwrap_list

from .env_variables import EnvVariable

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = EnvVariable.SECRET_KEY.value

DEBUG = unwrap_boolean(EnvVariable.DEBUG.value)

ALLOWED_HOSTS = unwrap_list(EnvVariable.ALLOWED_HOSTS.value)


# Application definition
INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "channels",
    # Apps.
    "accounts",
    "organisations",
    "cloud_services",
    "deployments",
    "projects",
    "annotations",
    "realtime",
    "agent",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "orqestra.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "orqestra.wsgi.application"
ASGI_APPLICATION = "orqestra.asgi.application"


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": EnvVariable.DB_NAME.value,
        "USER": EnvVariable.DB_USER.value,
        "PASSWORD": EnvVariable.DB_PASSWORD.value,
        "HOST": EnvVariable.DB_HOST.value,
        "PORT": EnvVariable.DB_PORT.value,
        "OPTIONS": {
            "pool": True,
        },
    }
}


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"


# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "orqestra.response_renderer.CustomJsonRenderer",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "EXCEPTION_HANDLER": "orqestra.exceptions.handler.custom_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
}


# CORS
from corsheaders.defaults import default_headers

CORS_ALLOWED_ORIGINS = unwrap_list(EnvVariable.ALLOWED_CORS_DOMAINS.value)
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-active-org-id",
]

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [
                (EnvVariable.REDIS_HOST.value, int(EnvVariable.REDIS_PORT.value))
            ],
        },
    },
}


# Agent / LLM
AGENT_LLM_PROVIDER = EnvVariable.AGENT_LLM_PROVIDER.value
AGENT_LLM_MODEL = EnvVariable.AGENT_LLM_MODEL.value
ANTHROPIC_API_KEY = EnvVariable.ANTHROPIC_API_KEY.value
AGENT_MAX_TURNS = 20


# Logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
            "stream": sys.stdout,
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
