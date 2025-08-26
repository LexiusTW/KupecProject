from fastapi import WebSocket
from typing import Dict, List
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"Пользователь {user_id} подключился к WebSocket")
    
    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"Пользователь {user_id} отключился от WebSocket")
    
    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    logger.error(f"Ошибка отправки сообщения пользователю {user_id}: {e}")
                    self.active_connections[user_id].remove(connection)
    
    async def broadcast_to_chat(self, message: str, chat_id: int, db):
        """Отправляет сообщение всем участникам чата"""
        from app.models.user import ChatParticipant
        
        chat_participants = db.query(ChatParticipant).filter(ChatParticipant.chat_id == chat_id).all()
        for participant in chat_participants:
            await self.send_personal_message(message, participant.user_id)


# Глобальный экземпляр менеджера
manager = ConnectionManager()
