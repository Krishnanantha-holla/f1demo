# Contributing

Welcome! This guide takes you from fresh clone to merged PR.

## 1. Setup (one-time)

```bash
git clone <fork-url>
cd f1demo

# Backend Python env
python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt -r backend/requirements-dev.txt

# Frontend
cd frontend && npm ci && cd ..

# Pre-commit hooks
pre-commit install

# Local env
cp .env.example .env
# edit .env: set INTERNAL_SECRET to anything in development
```

## 2. Run locally

```bash
# In one terminal — backend
cd backend && ../.venv/bin/python -m uvicorn main:app --reload --port 8000

# In another — frontend
cd frontend && npm run dev

# (optional) in a third — automator
cd backend && ../.venv/bin/python automator.py
```

Or use the VS Code task `all: ci-equivalent` to run lint + tests + build in one shot.

## 3. Local CI loop

```bash
# Backend
./.venv/bin/python -m pytest -q backend/tests

# Frontend
cd frontend && npm run lint && npm test && npm run build
```

`./scripts/run_ci.sh` chains these together.

## 4. Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

| Type       | When                                           | Example                                      |
|------------|------------------------------------------------|----------------------------------------------|
| `feat:`    | New user-visible feature                       | `feat(news): cluster related articles`       |
| `fix:`     | Bug fix                                        | `fix(live): reconnect after WS unmount race` |
| `refactor:`| Internal change without behavior change        | `refactor(routes): split telemetry helpers`  |
| `docs:`    | Documentation only                             | `docs: deployment playbook`                  |
| `test:`    | Test additions / changes                       | `test(downsample): cover empty input`        |
| `chore:`   | Tooling, deps, configuration                   | `chore(deps): bump vitest to 2.1`            |
| `perf:`    | Performance improvement                        | `perf(telemetry): LTTB cap at 2000 points`   |
| `style:`   | Formatting / whitespace only                   | `style: ruff-format pass`                    |

## 5. Pull request checklist

The repo template at `.github/pull_request_template.md` covers the full list. The short
version:

- Tests pass (`pytest`, `npm test`, `npm run build`).
- `npm run lint` is clean.
- Pre-commit hooks pass on staged files.
- Screenshots or a short clip for any UI change.
- `.env.example` updated if you added an env var.
- `docs/*` updated if behavior or deployment changes.

## 6. Branching

- `main` is always green. Direct commits land via PRs only.
- Feature branches: `feat/<short-slug>` or `fix/<short-slug>`.
- Rebase before merge; we squash-merge to keep history readable.

## 7. Code style

- **Python**: ruff handles both lint and format. Defaults are in
  `backend/pyproject.toml` (or `.pre-commit-config.yaml`). Don't fight the formatter.
- **JavaScript / JSX**: ESLint + Prettier. Run `npm run lint -- --fix` for auto-fixable issues.
- **CSS**: tokens in `:root`, animations via existing `--ease-out-expo` / keyframes, respect
  `prefers-reduced-motion`. Prefer extending an existing class over inline styles.
- **A11y**: every interactive element needs a visible focus ring (already wired via
  `:focus-visible` in `styles.css`). Live regions use `role="status"` + `aria-live="polite"`.

## 8. Testing philosophy

- **Backend**: route-level tests in `backend/tests/` against the FastAPI `TestClient`. Mock
  external HTTP at the `httpx.AsyncClient` boundary. Don't make real calls to OpenF1 in CI.
- **Frontend**: Vitest + Testing Library for components and hooks. Aim for behavior, not
  implementation details. Use fake timers for animations / timeouts.
- **End-to-end**: Playwright tests live under `frontend/e2e/` (stretch, not required for every
  PR). Run with `npm run test:e2e`.

## 9. Reporting issues

- Backend bugs: include `curl -i` output, the relevant `/api/health` payload, and the request
  ID from `x-request-id`.
- Frontend bugs: browser, OS, console errors, and a screenshot or recording.
- Live-data bugs: include the OpenF1 session_key and a UTC timestamp.

## 10. Where to find what

- `AUDIT.md` — historical Phase 0 audit.
- `PHASE_0_COMPLETE.md` — Phase 0 fix summary.
- `PHASE_1_ROADMAP.md` — what's planned post-stabilization.
- `REMEDIATION_PROMPT.md` — Phase 0/1 cleanup prompt (already executed).
- `COMPLETION_PROMPT.md` — full v1.0 plan (in progress).
- `docs/architecture.md` — runtime topology and module map.
- `docs/deployment.md` — Docker, systemd, PaaS recipes.

## Code of conduct

Be kind, be specific, and assume good faith. Bug reports and PRs are equally welcome.
