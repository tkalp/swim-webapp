# Worker Service

Dedicated Celery worker service for handling background tasks, particularly SwimRankings data synchronization.

## Architecture

The worker service offloads heavy sync operations from the FastAPI backend, preventing API blocking and improving system reliability.

### Components

- **Redis**: Message broker for task queue
- **Celery Worker**: Processes background sync tasks
- **Backend API**: Enqueues tasks to worker via Celery

### Task Flow

1. User triggers sync via API (`POST /swimmers/{id}/sync-external-data`)
2. Backend validates request and enqueues task to Redis
3. Worker picks up task from queue and processes sync
4. Worker updates database with progress and results
5. Frontend polls API for status updates

## Development

### Local Setup

1. **Start Redis:**
   ```bash
   docker run -d -p 6379:6379 redis:7-alpine
   ```

2. **Install dependencies:**
   ```bash
   cd worker
   pip install -r requirements.txt
   playwright install chromium
   ```

3. **Run worker:**
   ```bash
   celery -A worker.celery_app worker --loglevel=info --concurrency=2 -Q sync
   ```

### Testing Tasks

```python
from worker.celery_app import celery_app

# Enqueue a sync task
task = celery_app.send_task(
    'worker.sync_tasks.sync_swimmer_task',
    kwargs={
        'swimmer_id': 'swimmer-uuid',
        'external_link_id': 'link-uuid',
        'external_id': '12345',
        'limit_events': 10
    }
)

# Check task status
result = celery_app.AsyncResult(task.id)
print(result.state)  # PENDING, STARTED, SUCCESS, FAILURE
print(result.result)  # Task result when complete
```

## Production Deployment

### Docker Compose

The worker runs as a separate container alongside backend and frontend:

```yaml
services:
  redis:
    image: redis:7-alpine
    
  worker:
    build: ./worker
    depends_on:
      - redis
    environment:
      - REDIS_URL=redis://redis:6379/0
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
```

### Scaling

Increase worker concurrency for parallel processing:

```bash
# 4 concurrent workers
celery -A worker.celery_app worker --concurrency=4 -Q sync

# Or scale horizontally with multiple containers
docker-compose up -d --scale worker=3
```

### Monitoring

View worker logs:
```bash
docker-compose logs -f worker
```

Check Redis queue status:
```bash
docker exec -it aquilus-redis redis-cli
> LLEN celery  # Check queue length
> KEYS *       # View all keys
```

## Task Configuration

### Time Limits

- **Soft limit**: 1 hour (task receives exception)
- **Hard limit**: 2 hours (task killed)

### Retry Policy

- Failed tasks are not auto-retried
- User must manually trigger sync again
- Database updated with error status on failure

### Rate Limiting

- Worker processes one task at a time per worker (`prefetch_multiplier=1`)
- 0.5s delay between events within a sync
- Prevents overwhelming SwimRankings API

## Tasks

### `sync_swimmer_task`

Syncs all event results for a swimmer from SwimRankings.

**Parameters:**
- `swimmer_id`: Database swimmer UUID
- `external_link_id`: swimmer_external_links table UUID
- `external_id`: SwimRankings athlete ID
- `limit_events`: Optional limit on number of events to sync

**Progress Tracking:**

Task updates `swimmer_external_links` table:
- `sync_status`: `pending` → `in_progress` → `completed`/`failed`/`cancelled`
- `sync_progress`: Current event number
- `sync_total`: Total events to sync
- `results_count`: Number of results imported

**Cancellation:**

User can cancel via API:
```bash
POST /swimmers/{id}/cancel-sync
```

Worker checks for cancellation before each event.

## Troubleshooting

### Worker not processing tasks

1. Check Redis connection:
   ```bash
   docker exec -it aquilus-redis redis-cli ping
   # Should return: PONG
   ```

2. Check worker is running:
   ```bash
   docker-compose ps worker
   # Should show: Up
   ```

3. Check worker logs:
   ```bash
   docker-compose logs worker
   ```

### Tasks stuck in pending

- Verify worker is consuming from correct queue (`sync`)
- Check Redis queue: `docker exec -it aquilus-redis redis-cli LLEN celery`
- Restart worker: `docker-compose restart worker`

### Memory issues

- Worker restarts after 50 tasks to prevent memory leaks
- Increase memory limit in docker-compose.yml if needed:
  ```yaml
  worker:
    deploy:
      resources:
        limits:
          memory: 2G
  ```

## Migration from BackgroundTasks

**Old approach (blocking API):**
```python
from app.tasks.swimrankings_sync import start_swimmer_sync

background_tasks.add_task(
    start_swimmer_sync,
    swimmer_id=swimmer_id,
    external_link_id=link_id,
    external_id=external_id
)
```

**New approach (async worker):**
```python
from app.celery_app import celery_app

task = celery_app.send_task(
    'worker.sync_tasks.sync_swimmer_task',
    kwargs={
        'swimmer_id': swimmer_id,
        'external_link_id': link_id,
        'external_id': external_id
    }
)
```

## Future Enhancements

- [ ] Add Celery Beat for scheduled tasks
- [ ] Implement retry logic with exponential backoff
- [ ] Add Flower for task monitoring UI
- [ ] Support for batch sync operations
- [ ] Task prioritization based on user tier
- [ ] Webhook notifications on task completion
