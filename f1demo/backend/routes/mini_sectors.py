from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class MiniSectorResponse(BaseModel):
    session_key: str
    driver1: str
    driver2: str
    mini_sectors: list

@router.get("/mini-sectors", response_model=MiniSectorResponse)
async def get_mini_sectors(session_key: str = "latest", driver1: str = "VER", driver2: str = "HAM"):
    return {
        "session_key": session_key,
        "driver1": driver1,
        "driver2": driver2,
        "mini_sectors": [
            {"id": 1, "fastest": driver1, "speed": 310},
            {"id": 2, "fastest": driver2, "speed": 150},
            {"id": 3, "fastest": driver1, "speed": 280},
        ]
    }
