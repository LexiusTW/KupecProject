from fastapi import APIRouter, Query, HTTPException
from dadata import Dadata
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

def _ensure_creds():
    if not settings.DADATA_TOKEN:
        raise HTTPException(status_code=500, detail="DADATA_TOKEN is not configured")
    if settings.DADATA_SECRET is None:
        raise HTTPException(status_code=500, detail="DADATA_SECRET is not configured")

@router.get("/suggest/address")
async def suggest_address(
    q: str = Query(..., min_length=2, max_length=256),
    count: int = Query(10, ge=1, le=20),
):
    _ensure_creds()
    try:
        with Dadata(settings.DADATA_TOKEN, settings.DADATA_SECRET, timeout=settings.DADATA_TIMEOUT) as d:
            raw = d.suggest("address", q, count=count)
    except Exception as e:
        logger.exception("DaData suggest error")
        # 502, чтобы явно показать внешнюю ошибку
        raise HTTPException(status_code=502, detail=f"DaData error: {e}")

    suggestions = []
    for item in raw or []:
        data = item.get("data") or {}
        suggestions.append({
            "value": item.get("value"),
            "unrestricted_value": item.get("unrestricted_value"),
            "fias_id": data.get("fias_id"),
            "kladr_id": data.get("kladr_id"),
            "qc": data.get("qc"),
            "geo_lat": data.get("geo_lat"),
            "geo_lon": data.get("geo_lon"),
        })
    return {"suggestions": suggestions}
