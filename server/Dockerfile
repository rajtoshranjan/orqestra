# Build stage
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (AWS CLI and zip for Lambda deployment)
RUN apt-get update && apt-get install -y --no-install-recommends \
    awscli zip ca-certificates && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

EXPOSE 3001

# Add entrypoint script
ADD docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod a+x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]

CMD ["uvicorn", "draw_to_deploy.asgi:application", "--host", "0.0.0.0", "--port", "3001"]
