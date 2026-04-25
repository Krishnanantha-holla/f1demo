#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
VENV_DIR="${ROOT_DIR}/.venv"
PY_BIN="${VENV_DIR}/bin/python"
PIP_BIN="${VENV_DIR}/bin/pip"
UVICORN_BIN="${VENV_DIR}/bin/uvicorn"

SKIP_INSTALL=0

if [[ "${1:-}" == "--skip-install" ]]; then
  SKIP_INSTALL=1
fi

if [[ ! -x "${PY_BIN}" ]]; then
  echo "Missing virtual environment at ${VENV_DIR}"
  echo "Create it with: python3 -m venv ${VENV_DIR}"
  exit 1
fi

cleanup() {
  echo ""
  echo "Stopping dashboard services..."
  kill "${BACKEND_PID:-}" "${AUTOMATOR_PID:-}" "${FRONTEND_PID:-}" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

if [[ "${SKIP_INSTALL}" -eq 0 ]]; then
  echo "Installing backend dependencies..."
  "${PIP_BIN}" install -r "${BACKEND_DIR}/requirements.txt"

  if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
    echo "Installing frontend dependencies..."
    (cd "${FRONTEND_DIR}" && npm install)
  fi
else
  echo "Skipping dependency installation (--skip-install)"
fi

echo "Starting backend API on :8000..."
(cd "${BACKEND_DIR}" && "${UVICORN_BIN}" main:app --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!

echo "Starting automator daemon..."
(cd "${BACKEND_DIR}" && "${PY_BIN}" automator.py) &
AUTOMATOR_PID=$!

echo "Starting frontend dev server..."
(cd "${FRONTEND_DIR}" && npm run dev) &
FRONTEND_PID=$!

echo "Dashboard is running. Press Ctrl+C to stop."
wait "${BACKEND_PID}" "${AUTOMATOR_PID}" "${FRONTEND_PID}"
