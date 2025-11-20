"""
Celery application for worker service
"""

import os
from celery import Celery

# Get Redis URL from environment
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

# Create Celery app
celery_app = Celery(
    'aquilus',
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=['worker.sync_tasks']
)

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_soft_time_limit=3600,
    task_time_limit=7200,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
    result_expires=86400,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)
