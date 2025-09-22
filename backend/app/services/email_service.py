import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from fastapi import BackgroundTasks

from app.core.config import settings

def send_email(
    recipient_email: str,
    subject: str,
    content: str,
):
    if not all([settings.SMTP_HOST, settings.SMTP_PORT, settings.SMTP_USER, settings.SMTP_PASSWORD]):
        print("SMTP settings are not configured. Email not sent.")
        return

    msg = MIMEMultipart()
    msg['From'] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg['To'] = recipient_email
    msg['Subject'] = subject
 
    msg.attach(MIMEText(content, 'html'))

    try:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            print(f"Email sent to {recipient_email}")
    except Exception as e:
        print(f"Failed to send email to {recipient_email}. Error: {e}")

def send_email_background(
    background_tasks: BackgroundTasks,
    recipient_email: str,
    subject: str,
    content: str,
):
    background_tasks.add_task(
        send_email, recipient_email, subject, content
    )
