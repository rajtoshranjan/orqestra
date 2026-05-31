FROM python:3.12-slim

WORKDIR /app

# Install OpenTofu and zip.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg zip ca-certificates unzip && \
    curl -fsSL https://get.opentofu.org/install-opentofu.sh -o install-opentofu.sh && \
    chmod +x install-opentofu.sh && \
    ./install-opentofu.sh --install-method deb && \
    rm install-opentofu.sh && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Python dependencies.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code.
COPY . .

EXPOSE 8002

CMD ["python", "app.py"]
