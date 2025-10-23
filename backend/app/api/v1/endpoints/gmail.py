import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from enum import Enum

from app.api.deps import get_refreshed_user_google_creds
from app.models.user import User

router = APIRouter()

# --- Enums & Schemas ---

class GmailLabel(str, Enum):
    """
    Стандартные системные метки Gmail.
    """
    INBOX = "INBOX"          # Входящие
    SENT = "SENT"            # Отправленные
    DRAFTS = "DRAFT"         # Черновики
    SPAM = "SPAM"            # Спам
    TRASH = "TRASH"          # Корзина
    STARRED = "STARRED"      # Помеченные
    UNREAD = "UNREAD"        # Непрочитанные
    IMPORTANT = "IMPORTANT"  # Важные
    SNOOZED = "SNOOZED"      # Отложенные

class GmailMessage(BaseModel):
    """Схема для представления краткой информации о письме."""
    id: str
    snippet: str
    from_: str = Field(..., alias="from")
    subject: str
    is_unread: bool = Field(False, description="True, если письмо не прочитано")

class GmailAttachment(BaseModel):
    """Схема для метаданных вложения."""
    attachment_id: str
    filename: str
    mime_type: str
    size: int

class GmailBody(BaseModel):
    """Схема для тела письма (plain text и/или HTML)."""
    plain: Optional[str] = None
    html: Optional[str] = None

class GmailFullMessage(BaseModel):
    """Схема для полного представления письма."""
    id: str
    snippet: str
    from_: str = Field(..., alias="from")
    to: str
    subject: str
    body: GmailBody
    attachments: List[GmailAttachment]
    label_ids: List[str] = Field([], description="Список ID меток, примененных к письму")

class GmailSendMessage(BaseModel):
    """Схема для отправки письма."""
    to: str
    subject: str
    body: str

class GmailModifyRequest(BaseModel):
    """Схема для изменения статуса прочтения письма."""
    mark_as_unread: bool = Field(..., description="`true` чтобы пометить как непрочитанное, `false` чтобы пометить как прочитанное.")


# --- Helper Functions ---

def _parse_message_part(part: Dict[str, Any], body: GmailBody, attachments: List[GmailAttachment]):
    """Рекурсивно парсит части письма, извлекая тело и вложения."""
    mime_type = part.get("mimeType", "")
    # В некоторых случаях payload находится внутри part, а не body
    payload_body = part.get("body", {})
    
    # Если есть вложенные части, рекурсивно обрабатываем их
    if "parts" in part:
        for sub_part in part["parts"]:
            _parse_message_part(sub_part, body, attachments)
        return

    # Извлечение тела письма
    data = payload_body.get("data")
    if data:
        decoded_data = base64.urlsafe_b64decode(data).decode("utf-8")
        if mime_type == "text/plain":
            body.plain = decoded_data
        elif mime_type == "text/html":
            body.html = decoded_data

    # Извлечение вложений
    filename = part.get("filename")
    attachment_id = payload_body.get("attachmentId")
    if filename and attachment_id:
        attachments.append(GmailAttachment(
            attachment_id=attachment_id,
            filename=filename,
            mime_type=mime_type,
            size=payload_body.get("size", 0)
        ))

# --- Endpoints ---

@router.get("/messages", response_model=List[GmailMessage], tags=["gmail"])
async def get_messages(
    label: GmailLabel = GmailLabel.INBOX,
    current_user: User = Depends(get_refreshed_user_google_creds)
):
    """
    Получает список последних 25 писем для указанной метки (папки).
    """
    google_account = next((acc for acc in current_user.oauth_accounts if acc.provider == 'google'), None)
    if not google_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Аккаунт Google не найден.")

    headers = {"Authorization": f"Bearer {google_account.access_token}"}
    messages_list = []

    async with httpx.AsyncClient() as client:
        list_url = "https://www.googleapis.com/gmail/v1/users/me/messages"
        params = {"labelIds": label.value, "maxResults": 25}
        list_response = await client.get(list_url, headers=headers, params=params)

        # Проверяем ответ от Google API
        try:
            list_response.raise_for_status() # Вызовет исключение для кодов 4xx/5xx
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Ошибка при получении списка писем: {e.response.text}"
            )

        response_json = list_response.json()
        messages = response_json.get("messages", [])

        if not messages:
            return []

        for msg in messages:
            msg_id = msg['id']
            details_url = f"https://www.googleapis.com/gmail/v1/users/me/messages/{msg_id}"
            # Запрашиваем доп. поля: метки и заголовки
            details_params = {"format": "metadata", "metadataHeaders": ["From", "Subject"]}
            details_response = await client.get(details_url, headers=headers, params=details_params)

            # Пропускаем письмо, если не удалось получить детали
            if details_response.status_code != 200:
                # Здесь можно добавить логирование, чтобы знать о проблемах
                # logger.warning(f"Failed to fetch details for message {msg_id}")
                continue

            msg_details = details_response.json()
            headers_map = {h['name']: h['value'] for h in msg_details['payload']['headers']}
            label_ids = msg_details.get("labelIds", [])
            
            message_data = {
                "id": msg_details['id'],
                "snippet": msg_details['snippet'],
                "from": headers_map.get("From", "N/A"), # Используем alias "from"
                "subject": headers_map.get("Subject", "(без темы)"),
                "is_unread": (GmailLabel.UNREAD.value in label_ids)
            }
            # Создаем модель из словаря, чтобы Pydantic корректно обработал alias
            messages_list.append(GmailMessage.model_validate(message_data))

    return messages_list

@router.get("/messages/{message_id}", response_model=GmailFullMessage, tags=["gmail"])
async def get_message_details(
    message_id: str,
    current_user: User = Depends(get_refreshed_user_google_creds)
):
    """
    Получает полное содержимое одного письма по его ID, включая тело и вложения.
    """
    google_account = next((acc for acc in current_user.oauth_accounts if acc.provider == 'google'), None)
    if not google_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Аккаунт Google не найден.")

    headers = {"Authorization": f"Bearer {google_account.access_token}"}
    url = f"https://www.googleapis.com/gmail/v1/users/me/messages/{message_id}"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params={"format": "full"})

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=f"Ошибка при получении письма: {response.text}")

    msg_data = response.json()
    body = GmailBody()
    attachments = []
    # Парсим основное тело письма
    _parse_message_part(msg_data.get("payload", {}), body, attachments)
    
    headers_map = {h['name']: h['value'] for h in msg_data.get("payload", {}).get('headers', [])}

    full_message_data = {
        "id": msg_data["id"],
        "snippet": msg_data["snippet"],
        "from": headers_map.get("From", "N/A"), # Используем alias "from"
        "to": headers_map.get("To", "N/A"),
        "subject": headers_map.get("Subject", "(без темы)"),
        "body": body,
        "attachments": attachments,
        "label_ids": msg_data.get("labelIds", [])
    }

    return GmailFullMessage.model_validate(full_message_data)

@router.post("/send", status_code=status.HTTP_201_CREATED, tags=["gmail"])
async def send_email(
    message: GmailSendMessage,
    current_user: User = Depends(get_refreshed_user_google_creds)
):
    """
    Отправляет email через аккаунт пользователя.
    """
    google_account = next((acc for acc in current_user.oauth_accounts if acc.provider == 'google'), None)
    if not google_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Аккаунт Google не найден.")

    headers = {"Authorization": f"Bearer {google_account.access_token}"}
    url = "https://www.googleapis.com/gmail/v1/users/me/messages/send"

    mime_message = MIMEMultipart()
    mime_message["To"] = message.to
    mime_message["From"] = google_account.email
    mime_message["Subject"] = message.subject
    mime_message.attach(MIMEText(message.body, "plain", "utf-8"))
    
    raw_message = base64.urlsafe_b64encode(mime_message.as_bytes()).decode()

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json={"raw": raw_message})

    if response.status_code > 299:
        raise HTTPException(status_code=response.status_code, detail=f"Ошибка при отправке письма: {response.text}")

    return {"message": "Письмо успешно отправлено."}

@router.post("/messages/{message_id}/trash", status_code=status.HTTP_200_OK, tags=["gmail"])
async def trash_message(
    message_id: str,
    current_user: User = Depends(get_refreshed_user_google_creds)
):
    """
    Перемещает письмо в корзину.
    """
    google_account = next((acc for acc in current_user.oauth_accounts if acc.provider == 'google'), None)
    if not google_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Аккаунт Google не найден.")

    headers = {"Authorization": f"Bearer {google_account.access_token}"}
    url = f"https://www.googleapis.com/gmail/v1/users/me/messages/{message_id}/trash"

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=f"Ошибка при перемещении письма в корзину: {response.text}")

    return {"message": f"Письмо {message_id} успешно перемещено в корзину."}

@router.post("/messages/{message_id}/modify", response_model=GmailFullMessage, tags=["gmail"])
async def modify_message_labels(
    message_id: str,
    request_body: GmailModifyRequest,
    current_user: User = Depends(get_refreshed_user_google_creds)
):
    """
    Изменяет метки письма. Позволяет отметить письмо как прочитанное/непрочитанное.
    - `mark_as_unread: true` - пометить как **непрочитанное**.
    - `mark_as_unread: false` - пометить как **прочитанное**.
    """
    google_account = next((acc for acc in current_user.oauth_accounts if acc.provider == 'google'), None)
    if not google_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Аккаунт Google не найден.")

    headers = {"Authorization": f"Bearer {google_account.access_token}"}
    url = f"https://www.googleapis.com/gmail/v1/users/me/messages/{message_id}/modify"
    
    if request_body.mark_as_unread:
        # Пометить как непрочитанное = добавить метку UNREAD
        payload = {"addLabelIds": [GmailLabel.UNREAD.value]}
    else:
        # Пометить как прочитанное = удалить метку UNREAD
        payload = {"removeLabelIds": [GmailLabel.UNREAD.value]}

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=f"Ошибка при изменении меток письма: {response.text}")

    # Возвращаем обновленное состояние письма
    return await get_message_details(message_id, current_user)
