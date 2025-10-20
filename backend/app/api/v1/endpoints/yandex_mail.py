import imaplib
import smtplib
import email
import logging
import base64
from datetime import datetime
from email.header import decode_header, Header
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import parsedate_to_datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List, Optional, Dict, Any
import traceback
from pydantic import BaseModel, Field
from enum import Enum

# --- MONKEY PATCH IMAPLIB TO FORCE UTF-8 ---
# This is a last resort hack because imaplib is ignoring the encoding setting.
_original_command = imaplib.IMAP4._command

def _new_command(self, name, *args):
    # Force the encoding to utf-8 for all string arguments
    new_args = []
    for arg in args:
        if isinstance(arg, str):
            new_args.append(arg.encode('utf-8'))
        else:
            new_args.append(arg)
    return _original_command(self, name, *new_args)

imaplib.IMAP4._command = _new_command
# --- END MONKEY PATCH ---

from app.api.deps import get_refreshed_user_yandex_creds
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()

# --- Enums & Schemas ---

class YandexFolder(str, Enum):
    """
    Стандартные папки Яндекс.Почты.
    """
    INBOX = "INBOX"          # Входящие
    SENT = "SENT"            # Отправленные
    DRAFTS = "DRAFTS"        # Черновики
    SPAM = "SPAM"            # Спам
    TRASH = "TRASH"      # Удаленные

class YandexMessage(BaseModel):
    """Схема для краткой информации о письме."""
    id: str # UID письма
    snippet: str
    from_: str = Field(..., alias="from")
    subject: str
    date: datetime
    is_unread: bool = Field(True, description="True, если письмо не прочитано")

class YandexAttachment(BaseModel):
    """Схема для метаданных вложения."""
    filename: str
    content_type: str
    size: int
    # Для скачивания вложения потребуется тело письма и content-id

class YandexBody(BaseModel):
    """Схема для тела письма (plain text и/или HTML)."""
    plain: Optional[str] = None
    html: Optional[str] = None

class YandexFullMessage(BaseModel):
    """Схема для полного представления письма."""
    id: str
    from_: str = Field(..., alias="from")
    to: str
    subject: str
    date: datetime
    body: YandexBody
    attachments: List[YandexAttachment]


class YandexSendMessage(BaseModel):
    """Схема для отправки письма."""
    to: str
    subject: str
    body: str

class ModifyFlagsRequest(BaseModel):
    """Схема для изменения флагов письма (прочитано/не прочитано)."""
    is_unread: Optional[bool] = None

# --- Helper Functions ---

def _decode_header(header: str) -> str:
    """Декодирует заголовки email, которые могут быть в разных кодировках."""
    decoded_parts = []
    for bytes_part, charset in decode_header(header):
        if isinstance(bytes_part, bytes):
            try:
                decoded_parts.append(bytes_part.decode(charset or 'utf-8'))
            except (UnicodeDecodeError, LookupError):
                decoded_parts.append(bytes_part.decode('latin-1')) # Fallback
        else:
            decoded_parts.append(str(bytes_part))
    return "".join(decoded_parts)

def _parse_email_body(msg: email.message.Message) -> tuple[YandexBody, List[YandexAttachment]]:
    """Парсит тело письма и вложения."""
    body = YandexBody()
    attachments = []
    
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))

            if content_type == "text/plain" and "attachment" not in content_disposition:
                body.plain = part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', errors='ignore')
            elif content_type == "text/html" and "attachment" not in content_disposition:
                body.html = part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', errors='ignore')
            elif "attachment" in content_disposition:
                filename = part.get_filename()
                if filename:
                    attachments.append(YandexAttachment(
                        filename=_decode_header(filename),
                        content_type=part.get_content_type(),
                        size=len(part.get_payload(decode=True))
                    ))
    else:
        content_type = msg.get_content_type()
        if content_type == "text/plain":
            body.plain = msg.get_payload(decode=True).decode(msg.get_content_charset() or 'utf-8', errors='ignore')
        elif content_type == "text/html":
            body.html = msg.get_payload(decode=True).decode(msg.get_content_charset() or 'utf-8', errors='ignore')

    return body, attachments

async def get_yandex_imap_connection(
    request: Request, # Используем request, чтобы получить пользователя один раз
    current_user: User = Depends(get_refreshed_user_yandex_creds)
) -> imaplib.IMAP4_SSL:
    """
    Зависимость для получения аутентифицированного IMAP-соединения с Яндексом.
    """
    yandex_account = next((acc for acc in current_user.oauth_accounts if acc.provider == 'yandex'), None)
    if not yandex_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Аккаунт Yandex не найден.")

    # Формируем строку аутентификации XOAUTH2 для Яндекса
    auth_string = f"user={yandex_account.email}\x01auth=Bearer {yandex_account.access_token}\x01\x01"
    
    logger.info(f"Yandex IMAP: Using auth string for {yandex_account.email}")

    try:
        imap = imaplib.IMAP4_SSL("imap.yandex.ru")
        # imap.debug = 4 # Отключить в продакшене

        imap.authenticate("XOAUTH2", lambda x: auth_string.encode('utf-8'))
        
        return imap
    except imaplib.IMAP4.error as e:
        logger.error(f"Ошибка аутентификации IMAP для {yandex_account.email}: {e}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Ошибка IMAP: {e.args[0]}")

# --- Endpoints ---

@router.get("/messages", response_model=List[YandexMessage], tags=["yandex_mail"])
async def get_messages(
    folder: YandexFolder = YandexFolder.INBOX,
    page: int = Query(1, ge=1, description="Номер страницы для пагинации"),
    size: int = Query(25, ge=1, le=100, description="Количество писем на странице"),
    imap: imaplib.IMAP4_SSL = Depends(get_yandex_imap_connection)
):
    """
    Получает список писем для указанной папки с пагинацией.
    """
    try:
        with imap:
            typ, data = imap.select(f'"{folder.value}"')
            if typ != 'OK':
                error_message = data[0].decode('utf-8', 'ignore') if data and data[0] else "Unknown error"
                raise HTTPException(status_code=503, detail=f"Не удалось выбрать папку '{folder.value}': {error_message}")

            status_code, message_ids = imap.uid('search', None, "ALL")
            if status_code != 'OK':
                raise HTTPException(status_code=500, detail="Не удалось выполнить поиск писем.")
            
            message_uids = message_ids[0].split()
            if not message_uids:
                return []
            
            # Pagination logic
            total_messages = len(message_uids)
            start_index = total_messages - (page * size)
            end_index = total_messages - ((page - 1) * size)

            # Get the slice of UIDs for the current page
            paginated_uids = message_uids[max(0, start_index):end_index]

            if not paginated_uids:
                # This happens when the page number is too high
                return []

            fetch_uids_str = b','.join(paginated_uids)

            messages = []
            status_code, fetch_data = imap.uid('fetch', fetch_uids_str, '(UID FLAGS RFC822.HEADER)')

            if status_code != 'OK':
                raise HTTPException(status_code=500, detail="Не удалось получить заголовки писем.")

            # Используем итератор, чтобы можно было заглядывать вперед
            data_iter = iter(fetch_data)
            for item in data_iter:
                # Случай 1: imaplib вернул корректный кортеж (метаданные, заголовок)
                if isinstance(item, tuple):
                    metadata_bytes, header_bytes = item
                # Случай 2: imaplib вернул плоский список. Ищем метаданные.
                elif isinstance(item, bytes) and b'RFC822.HEADER' in item:
                    metadata_bytes = item
                    # Заголовок - это следующий элемент в итераторе
                    try:
                        header_bytes = next(data_iter)
                        # Если заголовок пришел кортежем, берем второй элемент
                        if isinstance(header_bytes, tuple):
                            header_bytes = header_bytes[0]
                    except StopIteration:
                        continue # Метаданные есть, а заголовка нет, пропускаем
                else:
                    continue # Пропускаем ненужные элементы (например, b')')

                # Теперь, когда у нас есть metadata_bytes и header_bytes, парсим их
                try:
                    uid_match = imaplib.re.search(rb'UID\s+(\d+)', metadata_bytes)
                    if not uid_match:
                        continue
                    uid = uid_match.group(1).decode()

                    flags = imaplib.ParseFlags(metadata_bytes)
                    is_unread = b'\Seen' not in flags

                    msg = email.message_from_bytes(header_bytes)

                    subject = _decode_header(msg.get("Subject", "(без темы)"))
                    from_header = _decode_header(msg.get("From", "N/A"))
                    date_str = msg.get("Date")
                    date_obj = parsedate_to_datetime(date_str) if date_str else datetime.now()

                    message_data = {
                        "id": uid,
                        "snippet": "",
                        "from": from_header or "N/A",
                        "subject": subject,
                        "date": date_obj,
                        "is_unread": is_unread,
                    }
                    messages.append(YandexMessage.model_validate(message_data))

                except Exception as e:
                    logger.warning(f"Не удалось распарсить письмо: {e}", exc_info=True)
                    continue

            # Сервер возвращает сообщения в порядке возрастания UID, развернем для показа новых вначале.
            messages.reverse()
            return messages

    except imaplib.IMAP4.error as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Ошибка IMAP: {e.args[0]}")
    except Exception as e:
        logger.error(f"Ошибка обработки email: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Внутренняя ошибка: {e}")


@router.get("/messages/{message_id}", response_model=YandexFullMessage, tags=["yandex_mail"])
async def get_message_details(
    message_id: str,
    folder: YandexFolder = Query(YandexFolder.INBOX, description="Папка, в которой находится письмо"),
    imap: imaplib.IMAP4_SSL = Depends(get_yandex_imap_connection)
):
    """
    Получает полное содержимое одного письма по его UID.
    """
    try:
        with imap:
            typ, data = imap.select(f'"{folder.value}"')
            if typ != 'OK':
                error_message = data[0].decode('utf-8', 'ignore') if data and data[0] else "Unknown error"
                raise HTTPException(status_code=503, detail=f"Не удалось выбрать папку '{folder.value}': {error_message}")

            status_code, fetch_data = imap.uid('fetch', message_id.encode(), '(RFC822)')

            if status_code != 'OK' or not fetch_data or not isinstance(fetch_data[0], (tuple, bytes)):
                raise HTTPException(status_code=404, detail=f"Письмо с UID {message_id} в папке '{folder.value}' не найдено.")

            # The raw email is the second part of the first tuple in the fetch_data
            raw_email = fetch_data[0][1]

            msg = email.message_from_bytes(raw_email)

            body, attachments = _parse_email_body(msg)
            
            date_str = msg.get("Date")
            date_obj = parsedate_to_datetime(date_str) if date_str else datetime.now()

            message_data = {
                "id": message_id,
                "from": _decode_header(msg.get("From", "N/A")),
                "to": _decode_header(msg.get("To", "N/A")),
                "subject": _decode_header(msg.get("Subject", "(без темы)")),
                "date": date_obj,
                "body": body,
                "attachments": attachments,
            }
            return YandexFullMessage.model_validate(message_data)

    except imaplib.IMAP4.error as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Ошибка IMAP: {e.args[0]}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Внутренняя ошибка: {e}")

@router.post("/send", status_code=status.HTTP_201_CREATED, tags=["yandex_mail"])
async def send_email(
    message: YandexSendMessage,
    current_user: User = Depends(get_refreshed_user_yandex_creds)
):
    """
    Отправляет email через аккаунт пользователя.
    """
    yandex_account = next((acc for acc in current_user.oauth_accounts if acc.provider == 'yandex'), None)
    if not yandex_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Аккаунт Yandex не найден.")

    msg = MIMEMultipart()
    msg['To'] = message.to
    msg['From'] = yandex_account.email
    msg['Subject'] = Header(message.subject, 'utf-8')
    msg.attach(MIMEText(message.body, 'plain', 'utf-8'))

    logger.info(f"Yandex SMTP: Попытка отправки письма от {yandex_account.email}")

    try:
        with smtplib.SMTP_SSL('smtp.yandex.ru', 465) as smtp:
            # smtp.set_debuglevel(1)
            
            auth_string = f"user={yandex_account.email}\x01auth=Bearer {yandex_account.access_token}\x01\x01"
            auth_b64_string = base64.b64encode(auth_string.encode('utf-8')).decode('ascii')
            
            # Ручная аутентификация XOAUTH2, чтобы обойти проблемы в smtplib
            code, response = smtp.docmd('AUTH', f'XOAUTH2 {auth_b64_string}')
            
            if code != 235:
                # Если код ответа не 235, аутентификация не удалась
                raise smtplib.SMTPAuthenticationError(code, response)

            smtp.sendmail(yandex_account.email, [message.to], msg.as_string())
        
        return {"message": "Письмо успешно отправлено."}

    except smtplib.SMTPException as e:
        # Ловим SMTPAuthenticationError отдельно для более ясного сообщения
        if isinstance(e, smtplib.SMTPAuthenticationError):
             raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Ошибка аутентификации SMTP: {e.smtp_code} - {e.smtp_error}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Ошибка SMTP: {e}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Внутренняя ошибка: {e}")

@router.post("/messages/{message_id}/trash", status_code=status.HTTP_200_OK, tags=["yandex_mail"])
async def trash_message(
    message_id: str,
    imap: imaplib.IMAP4_SSL = Depends(get_yandex_imap_connection)
):
    """
    Перемещает письмо в корзину.
    """
    try:
        with imap:
            typ, data = imap.select('INBOX')
            if typ != 'OK':
                error_message = data[0].decode('utf-8', 'ignore') if data and data[0] else "Unknown error"
                raise HTTPException(status_code=503, detail=f"Не удалось выбрать папку 'INBOX': {error_message}")

            trash_folder = YandexFolder.TRASH.value
            
            if 'MOVE' in imap.capabilities:
                result, data = imap.uid('move', message_id.encode(), trash_folder)
                if result != 'OK':
                    error_detail = f"Не удалось переместить письмо в корзину: {result}"
                    if data and data[0] and isinstance(data[0], bytes):
                        error_detail += f" ({data[0].decode('utf-8', 'ignore')})"
                    raise HTTPException(status_code=500, detail=error_detail)
            else:
                # Fallback to COPY + DELETE
                result, data = imap.uid('copy', message_id.encode(), trash_folder)
                if result != 'OK':
                    error_detail = f"Не удалось скопировать письмо в корзину: {result}"
                    if data and data[0] and isinstance(data[0], bytes):
                        error_detail += f" ({data[0].decode('utf-8', 'ignore')})"
                    raise HTTPException(status_code=500, detail=error_detail)
                
                result, _ = imap.uid('store', message_id.encode(), '+FLAGS', '(\Deleted)')
                if result != 'OK':
                    raise HTTPException(status_code=500, detail="Не удалось пометить письмо как удаленное.")
                
                imap.expunge()

        return {"message": f"Письмо {message_id} успешно перемещено в корзину."}

    except imaplib.IMAP4.error as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Ошибка IMAP: {e.args[0]}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Внутренняя ошибка: {e}")

@router.post("/messages/{message_id}/modify", status_code=status.HTTP_200_OK, tags=["yandex_mail"])
async def modify_message_flags(
    message_id: str,
    request: Request,
    request_body: ModifyFlagsRequest,
    folder: YandexFolder = Query(YandexFolder.INBOX, description="Папка, в которой находится письмо"),
    imap: imaplib.IMAP4_SSL = Depends(get_yandex_imap_connection),
    current_user: User = Depends(get_refreshed_user_yandex_creds),
):
    """
    Изменяет метки письма. Позволяет отметить письмо как прочитанное/непрочитанное.
    - `is_unread: false` - пометить как **прочитанное**.
    - `is_unread: true` - пометить как **непрочитанное**.
    """
    if request_body.is_unread is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Необходимо указать значение для 'is_unread'.")

    # is_unread: true -> ХОТИМ сделать непрочитанным -> УБИРАЕМ флаг \Seen
    # is_unread: false -> ХОТИМ сделать прочитанным -> ДОБАВЛЯЕМ флаг \Seen
    action = b'-FLAGS' if request_body.is_unread else b'+FLAGS'
    flag = b'(\\Seen)'

    try:
        with imap:
            typ, data = imap.select(f'"{folder.value}"')
            if typ != 'OK':
                error_message = data[0].decode('utf-8', 'ignore') if data and data[0] else "Unknown error"
                raise HTTPException(status_code=503, detail=f"Не удалось выбрать папку '{folder.value}': {error_message}")

            result, data = imap.uid('store', message_id.encode(), action, flag)
            if result != 'OK':
                error_detail = f"Не удалось изменить флаги письма: {result}"
                if data and data[0] and isinstance(data[0], bytes):
                    error_detail += f" ({data[0].decode('utf-8', 'ignore')})"
                raise HTTPException(status_code=500, detail=error_detail)

    except imaplib.IMAP4.error as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Ошибка IMAP: {e.args[0]}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Внутренняя ошибка: {e}")

    return {"message": "Статус письма успешно изменен."}
