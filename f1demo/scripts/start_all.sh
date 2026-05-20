#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

mkdir -p logs

echo "Starting backend (uvicorn) as background process..."
PYTHONPATH=./backend:.:./.venv/lib/python3.12/site-packages /usr/bin/python3.12 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 \
  > logs/backend.log 2>&1 &
echo $! > logs/backend.pid

echo "Starting frontend (vite) as background process..."
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
echo $! > ../logs/frontend.pid

echo "Started backend (pid=$(cat logs/backend.pid)) and frontend (pid=$(cat logs/frontend.pid))."
