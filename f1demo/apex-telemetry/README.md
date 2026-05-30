# Apex Telemetry

A live Formula 1 race-control dashboard. React 19 · Vite 6 · Tailwind v4 · TypeScript strict.

The UI is fed by three free, public data sources, plus an optional FastAPI
backend that ships in `f1demo/backend` for richer endpoints:

| Source | Used for | Auth |
| --- | --- | --- |
| [OpenF1](https://openf1.org) | Live session, drivers, position, intervals, laps, weather, race control, team radio, pit stops, stints | None |
| [Jolpica/Ergast](https://jolpi.ca) | Driver and constructor standings, calendar, lap-by-lap times, season aggregates | None |
| [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) | Real GeoJSON polylines for every circuit | None |
| [api.rss2json](https://rss2json.com) | News feed gateway when the FastAPI backend isn't reachable | None |

## Quick start

```bash
cd f1demo/apex-telemetry
npm install
cp .env.example .env.local       # optional: VITE_BACKEND_URL=http://localhost:8000
npm run dev
```

Open <http://localhost:3000>.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Production bundle in `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Strict TypeScript check (no emit) |

## Architecture

```
src/
  App.tsx                  # Top-level state, simulation tick, periodic re-sync
  main.tsx                 # React entry
  index.css                # Tailwind v4 theme tokens + carbon styles
  types.ts                 # Driver / SessionInfo / IntelMessage models
  data.ts                  # Seed data + simulator (used as fallback)
  env.d.ts                 # ImportMetaEnv typings

  hooks/
    useKeyboardShortcuts.ts

  services/
    http.ts                # Shared fetch helpers + sessionStorage TTL cache
    openf1.ts              # OpenF1 adapter (live session feed)
    jolpica.ts             # Jolpica/Ergast adapter (standings, results, lap times)
    circuits.ts            # bacinger/f1-circuits GeoJSON loader + projection
    news.ts                # FastAPI proxy + rss2json fallback
    bootstrap.ts           # Orchestrator (composes the above)
    f1Api.ts               # Barrel re-export

  components/
    AppShell.tsx           # Header / sidebar / mobile dock
    ShortcutOverlay.tsx    # `?` cheatsheet
    DashboardView.tsx
    LiveTimingView.tsx
    TrackMapView.tsx       # Real GeoJSON track for whatever country is live
    TelemetryView.tsx
    StandingsView.tsx
    AnalysisView.tsx       # Real lap-by-lap comparator (Jolpica)
    IntelView.tsx          # News + race control + team radio + pit stops
    ui/
      CarbonCard.tsx
      ErrorBoundary.tsx
      Sparkline.tsx
      StatusBadge.tsx
      TyrePill.tsx
```

## Keyboard shortcuts

Press `?` anywhere to see them in-app. Highlights:

- `D` Dashboard, `L` Live Timing, `T` Track Map, `G` Telemetry, `S` Standings, `A` Analysis, `I` Intel
- `Space` to pause/resume the telemetry simulator
- `R` to re-sync OpenF1 + Jolpica
- `?` to toggle the cheatsheet

## Resilience

- Every external call lives behind `services/http.ts`, which carries an
  in-flight cache (no duplicate concurrent fetches) and a sessionStorage TTL
  cache.
- OpenF1 returns `{"detail":"No results found."}` (HTTP 200) when a query is
  empty; `fetchOpenF1Array` coerces that into `[]` so the UI never crashes.
- Bootstrap fetches everything in parallel via `Promise.all` with per-call
  `.catch(() => null/[])`, so one failing source doesn't poison the others.
- The simulator from `data.ts` keeps the leaderboard alive even with the
  network down — clearly labelled "SIM FALLBACK" in the top nav.
- `<ErrorBoundary>` wraps both the shell and each tab, so a panel-level crash
  is recoverable without a page refresh.

## Backend bridge

When `VITE_BACKEND_URL` is set, the news feed is sourced from the FastAPI
backend's `/api/news` route (with the cached, deduped, 9-source aggregator
shipped in `f1demo/backend/services/news_service.py`). Otherwise the browser
fetches each RSS feed via api.rss2json.com directly.
