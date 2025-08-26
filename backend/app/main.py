from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router

app = FastAPI(
    title="Kupec API",
    description="API для системы металлопроката с CRM функциональностью",
    version="2.0.0",
    openapi_url="/api/v1/openapi.json"
)

origins = [
    "http://localhost:3000",
    "https://kupec.cloudpub.ru",
    "http://localhost:3001",  # Для CRM интерфейса
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {
        "message": "Welcome to Kupec API v2.0",
        "features": [
            "Metal search and filtering",
            "CRM system with chat and email",
            "WebSocket real-time notifications",
            "Multiple supplier parsers"
        ],
        "endpoints": {
            "search": "/api/v1/search",
            "filters": "/api/v1/filters",
            "crm": "/api/v1/crm",
            "websocket": "/api/v1/crm/ws/chat/{user_id}"
        }
    }
