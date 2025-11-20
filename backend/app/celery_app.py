"""
Celery application configuration for async task processing
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
    include=['worker.sync_tasks']  # Import task modules
)

# Celery configuration
celery_app.conf.update(
    # Task routing
    task_routes={
        'worker.sync_tasks.sync_swimmer_task': {'queue': 'sync'},
    },
    
    # Task execution settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Task time limits
    task_soft_time_limit=3600,  # 1 hour soft limit
    task_time_limit=7200,  # 2 hours hard limit
    
    # Worker settings
    worker_prefetch_multiplier=1,  # Only fetch one task at a time
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks to prevent memory leaks
    
    # Result backend settings
    result_expires=86400,  # Results expire after 24 hours
    result_extended=True,  # Store more detailed results
    
    # Task acknowledgment
    task_acks_late=True,  # Acknowledge tasks after completion, not before
    task_reject_on_worker_lost=True,  # Requeue tasks if worker crashes
)

if __name__ == '__main__':
    celery_app.start()
