#app/api/v1/api.py
from fastapi import APIRouter
from app.api.v1.endpoints import auth, search, filters, crm, requests, users, suggest, gosts, counterparties, excel, suppliers, contracts

api_router = APIRouter()

api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(search.router, tags=["search"])
api_router.include_router(filters.router, tags=["filters"])
api_router.include_router(crm.router, tags=["crm"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(requests.router, tags=["requests"])
api_router.include_router(suggest.router, tags=["suggest"])
api_router.include_router(gosts.router, tags=["reference"])
api_router.include_router(counterparties.router, prefix="/counterparties", tags=["counterparties"])
api_router.include_router(contracts.router, prefix="/contracts", tags=["contracts"]) 
api_router.include_router(excel.router, tags=["excel"])
api_router.include_router(suppliers.router, tags=["suppliers"])
