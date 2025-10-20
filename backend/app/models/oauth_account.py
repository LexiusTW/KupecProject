from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    provider = Column(String, nullable=False, index=True)  # "google", "yandex", etc.
    
    # Уникальный ID пользователя в системе провайдера (от Google, Yandex и т.д.)
    provider_user_id = Column(String, nullable=False, unique=True, index=True) 
    
    email = Column(String, nullable=False)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime(timezone=True), nullable=True)
    scopes = Column(JSON, nullable=True) # Список разрешений (scopes)

    user = relationship("User", back_populates="oauth_accounts")
