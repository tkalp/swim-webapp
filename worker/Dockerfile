FROM python:3.11-slim

# Install system dependencies + Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    curl \
    chromium \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install worker requirements
COPY worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend app package (worker imports app.infrastructure.models)
COPY backend/app /app/app

# Copy worker code (includes swim-scraper/)
COPY worker /app/worker

# Add swim-scraper to Python path
ENV PYTHONPATH=/app:/app/worker/swim-scraper

# Run Celery worker
CMD ["celery", "-A", "worker.celery_app", "worker", "--loglevel=info", "--concurrency=1", "-Q", "sync,celery"]
