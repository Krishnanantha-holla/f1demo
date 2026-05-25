"""Grok AI integration for F1 analysis, summaries, and discussion."""

import os
import httpx
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from limiter import limiter
from utils import logger, cached_get, JOLPICA, current_year

router = APIRouter()

GROK_API_KEY = os.getenv("GROK_API_KEY", "")
GROK_API_URL = "https://api.x.ai/v1/chat/completions"
GROK_MODEL = os.getenv("GROK_MODEL", "grok-3-mini")

F1_SYSTEM_PROMPT = """You are an expert Formula 1 analyst and commentator. You have deep knowledge of:
- All F1 drivers, teams, and their histories
- Race strategies, tire compounds, pit stop tactics
- Circuit characteristics and how they affect racing
- Technical regulations and car development
- Historical statistics and records
Keep responses concise, insightful, and engaging. Use data-driven analysis when possible.
When provided with real data, reference specific numbers and stats in your analysis."""


class AnalysisRequest(BaseModel):
    topic: str
    context: str = ""
    enrich: bool = True  # Auto-fetch relevant data


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


async def _call_grok(messages: list[dict], max_tokens: int = 1024) -> str:
    if not GROK_API_KEY:
        # Return a structured error so frontend can detect missing configuration
        raise HTTPException(status_code=503, detail={
            "message": "Grok API key not configured. Set GROK_API_KEY env var.",
            "code": "AI_NOT_CONFIGURED",
        })

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            GROK_API_URL,
            headers={"Authorization": f"Bearer {GROK_API_KEY}", "Content-Type": "application/json"},
            json={"model": GROK_MODEL, "messages": messages, "max_tokens": max_tokens, "temperature": 0.7},
        )

    if resp.status_code != 200:
        logger.error("Grok API error: %s %s", resp.status_code, resp.text[:200])
        # Surface a generic 502 with text
        raise HTTPException(status_code=502, detail={"message": "AI service temporarily unavailable", "status": resp.status_code})

    data = resp.json()
    return data["choices"][0]["message"]["content"]


async def _fetch_standings_context() -> str:
    """Fetch current driver/constructor standings as context."""
    yr = current_year()
    try:
        d = await cached_get(f"{JOLPICA}/{yr}/driverStandings.json?limit=10", ttl=600)
        c = await cached_get(f"{JOLPICA}/{yr}/constructorStandings.json?limit=10", ttl=600)
        lines = [f"=== {yr} Season Data ==="]
        if d:
            drivers = d.get("MRData", {}).get("StandingsTable", {}).get("StandingsLists", [{}])[0].get("DriverStandings", [])
            lines.append("Driver Standings (Top 10):")
            for s in drivers[:10]:
                lines.append(f"  P{s['position']} {s['Driver']['givenName']} {s['Driver']['familyName']} - {s['points']} pts ({s.get('wins','0')} wins)")
        if c:
            teams = c.get("MRData", {}).get("StandingsTable", {}).get("StandingsLists", [{}])[0].get("ConstructorStandings", [])
            lines.append("Constructor Standings (Top 10):")
            for s in teams[:10]:
                lines.append(f"  P{s['position']} {s['Constructor']['name']} - {s['points']} pts")
        return "\n".join(lines)
    except Exception as e:
        logger.warning("Failed to fetch standings context: %s", e)
        return ""


@router.post("/ai/analyze")
@limiter.limit("10/minute")
async def ai_analyze(request: Request, body: AnalysisRequest):
    """Generate AI analysis on an F1 topic with optional real data enrichment."""
    prompt = f"Analyze the following F1 topic: {body.topic}"
    if body.context:
        prompt += f"\n\nAdditional context/data:\n{body.context}"

    # Auto-enrich with current standings data
    if body.enrich:
        standings = await _fetch_standings_context()
        if standings:
            prompt += f"\n\n{standings}"

    messages = [
        {"role": "system", "content": F1_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    result = await _call_grok(messages)
    return {"analysis": result, "topic": body.topic}


@router.post("/ai/chat")
@limiter.limit("20/minute")
async def ai_chat(request: Request, body: ChatRequest):
    """Interactive F1 discussion chat with conversation history."""
    messages = [{"role": "system", "content": F1_SYSTEM_PROMPT}]

    # Inject standings context on first message
    if len(body.messages) <= 1:
        standings = await _fetch_standings_context()
        if standings:
            messages.append({"role": "system", "content": f"Current season data for reference:\n{standings}"})

    for msg in body.messages[-10:]:
        messages.append({"role": msg.role, "content": msg.content})

    result = await _call_grok(messages)
    return {"reply": result}


@router.get("/ai/summary/{subject_type}/{subject_id}")
@limiter.limit("15/minute")
async def ai_summary(request: Request, subject_type: str, subject_id: str):
    """Get AI-generated summary for a driver, constructor, or track."""
    if subject_type not in ("driver", "constructor", "track", "race"):
        raise HTTPException(400, "subject_type must be driver, constructor, track, or race")

    # Fetch relevant data for context
    extra_context = ""
    yr = current_year()
    try:
        if subject_type == "driver":
            data = await cached_get(f"{JOLPICA}/{yr}/drivers/{subject_id.lower()}/results.json?limit=5", ttl=300)
            if data:
                races = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
                if races:
                    extra_context = f"\nRecent {yr} results: " + ", ".join(
                        f"{r['raceName']} P{r['Results'][0]['position']}" for r in races[-5:] if r.get("Results")
                    )
        elif subject_type == "constructor":
            data = await cached_get(f"{JOLPICA}/{yr}/constructors/{subject_id.lower()}/results.json?limit=5", ttl=300)
            if data:
                races = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
                if races:
                    extra_context = f"\nRecent {yr} results available for context."
    except Exception:
        pass

    prompts = {
        "driver": f"Give a brief, insightful summary of F1 driver {subject_id}. Include their current form, strengths, weaknesses, and what to watch for this season. 3-4 paragraphs max.{extra_context}",
        "constructor": f"Give a brief summary of F1 team {subject_id}. Include their current competitiveness, car strengths/weaknesses, driver lineup assessment, and season outlook. 3-4 paragraphs max.{extra_context}",
        "track": f"Give a brief technical summary of the {subject_id} F1 circuit. Include key characteristics, overtaking opportunities, tire strategy considerations, and what makes it unique. 3-4 paragraphs max.",
        "race": f"Give a brief preview/analysis of the {subject_id} Grand Prix. Include key storylines, strategy considerations, and predictions. 3-4 paragraphs max.",
    }

    messages = [
        {"role": "system", "content": F1_SYSTEM_PROMPT},
        {"role": "user", "content": prompts[subject_type]},
    ]
    try:
        result = await _call_grok(messages, max_tokens=800)
        return {"summary": result, "subject_type": subject_type, "subject_id": subject_id, "ai_fallback": False}
    except HTTPException as e:
        # If AI_NOT_CONFIGURED or Grok failure, try to return a lightweight cached summary
        logger.warning("Grok summary failed for %s/%s: %s", subject_type, subject_id, getattr(e, 'detail', str(e)))
        # Try to build a simple fallback from local bios.json if present
        try:
            import json
            here = os.path.dirname(__file__)
            bios_path = os.path.join(here, '..', 'bios.json')
            if os.path.exists(bios_path):
                with open(bios_path, 'r', encoding='utf-8') as fh:
                    bios = json.load(fh)
                    if subject_type == 'driver':
                        d = bios.get('drivers', {}).get(subject_id) or bios.get('drivers', {}).get(str(subject_id))
                        if d:
                            txt = d.get('bio') or f"{d.get('full_name','')} races for {d.get('team_name','')}."
                            return {"summary": txt, "subject_type": subject_type, "subject_id": subject_id, "ai_fallback": True}
                    if subject_type == 'constructor':
                        c = bios.get('constructors', {}).get(subject_id) or bios.get('constructors', {}).get(subject_id.replace(' ', '_').lower())
                        if c:
                            txt = c.get('bio') or f"{c.get('full_name', subject_id)} is a Formula 1 constructor."
                            return {"summary": txt, "subject_type": subject_type, "subject_id": subject_id, "ai_fallback": True}
        except Exception:
            logger.debug('No bios fallback available')

        # Re-raise the original for frontend to handle, preserving detail when available
        raise e
