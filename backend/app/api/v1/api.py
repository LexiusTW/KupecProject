from fastapi import APIRouter

from app.api.v1.endpoints import auth, search, filters, crm

api_router = APIRouter()

api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(search.router, tags=["search"])
api_router.include_router(filters.router, tags=["filters"])
api_router.include_router(crm.router, prefix="/crm", tags=["crm"])