"""Miscellaneous endpoints: news, bios, internal cache, circuit maps."""
import json
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException
from services.news_service import fetch_news
from cache_store import cache_lookup, cache_write
from utils import logger, INTERNAL_SECRET, cached_get, cache_clear, _validate_ti_param

router = APIRouter()
internal_router = APIRouter()



@router.get("/news")
async def get_news():
    """Get F1 news from RSS feeds."""
    return await fetch_news(cache_lookup, cache_write, logger)


@router.get("/bios")
def get_bios():
    """Get driver and constructor biographies."""
    bios_path = Path('./bios.json')
    if bios_path.exists():
        return json.loads(bios_path.read_text())
    return {"drivers": {}, "constructors": {}}


@internal_router.post("/internal/refresh-cache")
def refresh_cache(request: Request):
    """Clear all caches. Requires X-Internal-Secret header."""
    secret = request.headers.get("X-Internal-Secret")
    if secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Invalid internal secret")
    cache_clear()
    return {"status": "cache_cleared"}


@router.get("/circuit-map/{circuit_key}")
async def circuit_map(circuit_key: int, year: int = None):
    """Get circuit map data for a specific circuit."""
    try:
        circuitData = __import__('circuitData')
        if circuit_key in circuitData.CIRCUIT_DATA:
            return circuitData.CIRCUIT_DATA[circuit_key]
        return {"error": "Circuit not found"}
    except Exception as e:
        logger.error("circuit_map error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch circuit map")
