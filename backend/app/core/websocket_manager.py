from collections import defaultdict
from typing import Any, Dict, List, Tuple, Union

from fastapi import WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm import ChatParticipant
from app.models.user import User

Payload = Union[str, Dict[str, Any]]

class ConnectionManager:
    def __init__(self) -> None:
        # ключ: (role, user_id)  -> список WebSocket
        self.active: Dict[Tuple[str, int], List[WebSocket]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, role: str, user_id: int) -> None:
        await websocket.accept()
        self.active[(role, user_id)].append(websocket)

    async def disconnect(self, websocket: WebSocket, role: str, user_id: int) -> None:
        key = (role, user_id)
        lst = self.active.get(key, [])
        if websocket in lst:
            lst.remove(websocket)
        if not lst and key in self.active:
            self.active.pop(key, None)

    async def send_personal_message(self, payload: Payload, role: str, user_id: int) -> None:
        key = (role, user_id)
        sockets = list(self.active.get(key, []))  # итерация по копии
        for ws in sockets:
            try:
                if isinstance(payload, (dict, list)):
                    await ws.send_json(payload)
                else:
                    await ws.send_text(str(payload))
            except Exception:
                # чистим «плохое» соединение
                try:
                    await ws.close()
                except Exception:
                    pass
                if ws in self.active.get(key, []):
                    self.active[key].remove(ws)
        if key in self.active and not self.active[key]:
            self.active.pop(key, None)

    async def broadcast_to_chat(self, payload: Payload, chat_id: int, db: AsyncSession) -> None:
        rows = (await db.execute(
            select(ChatParticipant.user_id)
            .where(ChatParticipant.chat_id == chat_id)
        )).scalars().all()
        for user_id in rows:
            user = await db.get(User, user_id)
            if user:
                await self.send_personal_message(payload, user.role, user.id)

# единый экземпляр
manager = ConnectionManager()