#!/bin/bash

# Aquilus Webapp Run Script
# Starts both backend and frontend servers concurrently

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to kill background processes on exit
cleanup() {
    print_status "Shutting down servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    wait 2>/dev/null || true
    print_success "Cleanup complete"
}

# Set up trap to cleanup on exit
trap cleanup EXIT

# Check required commands
print_status "Checking dependencies..."

if ! command_exists python && ! command_exists python3; then
    print_error "Python is not installed or not in PATH"
    exit 1
fi

if ! command_exists node; then
    print_error "Node.js is not installed or not in PATH"
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed or not in PATH"
    exit 1
fi

# Determine Python command
PYTHON_CMD="python"
if command_exists python3; then
    PYTHON_CMD="python3"
fi

print_success "Dependencies check passed"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Check if directories exist
if [ ! -d "$BACKEND_DIR" ]; then
    print_error "Backend directory not found: $BACKEND_DIR"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Frontend directory not found: $FRONTEND_DIR"
    exit 1
fi

# Setup backend
print_status "Setting up backend..."
cd "$BACKEND_DIR"

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    print_warning "Virtual environment not found. Creating one..."
    $PYTHON_CMD -m venv .venv
fi

# Activate virtual environment
print_status "Activating virtual environment..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    source .venv/Scripts/activate
else
    source .venv/bin/activate
fi

# Install backend dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    print_status "Installing backend dependencies..."
    pip install -r requirements.txt
fi

# Setup frontend
print_status "Setting up frontend..."
cd "$FRONTEND_DIR"

# Install frontend dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing frontend dependencies..."
    npm install
fi

# Start backend server
print_status "Starting backend server (http://localhost:8000)..."
cd "$BACKEND_DIR"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    source .venv/Scripts/activate
else
    source .venv/bin/activate
fi

uvicorn app.main:app --reload --port 8000 --host 0.0.0.0 &
BACKEND_PID=$!

# Give backend time to start
sleep 3

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    print_error "Backend failed to start"
    exit 1
fi

print_success "Backend server started (PID: $BACKEND_PID)"

# Start frontend server
print_status "Starting frontend server (http://localhost:5173)..."
cd "$FRONTEND_DIR"

npm run dev &
FRONTEND_PID=$!

# Give frontend time to start
sleep 3

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    print_error "Frontend failed to start"
    exit 1
fi

print_success "Frontend server started (PID: $FRONTEND_PID)"

# Print status
echo ""
print_success "🚀 Aquilus Webapp is running!"
echo ""
echo "  📱 Frontend: http://localhost:5173"
echo "  🔧 Backend:  http://localhost:8000"
echo "  📚 API Docs: http://localhost:8000/docs"
echo ""
print_status "Press Ctrl+C to stop both servers"
echo ""

# Wait for servers to finish (or be interrupted)
wait
