"""Miscellaneous endpoints: news, bios, internal cache, circuit maps."""

import json
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException
from services.news_service import fetch_news
from cache_store import cache_clear, cache_lookup, cache_write
from utils import (
    logger,
    INTERNAL_SECRET,
    clear_request_cache,
    _validate_ti_param,
)

router = APIRouter()
internal_router = APIRouter()


@router.get("/news")
async def get_news():
    """Get F1 news from RSS feeds."""
    return await fetch_news(cache_lookup, cache_write, logger)


@router.get("/bios")
def get_bios():
    """Get driver and constructor biographies."""
    bios_path = Path("./bios.json")
    if bios_path.exists():
        return json.loads(bios_path.read_text())
    return {"drivers": {}, "constructors": {}}


@router.get("/circuit-map/{circuit_key}")
def circuit_map(circuit_key: str, year: int = None):
    """Return circuit metadata for the given circuit key.

    Reads pre-generated JSON at `backend/data/circuits.json`. Run
    `python f1demo/scripts/generate_circuits_json.py` to (re)generate it
    from the frontend `circuitData.js` source of truth.
    """
    _validate_ti_param(circuit_key, "circuit_key", max_length=200)

    data_dir = Path(__file__).resolve().parents[1] / "data"
    cache_file = data_dir / "circuits.json"
    if not cache_file.exists():
        raise HTTPException(
            status_code=503,
            detail="Circuit data unavailable. Run scripts/generate_circuits_json.py to populate backend/data/circuits.json.",
        )

    try:
        circuits = json.loads(cache_file.read_text())
    except Exception as exc:
        logger.error("circuit_map: failed to parse %s: %s", cache_file, exc)
        raise HTTPException(status_code=500, detail="Circuit data is corrupt")

    # Case-insensitive lookup
    if circuit_key in circuits:
        return circuits[circuit_key]
    for k, v in circuits.items():
        if k.lower() == circuit_key.lower():
            return v
    raise HTTPException(status_code=404, detail="Circuit not found")


@internal_router.post("/internal/refresh-cache")
async def refresh_cache(request: Request):
    """Clear all caches. Requires X-Internal-Secret header."""
    secret = request.headers.get("X-Internal-Secret")
    if secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Invalid internal secret")
    await clear_request_cache()
    cache_clear()
    return {"status": "cache_cleared"}
