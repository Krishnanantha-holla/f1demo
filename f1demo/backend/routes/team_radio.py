from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

@router.get("/team-radio", tags=["Team Radio"])
async def get_team_radio(session_key: str = "latest"):
    return {
        "session_key": session_key,
        "messages": [
            {"driver": "VER", "message": "The car feels great", "timestamp": "12:00:00", "sentiment": "positive"},
            {"driver": "HAM", "message": "My tires are gone", "timestamp": "12:01:00", "sentiment": "negative"}
        ]
    }
