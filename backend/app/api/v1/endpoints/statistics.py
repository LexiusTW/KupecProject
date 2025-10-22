from datetime import datetime, timedelta
from typing import Optional, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user
from app.models.request import Request
from app.models.user import User


router = APIRouter()


def _parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except Exception:
        try:
            return datetime.strptime(value, "%Y-%m-%d")
        except Exception:
            return None


def _daterange(start: datetime, end: datetime, step: str) -> List[datetime]:
    points: List[datetime] = []
    cur = start
    if step == "day":
        while cur <= end:
            points.append(cur)
            cur += timedelta(days=1)
    elif step == "week":
        while cur <= end:
            points.append(cur)
            cur += timedelta(weeks=1)
    elif step == "month":
        while cur <= end:
            points.append(cur.replace(day=1))
            y = cur.year + (cur.month // 12)
            m = (cur.month % 12) + 1
            cur = cur.replace(year=y, month=m, day=1)
    elif step == "quarter":
        while cur <= end:
            q = ((cur.month - 1) // 3) * 3 + 1
            points.append(cur.replace(month=q, day=1))
            m = q + 3
            y = cur.year
            if m > 12:
                m -= 12
                y += 1
            cur = cur.replace(year=y, month=m, day=1)
    return points


def _label_for(dt: datetime, period: str) -> str:
    if period == "day":
        return dt.strftime("%d.%m")
    if period == "week":
        iso = dt.isocalendar()
        return f"{iso.year}-W{iso.week:02}"
    if period == "month":
        return dt.strftime("%Y-%m")
    if period == "quarter":
        q = (dt.month - 1) // 3 + 1
        return f"{dt.year}-Q{q}"
    return dt.strftime("%d.%m")


@router.get("/statistics/requests")
async def requests_statistics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    period: str = Query("day", pattern="^(day|week|month|quarter)$"),
    department_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    start = _parse_date(start_date)
    end = _parse_date(end_date)
    if not start or not end or start > end:
        raise HTTPException(status_code=400, detail="Неверные даты")

    user_ids: Optional[List[int]] = None
    if department_id is not None:
        q_users = select(User.id).where(User.department_id == department_id)
        user_ids = [r[0] for r in (await db.execute(q_users)).all()]
        if not user_ids:
            return {
                "created_requests": {"labels": [], "data": []},
                "average_margin_percent": 0.0,
                "conversion_rate_percent": 0.0,
                "average_items_per_request": 0.0,
            }

    q = (
        select(Request)
        .where(Request.created_at >= start, Request.created_at <= end)
        .options(selectinload(Request.items))
    )
    if user_ids is not None:
        q = q.where(Request.user_id.in_(user_ids))

    requests = (await db.execute(q)).scalars().all()

    buckets: Dict[str, int] = {}
    axis = _daterange(start, end, period)
    labels = [_label_for(p, period) for p in axis]
    for lab in labels:
        buckets[lab] = 0

    def _bucket_key(dt: datetime) -> str:
        if period == "day":
            key_dt = datetime(dt.year, dt.month, dt.day)
        elif period == "week":
            key_dt = datetime.fromisocalendar(dt.isocalendar().year, dt.isocalendar().week, 1)
        elif period == "month":
            key_dt = datetime(dt.year, dt.month, 1)
        else:
            m = ((dt.month - 1) // 3) * 3 + 1
            key_dt = datetime(dt.year, m, 1)
        return _label_for(key_dt, period)

    for r in requests:
        lab = _bucket_key(r.created_at)
        if lab in buckets:
            buckets[lab] += 1

    created_data = [buckets.get(lab, 0) for lab in labels]

    total_requests = len(requests)
    closed = sum(1 for r in requests if (r.status or "").strip().lower() == "сделка закрыта")
    conversion = (closed / total_requests * 100.0) if total_requests else 0.0

    items_total = sum(len(r.items or []) for r in requests)
    avg_items = (items_total / total_requests) if total_requests else 0.0

    result = {
        "created_requests": {"labels": labels, "data": created_data},
        "average_margin_percent": 0.0,
        "conversion_rate_percent": round(conversion, 2),
        "average_items_per_request": round(avg_items, 2),
    }
    return result


