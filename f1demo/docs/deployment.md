# Deployment

Three supported deployment paths, in order of operational simplicity.

## 1. Docker Compose (recommended for self-host)

```bash
cd f1demo
cp .env.example .env
# edit .env: set INTERNAL_SECRET, ALLOWED_ORIGINS, OPENF1_* if you have a token
docker compose up --build -d
docker compose logs -f
```

What you get:
- `backend` on `:8000` (FastAPI + uvicorn).
- `automator` running the watch daemon.
- `frontend` on `:5173` (Vite static build behind nginx in the prod compose target).

Health check:
```bash
curl -fsS http://localhost:8000/api/health | jq
```

## 2. Single VM with systemd + nginx

Suitable for a $5/month droplet. Pre-reqs: Python 3.12, Node 20, nginx, a non-root service user.

```bash
sudo useradd -r -m -s /bin/bash f1
sudo -u f1 git clone <your-fork> /home/f1/app
cd /home/f1/app/f1demo
sudo -u f1 python3.12 -m venv .venv
sudo -u f1 ./.venv/bin/pip install -r backend/requirements.txt -r backend/requirements-dev.txt
sudo -u f1 ./.venv/bin/python scripts/generate_circuits_json.py

cd frontend && sudo -u f1 npm ci && sudo -u f1 npm run build
sudo cp -r dist/* /var/www/f1/
```

Create `/etc/systemd/system/f1-backend.service`:
```ini
[Unit]
Description=F1 Demo backend
After=network.target

[Service]
User=f1
WorkingDirectory=/home/f1/app/f1demo/backend
EnvironmentFile=/home/f1/app/f1demo/.env
ExecStart=/home/f1/app/f1demo/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/f1-automator.service`:
```ini
[Unit]
Description=F1 Demo automator
After=network.target f1-backend.service

[Service]
User=f1
WorkingDirectory=/home/f1/app/f1demo/backend
EnvironmentFile=/home/f1/app/f1demo/.env
ExecStart=/home/f1/app/f1demo/.venv/bin/python automator.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now f1-backend f1-automator
```

nginx site:
```nginx
server {
  listen 443 ssl http2;
  server_name f1.example.com;
  ssl_certificate     /etc/letsencrypt/live/f1.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/f1.example.com/privkey.pem;

  root /var/www/f1;
  index index.html;
  try_files $uri /index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # WebSocket upgrade path
  location /ws/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 1h;
  }

  # SSE fallback — disable buffering and lengthen timeouts
  location /api/live/sse {
    proxy_pass http://127.0.0.1:8000;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
    proxy_set_header X-Accel-Buffering no;
  }
}
```

## 3. Managed PaaS (Fly.io / Render / Railway)

Each platform expects:
- A `fly.toml` / `render.yaml` / `railway.json` pointing to `backend/Dockerfile` for the API and
  `automator` worker.
- Environment variables set through the platform UI (do **not** commit `.env` to the repo).
- A static-site build for the frontend: `cd frontend && npm ci && npm run build && cp -r dist
  /static`.

The backend container respects `PORT` if you replace the `uvicorn ... --port 8000` line with
`--port ${PORT:-8000}`.

## Required environment variables

| Variable             | Required        | Notes                                                |
|----------------------|-----------------|------------------------------------------------------|
| `APP_ENV`            | yes (prod)      | `development` or `production`                        |
| `INTERNAL_SECRET`    | yes (prod)      | Refuses to boot in prod if missing or default value  |
| `ALLOWED_ORIGINS`    | yes (prod)      | Comma-separated origins for CORS                     |
| `SENTRY_DSN`         | optional        | Enables Sentry SDK if `sentry-sdk` is installed      |
| `OPENF1_ACCESS_TOKEN`| optional        | Or pair `OPENF1_USERNAME`/`OPENF1_PASSWORD`          |
| `GITHUB_TOKEN`       | optional        | Higher rate limit for TracingInsights polling        |
| `REDIS_URL`          | optional        | Switches `cache_store` from in-memory to Redis       |
| `VITE_API_BASE_URL`  | optional        | Frontend default: `http://localhost:8000/api`        |
| `VITE_WS_URL`        | optional        | Frontend default: `ws://localhost:8000/ws/live`      |

## Operations playbook

- **Rotate `INTERNAL_SECRET`:** update env on backend AND automator; restart both. Old value
  stops working immediately so brief overlap of stale automator → 403 is expected.
- **Bust the cache manually:** `curl -X POST $BACKEND/internal/refresh-cache -H
  "X-Internal-Secret: $INTERNAL_SECRET"`.
- **Regenerate circuit metadata:** `python scripts/generate_circuits_json.py` then redeploy /
  restart the backend.
- **Backup state:** the automator persists to `backend/state.json`; back it up daily if you care
  about live-session detection across restarts.
