from app.db.base_class import Base
from app.models.crm import Chat, ChatParticipant, ChatMessage, Email
from app.models.metal import Metal, MetalGreen
from app.models.warehouse import Warehouse, WarehouseGreen
from app.models.gost import Gost, SteelGrade, gost_grade_association
from app.models.request import Request, RequestItem
from app.models.user import User
from app.models.counterparty import Counterparty
from app.models.offer_token import OfferToken
from app.models.organization import Organization
from app.models.oauth_account import OAuthAccount
