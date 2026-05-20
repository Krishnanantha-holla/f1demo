# Phase 0 Audit

Scope: read-only audit of meaningful source files outside `.venv`, `node_modules`, `.git`, `__pycache__`, `cache/`, `*.log`, `*.sqlite`, and `package-lock.json`.

## Executive Summary

The repository is not bootable as-is. There are three hard blockers in the backend/frontend boundary and one packaging blocker:

1. [backend/utils.py](/home/krishnanantha/f1demo/f1demo/backend/utils.py) has a real Python syntax error, so the backend cannot import cleanly.
2. [backend/routes/live.py](/home/krishnanantha/f1demo/f1demo/backend/routes/live.py) calls the live-stream service with the wrong signature, and the service itself hits the wrong OpenF1 paths.
3. [backend/routes/misc.py](/home/krishnanantha/f1demo/f1demo/backend/routes/misc.py) tries to import a frontend JavaScript module from Python.
4. [frontend/package.json](/home/krishnanantha/f1demo/f1demo/frontend/package.json) is invalid JSON, so npm cannot parse it.

There is also a dead-state mismatch: [backend/automator.py](/home/krishnanantha/f1demo/f1demo/backend/automator.py) writes `public/session_mode.json`, but the app only reads `/api/session-mode`.

## Confirmed Blockers

### [backend/utils.py](/home/krishnanantha/f1demo/f1demo/backend/utils.py)
Purpose: shared backend utilities, OpenF1 auth, cached HTTP, schedule helpers, state-file access, and TracingInsights validation.

Public surface: `logger`, `HAS_FASTF1`, `CACHE_TTL`, `cached_get`, `safe_cached_get`, `current_year`, `_event_session_windows`, `_build_free_context`, `_ensure_utc`, `_fastf1_schedule_records`, `_fastf1_sessions_for_round`, `_fetch_openf1_token`, `_get_openf1_token`, `_openf1_headers`, `_read_state_file`, plus API constants.

Findings:
- Hard blocker: the `except ImportError:` block has inconsistent indentation, and `python3 -m py_compile backend/utils.py` fails with `IndentationError: unindent does not match any outer indentation level` at line 35.
- Hard blocker: `_validate_ti_param` is nested under `_openf1_headers` instead of being top-level, so it is unreachable and not actually exported.
- Bug: `cached_get(url, ttl=...)` ignores the passed `ttl` for in-memory caching because `_cache` is a fixed 60-second `TTLCache` and the cache key is only the URL.
- Dead code / smell: `cache_backend_name`, `cache_clear`, `cache_lookup`, `cache_write`, and `fetch_news` are imported but not used here.
- Pull weight: yes, but only after the indentation and helper-placement fixes. This is core backend infrastructure and should stay.

### [backend/routes/live.py](/home/krishnanantha/f1demo/f1demo/backend/routes/live.py)
Purpose: OpenF1 proxy endpoints and the WebSocket live-timing route.

Public surface: `/live/{endpoint}`, `/drivers`, `/meetings`, `/sessions`, `/sessions/meeting/{meeting_key}`, `/positions`, `/laps`, `/pits`, `/stints`, `/weather`, `/race_control`, `/car_data`, `/intervals`, `/session_result`, `/starting_grid`, `/overtakes`, `/team_radio`, `/session-mode`, and `/ws/live`.

Findings:
- Hard blocker: `ws_live()` calls `stream_live_session(websocket, logger, cached_get)`, but [backend/services/live_stream.py](/home/krishnanantha/f1demo/f1demo/backend/services/live_stream.py) requires keyword-only args, so the first WebSocket connect will raise `TypeError`.
- Hard blocker after fixing utils: it imports `_validate_ti_param` from `utils`, but that symbol is currently not top-level.
- Bug: `live_proxy()` exposes `/positions`, but the WebSocket service polls `/position` singular; that path mismatch will likely 404 even after the signature fix.
- Bug: `/race_control` proxy targets `race_control_messages`, while the WebSocket service targets `race_control`; the two code paths do not agree on the upstream resource name.
- Smell: the module imports `re` and `Request` but does not use them.
- Pull weight: yes, but only after fixing the service call and upstream paths. This is a core live-data route.

### [backend/services/live_stream.py](/home/krishnanantha/f1demo/f1demo/backend/services/live_stream.py)
Purpose: poll OpenF1 and stream live session snapshots over WebSocket.

Public surface: `openf1_json_tail()`, `stream_live_session()`.

Findings:
- Bug: the function is correctly defined with keyword-only parameters, but the caller in `routes/live.py` does not provide them.
- Bug: it polls `/position` and `/race_control`, which do not match the backend proxy naming or the likely OpenF1 collection names used elsewhere.
- Perf: the loop is fixed at 8 seconds with no jitter or adaptive backoff.
- Pull weight: yes, but this should be tightened before any live UX is built on top of it.

### [backend/routes/misc.py](/home/krishnanantha/f1demo/f1demo/backend/routes/misc.py)
Purpose: news, bios, internal cache refresh, and circuit-map lookup.

Public surface: `/news`, `/bios`, `/internal/refresh-cache`, `/circuit-map/{circuit_key}`.

Findings:
- Hard blocker: `circuit_map()` does `__import__('circuitData')`, but [frontend/src/circuitData.js](/home/krishnanantha/f1demo/f1demo/frontend/src/circuitData.js) is a JavaScript module, not a Python module. This route will not work as written.
- Hard blocker after fixing utils: it imports `_validate_ti_param` from `utils`, which is currently unreachable.
- Bug: `year` is accepted by `/circuit-map/{circuit_key}` but unused.
- Smell: `cached_get` is imported but unused.
- Pull weight: the news and bio endpoints are useful; the circuit-map route should be reimplemented against a Python-side data source or removed.

### [frontend/package.json](/home/krishnanantha/f1demo/f1demo/frontend/package.json)
Purpose: frontend package manifest and scripts.

Public surface: `dev`, `build`, `lint`, `test`, `test:watch`, `preview`.

Findings:
- Hard blocker: the file is invalid JSON. `node -e "JSON.parse(...)"` fails at the `vitest` block because the comma after `vite` is missing and the `devDependencies` block is malformed.
- Impact: `npm install`, `npm ci`, and CI parsing all fail until this is fixed.
- Pull weight: yes; this is the central frontend manifest and must be repaired, not replaced.

### [backend/automator.py](/home/krishnanantha/f1demo/f1demo/backend/automator.py)
Purpose: background daemon that tracks live sessions, TracingInsights commits, and season rollover.

Public surface: `get_state()`, `save_state()`, `detect_live_session()`, `check_tracinginsights()`, `trigger_refresh()`, `set_mode()`, `check_season_rollover()`, `main_loop()`.

Findings:
- Bug / dead contract: `set_mode()` writes `public/session_mode.json` under the backend CWD, but the frontend only reads `/api/session-mode` through the backend; the file is currently unused.
- Recommendation: delete the file write unless you intentionally wire a new frontend contract to consume it.
- Smell: the daemon is otherwise coherent and useful, but the session-mode side channel is dead state today.

## Backend Files That Matter

### [backend/main.py](/home/krishnanantha/f1demo/f1demo/backend/main.py)
Purpose: FastAPI app assembly and router registration.

Public surface: `app`, CORS/rate-limit setup, router inclusion, uvicorn entrypoint.

Findings:
- Good: this file is now small and mostly orchestration, which is the right shape.
- Risk: because `utils.py` does not parse, the app cannot import cleanly even though this file is structurally fine.
- Keep it. This should remain the composition root.

### [backend/routes/health.py](/home/krishnanantha/f1demo/f1demo/backend/routes/health.py)
Purpose: health and season endpoints.

Public surface: `/health`, `/season`.

Findings:
- Good: returns useful runtime health, automator age, and backend cache info.
- Smell: `JSONResponse`, `Path`, and `FileLock` are imported but unused.
- Keep it. This is a small, valuable route module.

### [backend/routes/schedule.py](/home/krishnanantha/f1demo/f1demo/backend/routes/schedule.py)
Purpose: schedule, standings, results, and free-context endpoints.

Public surface: `/schedule`, `/next-race`, `/standings/drivers`, `/standings/constructors`, `/results/last`, `/results/{year}/{round_num}`, `/free/context`, `/free/roster`.

Findings:
- Bug risk: it creates its own `Limiter` instance instead of reusing the app limiter from `main.py`; rate limiting may not actually be enforced the way the decorators imply.
- Perf: `next_race()` and `schedule()` call FastF1 in-thread, which is acceptable, but the `next_race()` branching is a bit brittle around timezone-aware schedules.
- Keep it, but fix the limiter wiring and add coverage around the critical endpoints.

### [backend/routes/telemetry.py](/home/krishnanantha/f1demo/f1demo/backend/routes/telemetry.py)
Purpose: FastF1 lap, telemetry, and comparison endpoints.

Public surface: `/laps/{year}/{event}/{session_type}`, `/telemetry/{year}/{event}/{session_type}/{driver}`, `/compare`.

Findings:
- Good: this is the right place for the heavy FastF1 work, and it already guards invalid years/session types.
- Perf: `get_telemetry()` samples every fifth point, but there is no server-side LTTB or cap at ~2,000 points yet.
- Keep it, but this will need a split and stronger downsampling for Phase 4.

### [backend/routes/ti.py](/home/krishnanantha/f1demo/f1demo/backend/routes/ti.py)
Purpose: TracingInsights proxy endpoints.

Public surface: `/ti/events/{year}`, `/ti/sessions/{year}/{event}`, `/ti/drivers/{year}/{event}/{session}`, `/ti/laptimes/{year}/{event}/{session}/{driver}`, `/ti/telemetry/{year}/{event}/{session}/{driver}/{lap}`, `/ti/weather/{year}/{event}/{session}`.

Findings:
- Good: the route-level validation pattern is sound once `_validate_ti_param` is restored to top level.
- Risk: all of these routes depend on the broken helper export in `utils.py`.
- Keep it. This is a good thin proxy layer once the helper is fixed.

### [backend/services/free_context.py](/home/krishnanantha/f1demo/f1demo/backend/services/free_context.py)
Purpose: pure helper layer for schedule serialization and free-context state.

Public surface: `current_year()`, `ensure_utc()`, `serialize_value()`, `serialize_event_row()`, `event_session_windows()`, `build_free_context()`.

Findings:
- Good: this is a clean seam and one of the better-structured backend modules.
- Keep it. This is reusable and worth preserving.

### [backend/services/news_service.py](/home/krishnanantha/f1demo/f1demo/backend/services/news_service.py)
Purpose: RSS aggregation for the news endpoint.

Public surface: `SOURCES`, `_parse_date()`, `_extract_image()`, `_extract_summary()`, `_extract_published()`, `fetch_news()`.

Findings:
- Functional but shallow: it fetches 9 feeds, sorts by published time, and dedupes only by exact lower-cased title.
- Missing Phase 3 features: no relevance filtering, no F1 vocabulary gate, no entity scoring, no clustering, no related articles, no favorites hook, no trending endpoint, no stale-while-revalidate.
- Keep as a placeholder only if you need a working baseline; otherwise this should be replaced rather than extended piecemeal.

### [backend/cache_store.py](/home/krishnanantha/f1demo/f1demo/backend/cache_store.py)
Purpose: shared in-process cache with optional Redis.

Public surface: `cache_lookup()`, `cache_write()`, `cache_clear()`, `cache_backend_name()`.

Findings:
- Good: small, focused, and practical.
- Risk: `cache_clear()` scans Redis keys, which is fine for a small keyspace but not ideal at scale.
- Keep it.

### [backend/test_fastf1.py](/home/krishnanantha/f1demo/f1demo/backend/test_fastf1.py)
Purpose: ad-hoc FastF1 connectivity smoke script.

Public surface: none.

Findings:
- This is not a real test module; it prints to stdout and performs network calls.
- Recommendation: delete or move it to docs/scripts. It does not belong in the test surface.

## Backend Tests

### [backend/tests/test_api.py](/home/krishnanantha/f1demo/f1demo/backend/tests/test_api.py)
Purpose: endpoint and security tests.

Public surface: async HTTP tests for health, season, cache refresh, validation, and TI path safety.

Findings:
- Good baseline coverage, especially for the validation paths.
- Missing requested coverage: WebSocket happy path/reconnect, circuit map, news ranking, automator state round-trip.
- It will not pass until the backend syntax/import blockers are fixed.
- Keep and extend.

### [backend/tests/test_main_utils.py](/home/krishnanantha/f1demo/f1demo/backend/tests/test_main_utils.py)
Purpose: utility-level tests for main-module helpers.

Public surface: tests for `_ensure_utc`, `_event_session_windows`, and `_openf1_json_tail`.

Findings:
- Broken test: it asserts `main._openf1_json_tail(...)`, but the backend helper actually lives as `openf1_json_tail()` in [backend/services/live_stream.py](/home/krishnanantha/f1demo/f1demo/backend/services/live_stream.py).
- This test needs to be rewritten or removed.

### [backend/tests/test_cache_store.py](/home/krishnanantha/f1demo/f1demo/backend/tests/test_cache_store.py)
Purpose: cache backend behavior tests.

Public surface: memory cache hit/expiry, cache clear, backend name.

Findings:
- Good, focused, and worth keeping.

## Frontend App Shell

### [frontend/src/main.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/main.jsx)
Purpose: browser entrypoint and root render.

Public surface: app bootstrap.

Findings:
- Good and minimal.
- Keep it.

### [frontend/src/App.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/App.jsx)
Purpose: route composition and lazy loading.

Public surface: top-level routes and layout wiring.

Findings:
- Good: routes are code-split with `lazy()` and wrapped in `Suspense`.
- Thin wrapper modules like `pages/analysis/index.js`, `pages/telemetry/index.js`, and `pages/raceDetail/index.js` are appropriate and should stay.
- Keep it.

### [frontend/src/api.js](/home/krishnanantha/f1demo/f1demo/frontend/src/api.js)
Purpose: all browser API calls and team color utilities.

Public surface: `api`, `ApiError`, `TEAM_COLORS`, `getTeamColor()`.

Findings:
- Good transport abstraction and generally well-structured.
- Risk: several calls assume backend routes that are currently broken (`sessionMode`, `live`, `circuitMap`, `news`).
- Keep it.

### [frontend/src/store/useF1Store.js](/home/krishnanantha/f1demo/f1demo/frontend/src/store/useF1Store.js)
Purpose: Zustand app state.

Public surface: session state, standings, roster, next race, last results, UI flags, loading flags, setters.

Findings:
- Good and lightweight.
- Keep it.

### [frontend/src/hooks/useAppInit.js](/home/krishnanantha/f1demo/f1demo/frontend/src/hooks/useAppInit.js)
Purpose: initial dashboard data load.

Public surface: `useAppInit()`.

Findings:
- Works, but it uses blocking `Promise.all` for standings and then individual side fetches; it is not yet aligned with the independent widget-loading requirement.
- Error handling is intentionally shallow, which is fine for now but not for Phase 2.
- Keep it for now; refactor when the dashboard is redesigned.

### [frontend/src/hooks/useWebSocket.js](/home/krishnanantha/f1demo/f1demo/frontend/src/hooks/useWebSocket.js)
Purpose: WebSocket reconnect logic.

Public surface: `useWebSocket({ onMessage, enabled })`.

Findings:
- Bug: the reconnect timer is scheduled from `onclose` even during cleanup, so unmounting can still trigger a reconnect unless an explicit active flag is added.
- Missing Phase 6 features: jittered backoff and SSE fallback.
- Keep it, but fix the lifecycle leak before relying on it in production.

### [frontend/src/hooks/useLiveSession.js](/home/krishnanantha/f1demo/f1demo/frontend/src/hooks/useLiveSession.js)
Purpose: polling hook for live session mode and live data.

Public surface: `useLiveSession()`.

Findings:
- Dead code: this hook is not referenced anywhere in `frontend/src`.
- It also uses blocking `Promise.all` for live data polling and assumes the backend live route works.
- Recommendation: delete or wire it into the app; keeping unused live-control code increases maintenance noise.

### [frontend/src/components/LiveCompanion.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/components/LiveCompanion.jsx)
Purpose: compact live timing tower / live banner.

Public surface: default React component.

Findings:
- Good UX value and a strong current feature.
- Depends on live WebSocket data, so it will remain brittle until the backend WS path is fixed.
- Keep it.

### [frontend/src/components/SessionSelector.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/components/SessionSelector.jsx)
Purpose: TI event/session picker.

Public surface: default React component with `onChange` callback.

Findings:
- Useful, but the year list is hard-coded to 2024–2026, so it will age quickly.
- Keep it, but make the year range dynamic later.

### [frontend/src/components/Sidebar.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/components/Sidebar.jsx)
Purpose: main navigation shell.

Public surface: default React component.

Findings:
- Good and compact.
- Local collapse state is fine for now.
- Keep it.

### [frontend/src/components/LapDeltaChart.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/components/LapDeltaChart.jsx)
Purpose: SVG lap comparison chart.

Public surface: default React component.

Findings:
- Useful, but still limited to a single comparison view.
- Keep it, but this will be one of the first components to split further in Phase 4.

### [frontend/src/components/PaceStrip.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/components/PaceStrip.jsx)
Purpose: compact pace distribution chart.

Public surface: default React component.

Findings:
- Useful and lightweight.
- Keep it.

### [frontend/src/components/TeamRadio.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/components/TeamRadio.jsx)
Purpose: team radio clips list and player.

Public surface: default React component.

Findings:
- Good utility component.
- Keep it.

### [frontend/src/components/WeatherStrip.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/components/WeatherStrip.jsx)
Purpose: weather summary chips.

Public surface: default React component.

Findings:
- Good and small.
- Keep it.

### [frontend/src/components/Shared.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/components/Shared.jsx)
Purpose: small shared UI primitives and date helpers.

Public surface: `Loading`, `ErrorMsg`, `EmptyMsg`, `formatDate`, `formatDateFull`, `pad`.

Findings:
- Good and simple.
- Keep it.

### [frontend/src/circuitData.js](/home/krishnanantha/f1demo/f1demo/frontend/src/circuitData.js)
Purpose: circuit metadata and track SVG data used by the frontend.

Public surface: default `CIRCUITS`, `getCircuitData()` and helper functions.

Findings:
- Important data module and the correct home for circuit metadata.
- This is exactly why the backend `__import__('circuitData')` approach is wrong.
- Keep it frontend-only unless you intentionally duplicate the data on the backend side.

## Frontend Pages

### [frontend/src/pages/Dashboard.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/pages/Dashboard.jsx)
Purpose: landing dashboard and live weekend overview.

Public surface: default page component plus local subcomponents for banners, next race, weekend radar, standings, and live session panel.

Findings:
- Strong current feature set, but it is still too blocking for the requested glance-first redesign.
- It currently uses `Promise.all` for initial load and refresh, so one slow source delays the whole above-the-fold experience.
- It does not yet fully answer all four target questions within one second.
- It is large (`663` lines) and should be split if the Phase 2 redesign is pursued.

### [frontend/src/pages/NewsFeed.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/pages/NewsFeed.jsx)
Purpose: current news page.

Public surface: default page component and a `NewsCard` helper.

Findings:
- Functional baseline: it filters and renders RSS articles with lazy-loaded images.
- Missing Phase 3 features: entity chips, infinite scroll, clustering, related articles, favorites personalization, and a trend widget feed.
- Good enough as a placeholder, but it needs a full rewrite for the “ultimate” news experience.

### [frontend/src/pages/Telemetry.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/pages/Telemetry.jsx)
Purpose: telemetry analysis page.

Public surface: default page component and several chart helpers.

Findings:
- Very large (`1,262` lines) and still mostly a monolith.
- It provides valuable telemetry views, but it is not yet split into the directory layout already hinted at in [SETUP_GUIDE.md](/home/krishnanantha/f1demo/f1demo/SETUP_GUIDE.md).
- Keep the behavior, but split the file before adding Phase 4 features.

### [frontend/src/pages/Analysis.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/pages/Analysis.jsx)
Purpose: session analysis page.

Public surface: default page component and chart helpers.

Findings:
- Large (`867` lines) and still monolithic.
- Like telemetry, it should be broken into smaller route-local modules before adding more functionality.

### [frontend/src/pages/RaceDetail.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/pages/RaceDetail.jsx)
Purpose: detailed race page.

Public surface: large page component.

Findings:
- Large (`975` lines) and likely to become harder to maintain if additional 3D and telemetry surfaces are added around it.
- Keep the feature set, but split it soon.

### [frontend/src/pages/Calendar.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/pages/Calendar.jsx)
Purpose: season calendar view.

Public surface: default page component.

Findings:
- Useful, but currently coupled to the circuit data module for fallback rendering.
- Keep it.

### [frontend/src/pages/Drivers.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/pages/Drivers.jsx)
Purpose: drivers view.

Public surface: default page component.

Findings:
- Not part of the critical blockers I found.
- Keep it unless later profiling shows it is redundant.

### [frontend/src/pages/Constructors.jsx](/home/krishnanantha/f1demo/f1demo/frontend/src/pages/Constructors.jsx)
Purpose: constructors view.

Public surface: default page component.

Findings:
- Same assessment as the drivers page: useful, not currently broken.

### [frontend/src/pages/analysis/index.js](/home/krishnanantha/f1demo/f1demo/frontend/src/pages/analysis/index.js), [frontend/src/pages/telemetry/index.js](/home/krishnanantha/f1demo/f1demo/frontend/src/pages/telemetry/index.js), [frontend/src/pages/raceDetail/index.js](/home/krishnanantha/f1demo/f1demo/frontend/src/pages/raceDetail/index.js)
Purpose: thin barrel modules for lazy route imports.

Public surface: default re-exports.

Findings:
- Good and intentional.
- Keep them.

## Frontend Styling and Tests

### [frontend/src/styles/index.css](/home/krishnanantha/f1demo/f1demo/frontend/src/styles/index.css)
Purpose: transitional stylesheet entrypoint.

Public surface: CSS entry file imported by `main.jsx`.

Findings:
- This is clearly a bridge file: it imports the old monolithic [frontend/src/styles.css](/home/krishnanantha/f1demo/f1demo/frontend/src/styles.css).
- Keep it only while incrementally extracting styles; it should not be the final architecture.

### [frontend/src/styles.css](/home/krishnanantha/f1demo/f1demo/frontend/src/styles.css)
Purpose: main global stylesheet.

Public surface: global CSS.

Findings:
- Very large (`3,907` lines).
- It still pulls a lot of layout, component, and theme concerns together.
- Keep it temporarily, but it should be the next major CSS extraction target.

### [frontend/src/styles.overrides.css](/home/krishnanantha/f1demo/f1demo/frontend/src/styles.overrides.css)
Purpose: CSS overrides.

Public surface: global CSS.

Findings:
- Small adjunct stylesheet.
- Keep it if it still reflects live overrides, otherwise merge or delete when the modular styles land.

### [frontend/src/__tests__/api.test.js](/home/krishnanantha/f1demo/f1demo/frontend/src/__tests__/api.test.js)
Purpose: browser-side API utility tests.

Public surface: `getTeamColor()` assertions.

Findings:
- Good smoke coverage, but very shallow.
- Keep and extend.

### [frontend/src/__tests__/Shared.test.js](/home/krishnanantha/f1demo/f1demo/frontend/src/__tests__/Shared.test.js)
Purpose: shared helper tests.

Public surface: `pad`, `formatDate`, `formatDateFull`, `eventName`.

Findings:
- Useful basic coverage.
- Keep it.

### [frontend/src/__tests__/setup.js](/home/krishnanantha/f1demo/f1demo/frontend/src/__tests__/setup.js)
Purpose: Vitest test bootstrap.

Public surface: test environment setup.

Findings:
- Fine as-is.
- Keep it.

## Repo-Level Docs and Launch Files

### [start_dashboard.sh](/home/krishnanantha/f1demo/f1demo/start_dashboard.sh)
Purpose: one-command launcher for backend, automator, and frontend.

Public surface: `--skip-install` mode and process orchestration.

Findings:
- Good idea and useful for local validation.
- Risk: it depends on the backend and frontend being installable first; today the invalid `package.json` blocks that path.
- Keep it.

### [README.md](/home/krishnanantha/f1demo/f1demo/README.md)
Purpose: repo-level quick start.

Public surface: setup instructions.

Findings:
- Reasonably useful, but it does not yet document the current blockers.
- Should be updated after Phase 0 stabilization.

### [SETUP_GUIDE.md](/home/krishnanantha/f1demo/f1demo/SETUP_GUIDE.md)
Purpose: longer setup / refactor guide.

Public surface: implementation notes and phase planning.

Findings:
- Several sections are stale relative to the current tree, especially the claims that the critical bugs are already fixed.
- Needs a refresh after the codebase is stabilized.

### [docker-compose.yml](/home/krishnanantha/f1demo/f1demo/docker-compose.yml)
Purpose: local container orchestration.

Public surface: backend, automator, and frontend services.

Findings:
- Good overall wiring and useful for repeatable launches.
- Keep it.

### [pytest.ini](/home/krishnanantha/f1demo/f1demo/pytest.ini)
Purpose: pytest configuration.

Public surface: `pythonpath = .`.

Findings:
- Fine and minimal.
- Keep it.

### [.github/workflows/ci.yml](/home/krishnanantha/f1demo/f1demo/.github/workflows/ci.yml)
Purpose: CI pipeline.

Public surface: backend and frontend job steps.

Findings:
- Good that it runs both backend and frontend checks.
- Risk: the frontend job will fail until `frontend/package.json` is repaired.
- The workflow is otherwise reasonable and should stay.

### [.env.example](/home/krishnanantha/f1demo/f1demo/.env.example)
Purpose: environment variable template.

Public surface: backend and frontend env samples.

Findings:
- Good and concise.
- Keep it.

## Prioritized Fix List

1. Fix [backend/utils.py](/home/krishnanantha/f1demo/f1demo/backend/utils.py): restore valid indentation, move `_validate_ti_param` to module scope, and make `cached_get()` honor its `ttl` argument or remove the parameter.
2. Fix [frontend/package.json](/home/krishnanantha/f1demo/f1demo/frontend/package.json): repair JSON syntax so npm can parse it, then verify `npm ci`, `npm run lint`, and `npm run build`.
3. Fix [backend/routes/live.py](/home/krishnanantha/f1demo/f1demo/backend/routes/live.py) and [backend/services/live_stream.py](/home/krishnanantha/f1demo/f1demo/backend/services/live_stream.py): pass keyword arguments correctly, align upstream OpenF1 paths, and add WebSocket tests.
4. Replace [backend/routes/misc.py](/home/krishnanantha/f1demo/f1demo/backend/routes/misc.py) circuit-map lookup with a real backend data source or drop the route.
5. Remove or wire [backend/automator.py](/home/krishnanantha/f1demo/f1demo/backend/automator.py)’s `public/session_mode.json` write so it matches the actual frontend contract.
6. Rewrite [backend/tests/test_main_utils.py](/home/krishnanantha/f1demo/f1demo/backend/tests/test_main_utils.py) and add the missing tests requested for live WS, circuit map, news ranking, and automator round-trip.
7. Fix [backend/routes/schedule.py](/home/krishnanantha/f1demo/f1demo/backend/routes/schedule.py) limiter wiring and then tackle the larger Phase 2-6 feature work.

## Bottom Line

Keep: `main.py`, `cache_store.py`, `free_context.py`, most route modules, the current frontend composition, and the small shared UI components.

Fix immediately: `backend/utils.py`, `frontend/package.json`, live WebSocket wiring, and the backend circuit-map route.

Delete or merge: `backend/test_fastf1.py` and the dead `session_mode.json` write unless you intentionally introduce a frontend consumer for it.