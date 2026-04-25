# F1 Dashboard

Full-stack Formula 1 dashboard with live session companion features, historical telemetry, standings, race calendar, and curated news.

## Project Layout

- `backend/` - FastAPI service, data aggregation, caching, and automation daemon
- `frontend/` - React + Vite single-page app
- `start_dashboard.sh` - starts backend API, automator, and frontend in one command

## Quick Start

```bash
cd f1demo
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd frontend && npm install && cd ..
./start_dashboard.sh --skip-install
```

Use `./start_dashboard.sh` without flags to run with dependency install checks.

## Backend

- API: FastAPI (`backend/main.py`)
- Optional cache backend: Redis via `REDIS_URL`
- Optional OpenF1 auth:
  - `OPENF1_ACCESS_TOKEN`
  - or `OPENF1_USERNAME` + `OPENF1_PASSWORD`

### Backend Tests

```bash
cd backend
../.venv/bin/pip install -r requirements-dev.txt
../.venv/bin/pytest -q
```

## Frontend

See `frontend/README.md` for scripts and environment variables.
