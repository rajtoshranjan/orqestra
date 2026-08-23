FROM python:3.12-slim

# Install uv (pinned) by copying its static binary.
COPY --from=ghcr.io/astral-sh/uv:0.11.21 /uv /uvx /usr/local/bin/

WORKDIR /app

# Install OpenTofu and zip.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg zip ca-certificates unzip && \
    curl -fsSL https://get.opentofu.org/install-opentofu.sh -o install-opentofu.sh && \
    chmod +x install-opentofu.sh && \
    ./install-opentofu.sh --install-method deb && \
    rm install-opentofu.sh && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Python dependencies into a venv outside /app: docker-compose bind-mounts
# ./deployer over /app for local dev, which would otherwise shadow a venv built there.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Put the venv on PATH so plain `python` calls (CMD) resolve without `uv run`.
ENV PATH="/opt/venv/bin:$PATH"

# Copy source code.
COPY . .

EXPOSE 8002

CMD ["python", "app.py"]
