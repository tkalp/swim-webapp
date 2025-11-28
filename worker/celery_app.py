"""
Celery application for worker service
"""

import os
from celery import Celery
from celery.schedules import crontab

# Get Redis URL from environment
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

# Get auto-generation configuration from environment
AUTO_GEN_DAYS_AHEAD = int(os.getenv('AUTO_GEN_DAYS_AHEAD') or '14')
AUTO_GEN_SCHEDULE_HOUR = int(os.getenv('AUTO_GEN_SCHEDULE_HOUR') or '0')
AUTO_GEN_SCHEDULE_MINUTE = int(os.getenv('AUTO_GEN_SCHEDULE_MINUTE') or '0')

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
    task_track_started=True,  # Required for callbacks to work properly
    task_ignore_result=False,  # Must store results for callbacks to work
)

# Celery Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    'auto-generate-training-sessions': {
        'task': 'worker.sync_tasks.auto_generate_sessions_task',
        'schedule': crontab(hour=AUTO_GEN_SCHEDULE_HOUR, minute=AUTO_GEN_SCHEDULE_MINUTE),  # Daily at midnight UTC
        'kwargs': {
            'days_ahead': AUTO_GEN_DAYS_AHEAD,
        },
        'options': {
            'expires': 3600,  # Task expires after 1 hour if not executed
        }
    },
}
