from fastapi import APIRouter

router = APIRouter()

@router.get("/tyre-degradation", tags=["Tyre Degradation"])
async def get_tyre_degradation(session_key: str = "latest"):
    return {
        "session_key": session_key,
        "drivers": [
            {"code": "VER", "stint_laps": 15, "tyre_compound": "SOFT", "degradation_percent": 45.2, "estimated_cliff_lap": 22},
            {"code": "HAM", "stint_laps": 18, "tyre_compound": "MEDIUM", "degradation_percent": 30.1, "estimated_cliff_lap": 30}
        ]
    }
