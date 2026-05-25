from fastapi import APIRouter

router = APIRouter()

@router.get("/overtake", tags=["Overtake Probability"])
async def get_overtake_probability(attacker: str = "VER", defender: str = "HAM"):
    return {
        "attacker": attacker,
        "defender": defender,
        "probability": 0.78,
        "factors": {
            "tyre_delta": "+1.2s",
            "drs_available": True,
            "defender_battery": "25%"
        }
    }
