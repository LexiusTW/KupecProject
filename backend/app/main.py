from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
import os

app = FastAPI(
    title="Kupec API",
    description="API для системы металлопроката с CRM функциональностью",
    version="2.0.0",
    openapi_url="/api/v1/openapi.json"
)

origins = [
    "http://localhost:3000",
    "https://kupec.cloudpub.ru",
    "https://xn----jtbogjfed5a6a.xn--p1ai",
    "https://пром-купец.рф"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

contracts_dir = os.path.join(os.getcwd(), "contracts")
if not os.path.exists(contracts_dir):
    os.makedirs(contracts_dir)

app.mount("/contracts", StaticFiles(directory=contracts_dir), name="contracts")


@app.get("/")
def read_root():
    return {"message": "Welcome to Kupec API v2.0"}
