# Worker Service Migration Guide

This guide explains the migration from FastAPI BackgroundTasks to a dedicated Celery worker service for SwimRankings data synchronization.

## What Changed

### Before (Blocking API)

Sync tasks ran in the FastAPI process using `BackgroundTasks`, blocking API resources:

```python
# API endpoint
background_tasks.add_task(start_swimmer_sync, swimmer_id, link_id, external_id)
```

**Problems:**
- API process handles both HTTP requests AND heavy sync work
- Sync tasks compete with API requests for resources
- No proper task queue or retry mechanism
- Difficult to scale sync operations independently

### After (Dedicated Worker)

Sync tasks are enqueued to Redis and processed by dedicated Celery workers:

```python
# API endpoint
task = celery_app.send_task('worker.sync_tasks.sync_swimmer_task', kwargs={...})
```

**Benefits:**
- API process only handles HTTP requests (fast response times)
- Dedicated worker process handles sync operations
- Proper task queue with Redis
- Easy to scale workers independently
- Better monitoring and error handling

## Architecture Overview

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────┐      Enqueue       ┌─────────┐
│  Backend    ├─────────────────────>  Redis  │
│  (FastAPI)  │      Task           └────┬────┘
└─────────────┘                          │
                                         │ Consume
                                         ▼
                                  ┌──────────────┐
                                  │    Worker    │
                                  │   (Celery)   │
                                  └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │   Supabase   │
                                  │  (Database)  │
                                  └──────────────┘
```

## Deployment Steps

### 1. Update Environment Variables

Add Redis configuration to `.env`:

```env
# Add these lines
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
```

### 2. Install Dependencies

**Backend:**
```bash
cd backend
pip install celery==5.3.4 redis==5.0.1
```

**Jobs:**
```bash
cd jobs
pip install celery==5.3.4 redis==5.0.1
```

### 3. Deploy with Docker Compose

The updated `docker-compose.yml` includes three new services:

```bash
# Build and start all services
docker-compose build --no-cache
docker-compose up -d

# Verify all services are running
docker-compose ps

# Expected output:
# aquilus-backend    Up
# aquilus-frontend   Up
# aquilus-redis      Up
# aquilus-worker     Up
```

### 4. Verify Worker is Processing Tasks

```bash
# Check worker logs
docker-compose logs -f worker

# Expected output:
# [2024-11-19 10:00:00] celery.worker.consumer: Connected to redis://redis:6379/0
# [2024-11-19 10:00:00] celery.worker.strategy: Starting worker (concurrency=2)
```

### 5. Update Scheduled Jobs

Replace `sync_swimrankings.py` with `enqueue_syncs.py` in your cron/scheduler:

**Old crontab:**
```bash
0 2 * * * cd /root/aquilus-webapp/jobs && python sync_swimrankings.py
```

**New crontab:**
```bash
0 2 * * * cd /root/aquilus-webapp/jobs && REDIS_URL=redis://localhost:6379/0 python enqueue_syncs.py
```

## Testing

### 1. Test Task Enqueueing

Trigger a manual sync via API:

```bash
curl -X POST https://your-domain.com/api/swimmers/{swimmer_id}/sync-external-data \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "message": "Sync task enqueued successfully",
  "external_link_id": "...",
  "task_id": "abc123..."
}
```

### 2. Monitor Task Execution

```bash
# Watch worker logs
docker-compose logs -f worker

# Check Redis queue
docker exec -it aquilus-redis redis-cli
> LLEN celery
(integer) 0  # Should be 0 if worker is processing tasks
```

### 3. Verify Database Updates

Check `swimmer_external_links` table for sync status:

```sql
SELECT 
  id,
  sync_status,
  sync_progress,
  sync_total,
  last_sync_started_at,
  last_sync_completed_at
FROM swimmer_external_links
WHERE swimmer_id = 'YOUR_SWIMMER_ID';
```

## Rollback Plan

If issues occur, you can rollback to the old system:

### 1. Restore Old API Code

```python
# In backend/app/routes/swimmers.py
# Replace Celery task enqueueing with:

from app.tasks.swimrankings_sync import start_swimmer_sync

background_tasks.add_task(
    start_swimmer_sync,
    swimmer_id=swimmer_id,
    external_link_id=link['id'],
    external_id=link['external_id']
)
```

### 2. Stop Worker Services

```bash
docker-compose stop worker redis
```

### 3. Restore Scheduled Jobs

```bash
# Restore old crontab
0 2 * * * cd /root/aquilus-webapp/jobs && python sync_swimrankings.py
```

## Troubleshooting

### Worker Not Starting

**Symptom:** `docker-compose ps` shows worker as "Exit 1"

**Solution:**
```bash
# Check worker logs
docker-compose logs worker

# Common issues:
# - Missing Redis connection: Verify REDIS_URL env var
# - Import errors: Rebuild worker image
docker-compose build --no-cache worker
```

### Tasks Not Being Processed

**Symptom:** `sync_status` stays "pending"

**Solution:**
```bash
# Check Redis connection
docker exec -it aquilus-redis redis-cli ping
# Should return: PONG

# Check queue length
docker exec -it aquilus-redis redis-cli LLEN celery
# If > 0, tasks are queued but not being consumed

# Restart worker
docker-compose restart worker
```

### High Memory Usage

**Symptom:** Worker container uses excessive memory

**Solution:**
```yaml
# Add memory limits to docker-compose.yml
worker:
  deploy:
    resources:
      limits:
        memory: 2G
      reservations:
        memory: 512M
```

### Import Errors in Worker

**Symptom:** Worker logs show `ModuleNotFoundError`

**Solution:**
```bash
# Rebuild worker with fresh dependencies
docker-compose build --no-cache worker

# Verify jobs directory is copied correctly
docker-compose run worker ls -la /app/jobs
```

## Monitoring

### Production Monitoring

1. **Worker Health:**
   ```bash
   # Create healthcheck endpoint
   curl http://worker:8080/health
   ```

2. **Queue Length:**
   ```bash
   # Monitor Redis queue depth
   docker exec -it aquilus-redis redis-cli LLEN celery
   ```

3. **Task Success Rate:**
   ```sql
   -- Query database for sync statistics
   SELECT 
     COUNT(*) FILTER (WHERE sync_status = 'completed') as successful,
     COUNT(*) FILTER (WHERE sync_status = 'failed') as failed,
     COUNT(*) FILTER (WHERE sync_status = 'in_progress') as in_progress
   FROM swimmer_external_links
   WHERE last_sync_started_at > NOW() - INTERVAL '24 hours';
   ```

### Optional: Flower Monitoring UI

Add Flower for visual task monitoring:

```yaml
# docker-compose.yml
flower:
  image: mher/flower
  command: celery --broker=redis://redis:6379/0 flower --port=5555
  ports:
    - "5555:5555"
  depends_on:
    - redis
```

Access at: http://localhost:5555

## Performance Tuning

### Increase Worker Concurrency

For faster processing, increase concurrent workers:

```yaml
# docker-compose.yml
worker:
  command: celery -A worker.celery_app worker --loglevel=info --concurrency=4 -Q sync
```

### Horizontal Scaling

Run multiple worker containers:

```bash
docker-compose up -d --scale worker=3
```

### Rate Limiting

To prevent overwhelming SwimRankings API, adjust delays in `worker/sync_tasks.py`:

```python
# Increase delay between events
await asyncio.sleep(1.0)  # Default: 0.5s
```

## Migration Checklist

- [ ] Update environment variables with Redis configuration
- [ ] Install Celery and Redis in backend and jobs
- [ ] Build and deploy new docker-compose services
- [ ] Verify worker is running and processing tasks
- [ ] Test manual sync via API
- [ ] Update scheduled jobs to use `enqueue_syncs.py`
- [ ] Monitor worker logs for first 24 hours
- [ ] Set up alerting for worker failures
- [ ] Document rollback procedure for team
- [ ] Remove old `start_swimmer_sync` function after stable

## Next Steps

After successful migration:

1. **Add Celery Beat** for automated scheduling (eliminates need for cron)
2. **Implement retry logic** with exponential backoff
3. **Add task prioritization** based on user tier
4. **Set up webhook notifications** on task completion
5. **Implement batch operations** for efficient multi-swimmer syncs

## Support

If you encounter issues:

1. Check worker logs: `docker-compose logs worker`
2. Check Redis connection: `docker exec -it aquilus-redis redis-cli ping`
3. Verify queue status: `docker exec -it aquilus-redis redis-cli LLEN celery`
4. Review database sync status for specific swimmers
5. Check application logs for API errors

For persistent issues, consider:
- Increasing worker memory limits
- Adjusting concurrency settings
- Reviewing Playwright browser stability
- Checking SwimRankings API rate limits
