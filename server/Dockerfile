# Build stage
FROM python:3.12-slim

# Install uv (pinned) by copying its static binary.
COPY --from=ghcr.io/astral-sh/uv:0.11.21 /uv /uvx /usr/local/bin/

WORKDIR /app

# Install system dependencies (AWS CLI and zip for Lambda deployment)
RUN apt-get update && apt-get install -y --no-install-recommends \
    awscli zip ca-certificates && rm -rf /var/lib/apt/lists/*

# Install Python dependencies into a venv outside /app: docker-compose bind-mounts
# ./server over /app for local dev, which would otherwise shadow a venv built there.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Put the venv on PATH so plain `python`/`uvicorn` calls (docker-entrypoint.sh,
# docker-compose commands, manage.py) resolve without `uv run`.
ENV PATH="/opt/venv/bin:$PATH"

# Copy source code
COPY . .

EXPOSE 3001

# Add entrypoint script
ADD docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod a+x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]

CMD ["uvicorn", "orqestra.asgi:application", "--host", "0.0.0.0", "--port", "3001"]
