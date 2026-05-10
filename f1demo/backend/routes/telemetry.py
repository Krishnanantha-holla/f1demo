"""FastF1 telemetry and lap data endpoints."""
import asyncio

from fastapi import APIRouter, Request, Query, HTTPException

from utils import logger, HAS_FASTF1, fastf1, cached_get

router = APIRouter()


@router.get("/laps/{year}/{event}/{session_type}")
async def get_laps(
    request: Request,
    year: int,
    event: str,
    session_type: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=2000),
):
    """Get lap-by-lap timing data from FastF1."""
    if not HAS_FASTF1:
        raise HTTPException(status_code=503, detail="FastF1 not installed")
    if year < 2018 or year > 2030:
        raise HTTPException(status_code=400, detail="year must be between 2018 and 2030")
    if session_type not in ("R", "Q", "FP1", "FP2", "FP3", "SQ", "SR", "S"):
        raise HTTPException(status_code=400, detail="invalid session_type")
    
    def _get_laps():
        s = fastf1.get_session(year, event, session_type)
        s.load(telemetry=False, weather=False)
        laps = s.laps[
            ["Driver", "LapNumber", "LapTime", "Compound", "IsPersonalBest",
             "Sector1Time", "Sector2Time", "Sector3Time", "Stint", "Position"]
        ].dropna(subset=["LapTime"])
        laps["LapTimeSeconds"] = laps["LapTime"].dt.total_seconds()
        laps["Sector1Seconds"] = laps["Sector1Time"].dt.total_seconds()
        laps["Sector2Seconds"] = laps["Sector2Time"].dt.total_seconds()
        laps["Sector3Seconds"] = laps["Sector3Time"].dt.total_seconds()
        records = laps.to_dict(orient="records")
        total = len(records)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "data": records[start:end],
            "page": page,
            "page_size": page_size,
            "pages": max(1, (total + page_size - 1) // page_size),
        }
    
    try:
        return await asyncio.to_thread(_get_laps)
    except Exception as e:
        logger.error("get_laps error year=%s event=%s session=%s: %s", year, event, session_type, e)
        raise HTTPException(status_code=500, detail="Failed to fetch laps")


@router.get("/telemetry/{year}/{event}/{session_type}/{driver}")
async def get_telemetry(
    request: Request,
    year: int,
    event: str,
    session_type: str,
    driver: str,
):
    """Get telemetry data (throttle, brake, speed, RPM, gear, DRS) for a driver."""
    if not HAS_FASTF1:
        raise HTTPException(status_code=503, detail="FastF1 not installed")
    if year < 2018 or year > 2030:
        raise HTTPException(status_code=400, detail="year must be between 2018 and 2030")
    if session_type not in ("R", "Q", "FP1", "FP2", "FP3", "SQ", "SR", "S"):
        raise HTTPException(status_code=400, detail="invalid session_type")
    if not driver.isalpha() or not (2 <= len(driver) <= 4):
        raise HTTPException(status_code=400, detail="driver must be a 2-4 letter code")
    
    def _get_telemetry():
        s = fastf1.get_session(year, event, session_type)
        s.load()
        fastest = s.laps.pick_driver(driver).pick_fastest()
        if fastest is None or fastest.get_car_data() is None:
            return []
        tel = fastest.get_car_data().reset_index(drop=True)
        sampled = tel.iloc[::5]
        return sampled.to_dict(orient="records")
    
    try:
        return await asyncio.to_thread(_get_telemetry)
    except Exception as e:
        logger.error("get_telemetry error year=%s event=%s session=%s driver=%s: %s", year, event, session_type, driver, e)
        raise HTTPException(status_code=500, detail="Failed to fetch telemetry")


@router.get("/compare")
async def compare_drivers(
    year: int,
    event: str,
    session_type: str,
    drivers: str,
):
    """Compare lap times across multiple drivers."""
    if not HAS_FASTF1:
        raise HTTPException(status_code=503, detail="FastF1 not installed")
    driver_list = [d.strip().upper() for d in drivers.split(",") if d.strip()]
    if not (2 <= len(driver_list) <= 5):
        raise HTTPException(status_code=400, detail="Provide 2-5 driver codes")
    
    def _compare():
        s = fastf1.get_session(year, event, session_type)
        s.load(telemetry=False, weather=False)
        result = {}
        for drv in driver_list:
            try:
                laps = s.laps.pick_driver(drv)[
                    ["LapNumber", "LapTime", "Compound", "IsPersonalBest", "S1", "S2", "S3", "Stint"]
                ]
                laps["LapTimeSeconds"] = laps["LapTime"].dt.total_seconds()
                result[drv] = laps[["LapNumber", "LapTimeSeconds", "Compound",
                                     "IsPersonalBest", "S1", "S2", "S3", "Stint"]].to_dict(orient="records")
            except Exception as exc:
                logger.error("compare driver %s error: %s", drv, exc)
                result[drv] = []
        return result
    
    try:
        return await asyncio.to_thread(_compare)
    except Exception as exc:
        logger.error("compare error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to compare drivers")
