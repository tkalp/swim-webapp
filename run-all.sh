#!/bin/bash

# Aquilus Webapp - Run Everything Locally
# Starts backend API, frontend dev server, and Celery worker
# Requires: Redis and PostgreSQL running separately (Docker or native)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
WORKER_DIR="$SCRIPT_DIR"

BACKEND_PID=""
FRONTEND_PID=""
WORKER_PID=""

cleanup() {
    echo ""
    echo -e "${BLUE}[INFO]${NC} Shutting down all processes..."
    [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null || true
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null || true
    [ -n "$WORKER_PID" ] && kill $WORKER_PID 2>/dev/null || true
    wait 2>/dev/null || true
    echo -e "${GREEN}[OK]${NC} All processes stopped."
}

trap cleanup EXIT

# ── Resolve venv Python ───────────────────────────────

if [ ! -d "$BACKEND_DIR/.venv" ]; then
    echo -e "${RED}[ERROR]${NC} Backend venv not found at $BACKEND_DIR/.venv"
    exit 1
fi

# Use absolute path to venv Python — avoids Windows PATH issues with background processes
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    VENV_PYTHON="$BACKEND_DIR/.venv/Scripts/python.exe"
else
    VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"
fi

if [ ! -f "$VENV_PYTHON" ]; then
    echo -e "${RED}[ERROR]${NC} Venv Python not found at $VENV_PYTHON"
    exit 1
fi

echo -e "${BLUE}[INFO]${NC} Using Python: $VENV_PYTHON"

# ── Checks ────────────────────────────────────────────

for cmd in node npm; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo -e "${RED}[ERROR]${NC} $cmd not found in PATH"
        exit 1
    fi
done

# ── Load backend .env ─────────────────────────────────

if [ -f "$BACKEND_DIR/.env" ]; then
    echo -e "${BLUE}[INFO]${NC} Loading backend/.env"
    set -a
    source "$BACKEND_DIR/.env"
    set +a
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}[ERROR]${NC} DATABASE_URL not set. Add it to backend/.env"
    exit 1
fi

if [ -z "$REDIS_URL" ]; then
    export REDIS_URL="redis://localhost:6379/0"
    echo -e "${YELLOW}[WARN]${NC} REDIS_URL not set, defaulting to $REDIS_URL"
fi

# ── Connectivity checks ──────────────────────────────

echo -e "${BLUE}[INFO]${NC} Checking Redis..."
if ! "$VENV_PYTHON" -c "import redis; r = redis.from_url('$REDIS_URL'); r.ping()" 2>/dev/null; then
    echo -e "${RED}[ERROR]${NC} Cannot connect to Redis at $REDIS_URL"
    echo -e "${YELLOW}[HINT]${NC} Start Redis: docker run -d -p 6379:6379 redis:7-alpine"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Redis connected"

echo -e "${BLUE}[INFO]${NC} Checking PostgreSQL..."
if command -v pg_isready >/dev/null 2>&1; then
    if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        echo -e "${RED}[ERROR]${NC} Cannot connect to PostgreSQL on localhost:5432"
        exit 1
    fi
else
    echo -e "${YELLOW}[WARN]${NC} pg_isready not found, skipping Postgres check"
fi
echo -e "${GREEN}[OK]${NC} PostgreSQL connected"

# ── Start Backend ─────────────────────────────────────

echo -e "${BLUE}[INFO]${NC} Starting backend API (port 8000)..."
cd "$BACKEND_DIR"
"$VENV_PYTHON" -m uvicorn app.main:app --reload --port 8000 --host 0.0.0.0 2>&1 | sed "s/^/  ${CYAN}[api]${NC} /" &
BACKEND_PID=$!
sleep 3

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}[ERROR]${NC} Backend failed to start"
    exit 1
fi

# ── Start Celery Worker ───────────────────────────────

echo -e "${BLUE}[INFO]${NC} Starting Celery worker..."
cd "$WORKER_DIR"

export PYTHONPATH="$WORKER_DIR:$WORKER_DIR/worker/swim-scraper:$BACKEND_DIR:$PYTHONPATH"

"$VENV_PYTHON" -m celery -A worker.celery_app worker --loglevel=info --concurrency=1 -Q sync,celery --pool=solo 2>&1 | sed "s/^/  ${YELLOW}[worker]${NC} /" &
WORKER_PID=$!
sleep 3

if ! kill -0 $WORKER_PID 2>/dev/null; then
    echo -e "${RED}[ERROR]${NC} Celery worker failed to start"
    exit 1
fi

# ── Start Frontend ────────────────────────────────────

echo -e "${BLUE}[INFO]${NC} Starting frontend (port 5173)..."
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[WARN]${NC} node_modules missing, running npm install..."
    npm install
fi

npm run dev 2>&1 | sed "s/^/  ${GREEN}[web]${NC} /" &
FRONTEND_PID=$!
sleep 2

# ── Ready ─────────────────────────────────────────────

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN} Aquilus is running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Frontend:  ${CYAN}http://localhost:5173${NC}"
echo -e "  Backend:   ${CYAN}http://localhost:8000${NC}"
echo -e "  API Docs:  ${CYAN}http://localhost:8000/docs${NC}"
echo -e "  Worker:    ${YELLOW}Celery (concurrency=1, queues: sync,celery)${NC}"
echo ""
echo -e "  Press ${RED}Ctrl+C${NC} to stop everything"
echo ""

wait
