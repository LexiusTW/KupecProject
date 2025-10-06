from typing import Optional
from sqlalchemy.orm import Session
from app.models.organization import Organization
from app.schemas.organization import OrganizationCreate

def get_by_inn(db: Session, *, inn: str) -> Optional[Organization]:
    return db.query(Organization).filter(Organization.inn == inn).first()

def create(db: Session, *, obj_in: OrganizationCreate) -> Organization:
    db_obj = Organization(
        **obj_in.model_dump()
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj
