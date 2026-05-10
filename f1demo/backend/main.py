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
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# ── Structured logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("f1dashboard")

# ── Allowed origins — set ALLOWED_ORIGINS env var for production ──
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()] or [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
]

# ── Rate limiter ──
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

# ── Create FastAPI app ──
app = FastAPI(title="F1 Dashboard API", version="2.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
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
from routes.ti import router as ti_router
from routes.misc import router as misc_router, internal_router

app.include_router(health_router, prefix="/api", tags=["Health"])
app.include_router(schedule_router, prefix="/api", tags=["Schedule & Standings"])
app.include_router(telemetry_router, prefix="/api", tags=["Telemetry"])
app.include_router(live_router, prefix="/api", tags=["Live"])
app.include_router(ti_router, prefix="/api", tags=["TracingInsights"])
app.include_router(misc_router, prefix="/api", tags=["Misc"])
app.include_router(ws_router, tags=["WebSocket"])  # No /api prefix for WebSocket
app.include_router(internal_router, tags=["Internal"])  # No /api prefix for internal endpoints


# ══════════════════════════════════════════
# RUN
# ══════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
