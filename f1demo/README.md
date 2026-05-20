# F1 Dashboard

A live Formula 1 companion: timing, telemetry, standings, calendar, and news in one place.

- **Live timing** over WebSocket with automatic SSE fallback when the WS path is blocked.
- **Telemetry** powered by FastF1, downsampled with LTTB so the wire payload stays small.
- **Standings + results** via Jolpica/Ergast with FastF1 fallback.
- **News** aggregated from nine RSS sources, deduped by case-insensitive title.
- **Accessibility-first UI**: skip link, visible focus rings, ARIA live regions for race
  control, and `prefers-reduced-motion` honored throughout.
- **Production-hardened**: refuses to boot without `INTERNAL_SECRET` and `ALLOWED_ORIGINS`,
  structured request logging, optional Sentry, in-process + pluggable cache.

## Quick start

```bash
git clone <fork-url>
cd f1demo

cp .env.example .env
# edit .env — pick any value for INTERNAL_SECRET in development

# Bring up everything in containers
docker compose up --build
```

Open http://localhost:5173. The API is at http://localhost:8000 (`/docs` for OpenAPI).

## Local development

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt -r backend/requirements-dev.txt
cd frontend && npm ci && cd ..

# Backend (terminal 1)
cd backend && ../.venv/bin/python -m uvicorn main:app --reload --port 8000

# Frontend (terminal 2)
cd frontend && npm run dev
```

The VS Code workspace ships with launch and task configs (see `.vscode/`). Press
`Ctrl+Shift+B` to run the backend test suite.

## Architecture

Three runtime processes — FastAPI backend (`/api/*`, `/ws/live`, `/api/live/sse`), automator
daemon (live-session watcher + cache invalidation), and the Vite SPA. Full details and
module-by-module map: [docs/architecture.md](docs/architecture.md).

## Docs

- [docs/architecture.md](docs/architecture.md) — runtime topology, modules, data flow.
- [docs/deployment.md](docs/deployment.md) — Docker Compose, systemd, PaaS recipes.
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — setup, commit conventions, PR checklist.
- [.env.example](.env.example) — every supported env var with comments.

## Project status

- Phase 0 (boot blockers): ✅ complete — see `PHASE_0_COMPLETE.md`.
- Phase 1 (live reliability + a11y): ✅ complete — see `REMEDIATION_PROMPT.md`.
- Phase 2+ roadmap: see `COMPLETION_PROMPT.md`.

## License

See `LICENSE` (TBD).
