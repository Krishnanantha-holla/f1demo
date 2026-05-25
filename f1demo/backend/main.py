"""F1 Dashboard — FastAPI Backend
Layered data architecture: OpenF1 (live), FastF1 (historical), Jolpica/Ergast (standings/results).
Season-agnostic: never hardcodes a year, team, or driver.

Route modules via FastAPI routers:
- routes.health: Health check, season
- routes.schedule: Schedule, standings, free context
- routes.telemetry: FastF1 lap and telemetry data
- routes.live: OpenF1 proxy and WebSocket
- routes.ti: TracingInsights proxy
- routes.misc: News, bios, circuit maps, internal endpoints
"""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from limiter import limiter
from middleware.logging import RequestLogMiddleware

# ── Structured logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("f1dashboard")

# ── Allowed origins — set ALLOWED_ORIGINS env var for production ──
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()] or [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
]
if APP_ENV == "production" and not _raw_origins.strip():
    raise RuntimeError("ALLOWED_ORIGINS must be set in production")

_sentry_dsn = os.getenv("SENTRY_DSN")
if _sentry_dsn:
    try:
        import sentry_sdk

        sentry_sdk.init(dsn=_sentry_dsn, traces_sample_rate=0.1, environment=APP_ENV)
    except ImportError:
        logger.warning("SENTRY_DSN set but sentry_sdk is not installed; skipping")

# ── Create FastAPI app ──
app = FastAPI(title="F1 Dashboard API", version="2.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(RequestLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Import and register route modules ──
from routes.health import router as health_router
from routes.schedule import router as schedule_router
from routes.telemetry import router as telemetry_router
from routes.live import router as live_router, ws_router
from routes.live_sse import router as live_sse_router
from routes.ti import router as ti_router
from routes.misc import router as misc_router, internal_router
from routes.head_to_head import router as head_to_head_router
from routes.strategy import router as strategy_router
from routes.mini_sectors import router as mini_sectors_router
from routes.team_radio import router as team_radio_router
from routes.tyre_deg import router as tyre_deg_router
from routes.overtake import router as overtake_router
from routes.results import router as results_router
from routes.track_dna import router as track_dna_router
from routes.consistency import router as consistency_router
from routes.driver_stats import router as driver_stats_router
from routes.race_pace import router as race_pace_router
from routes.pit_stops import router as pit_stops_router
from routes.pu_tracker import router as pu_tracker_router
from routes.live_track_map import router as live_track_map_router
from routes.ai import router as ai_router

app.include_router(health_router, prefix="/api", tags=["Health"])
app.include_router(schedule_router, prefix="/api", tags=["Schedule & Standings"])
app.include_router(telemetry_router, prefix="/api", tags=["Telemetry"])
app.include_router(live_sse_router, prefix="/api", tags=["Live"])
app.include_router(live_router, prefix="/api", tags=["Live"])
app.include_router(ti_router, prefix="/api", tags=["TracingInsights"])
app.include_router(misc_router, prefix="/api", tags=["Misc"])
app.include_router(head_to_head_router, prefix="/api", tags=["Head To Head"])
app.include_router(strategy_router, prefix="/api", tags=["Strategy"])
app.include_router(mini_sectors_router, prefix="/api", tags=["Mini Sectors"])
app.include_router(team_radio_router, prefix="/api", tags=["Team Radio"])
app.include_router(tyre_deg_router, prefix="/api", tags=["Tyre Degradation"])
app.include_router(overtake_router, prefix="/api", tags=["Overtake"])
app.include_router(results_router, prefix="/api", tags=["Results Benchmark"])
app.include_router(track_dna_router, prefix="/api", tags=["Track DNA"])
app.include_router(consistency_router, prefix="/api", tags=["Consistency Analyzer"])
app.include_router(driver_stats_router, prefix="/api", tags=["Driver Stats"])
app.include_router(race_pace_router, prefix="/api", tags=["Race Pace"])
app.include_router(pit_stops_router, prefix="/api", tags=["Pit Stops"])
app.include_router(pu_tracker_router, prefix="/api", tags=["PU Tracker"])
app.include_router(live_track_map_router, prefix="/api", tags=["Live Track Map"])
app.include_router(ai_router, prefix="/api", tags=["AI"])
app.include_router(ws_router, tags=["WebSocket"])  # No /api prefix for WebSocket
app.include_router(
    internal_router, tags=["Internal"]
)  # No /api prefix for internal endpoints


# ══════════════════════════════════════════
# RUN
# ══════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
