from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class StrategyResponse(BaseModel):
    session_key: str
    predicted_strategies: list

@router.get("/strategy/predict", response_model=StrategyResponse)
async def get_strategy_prediction(session_key: str):
    return {
        "session_key": session_key,
        "predicted_strategies": [
            {"name": "One Stop - Soft to Hard", "pit_window": "Lap 18-24", "probability": 0.65},
            {"name": "Two Stop - Soft to Medium to Soft", "pit_window": "Lap 12-16, 35-40", "probability": 0.35}
        ]
    }
