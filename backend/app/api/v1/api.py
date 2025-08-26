from fastapi import APIRouter

from app.api.v1.endpoints import auth, search, filters, crm, requests, users, suggest

api_router = APIRouter()

api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(search.router, tags=["search"])
api_router.include_router(filters.router, tags=["filters"])
api_router.include_router(crm.router, prefix="/crm", tags=["crm"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(requests.router, tags=["requests"])
api_router.include_router(suggest.router, tags=["suggest"])
