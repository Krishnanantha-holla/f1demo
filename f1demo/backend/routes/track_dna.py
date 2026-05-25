"""Track DNA / circuit characteristics endpoint."""

import json
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException
from limiter import limiter

router = APIRouter()

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_TRACK_DNA = json.loads((_DATA_DIR / "track_dna.json").read_text())


@router.get("/track-dna")
@limiter.limit("60/minute")
async def get_track_dna(request: Request, circuit_id: str = "bahrain"):
    cid = circuit_id.strip().lower()
    if cid not in _TRACK_DNA:
        available = list(_TRACK_DNA.keys())
        raise HTTPException(404, f"Circuit not found. Available: {available}")
    return _TRACK_DNA[cid]
