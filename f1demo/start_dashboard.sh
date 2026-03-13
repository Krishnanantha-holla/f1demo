#!/bin/bash
echo "Installing Backend Requirements..."
cd "$(dirname "$0")/backend"
../.venv/bin/pip install -r requirements.txt

echo "Starting Backend API..."
../.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "Starting Automator Daemon..."
../.venv/bin/python automator.py &
AUTOMATOR_PID=$!

echo "Starting Frontend..."
cd ../frontend
npm install
npm run dev &
FRONTEND_PID=$!

echo "Dashboard is running. Press Ctrl+C to stop."
wait $BACKEND_PID $AUTOMATOR_PID $FRONTEND_PID
