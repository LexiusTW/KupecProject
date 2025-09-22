from fastapi import APIRouter, Query, HTTPException
from dadata import Dadata
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Создаем клиент DaData один раз при загрузке модуля.
# Это значительно ускоряет обработку запросов, т.к. не тратится время на пересоздание объекта и TCP-соединения.
dadata_client = None
if settings.DADATA_TOKEN and settings.DADATA_SECRET is not None:
    try:
        dadata_client = Dadata(settings.DADATA_TOKEN, settings.DADATA_SECRET, timeout=settings.DADATA_TIMEOUT)
    except Exception as e:
        logger.error(f"Failed to initialize DaData client: {e}")

@router.get("/suggest/address")
async def suggest_address(
    q: str = Query(..., min_length=2, max_length=256),
    count: int = Query(10, ge=1, le=20),
):
    if not dadata_client:
        raise HTTPException(status_code=503, detail="DaData suggestions service is not available.")
    try:
        raw = dadata_client.suggest("address", q, count=count)
    except Exception as e:
        logger.exception("DaData suggest error")
        msg = str(e)
        if 'timed out' in msg or 'ConnectTimeout' in msg or 'ConnectError' in msg:
            raise HTTPException(status_code=504, detail="Сервис DaData недоступен (таймаут соединения). Попробуйте позже.")
        raise HTTPException(status_code=502, detail=f"Ошибка сервиса DaData: {msg}")

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


@router.get("/suggest/party")
async def suggest_party(
    q: str = Query(..., min_length=2, max_length=100),
    count: int = Query(5, ge=1, le=10),
):
    """Подсказки по организациям (юр. лица, ИП) по ИНН, ОГРН или названию."""
    if not dadata_client:
        raise HTTPException(status_code=503, detail="DaData suggestions service is not available.")
    try:
        # Используем dadata.find_by_id, если запрос похож на ИНН/ОГРН,
        # или dadata.suggest для поиска по названию.
        # Для простоты пока всегда используем suggest.
        raw = dadata_client.suggest("party", q, count=count)
    except Exception as e:
        logger.exception("DaData suggest party error")
        msg = str(e)
        if 'timed out' in msg or 'ConnectTimeout' in msg or 'ConnectError' in msg:
            raise HTTPException(status_code=504, detail="Сервис DaData недоступен (таймаут соединения). Попробуйте позже.")
        raise HTTPException(status_code=502, detail=f"Ошибка сервиса DaData: {msg}")

    suggestions = []
    for item in raw or []:
        data = item.get("data") or {}
        # Пропускаем организации без ИНН, если такие попадаются
        if not data.get("inn"):
            continue

        suggestions.append({
            "value": item.get("value"),
            "unrestricted_value": item.get("unrestricted_value"),
            "inn": data.get("inn"),
            "kpp": data.get("kpp"),
            "ogrn": data.get("ogrn"),
            "okpo": data.get("okpo"),
            "okato": data.get("okato"),
            "short_name": data.get("name", {}).get("short_with_opf"),
            "full_name": data.get("name", {}).get("full_with_opf"),
            "legal_address": (data.get("address") or {}).get("unrestricted_value"),
        })
    return {"suggestions": suggestions}
