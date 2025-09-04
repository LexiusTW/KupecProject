from sqlalchemy import Column, Integer, String, Table, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base_class import Base


gost_grade_association = Table(
    'gost_grade',
    Base.metadata,
    Column('gost_id', Integer, ForeignKey('gost.id', ondelete='CASCADE'), primary_key=True),
    Column('grade_id', Integer, ForeignKey('steel_grade.id', ondelete='CASCADE'), primary_key=True),
)


class Gost(Base):
    __tablename__ = 'gost'

    id = Column(Integer, primary_key=True)
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    grades = relationship(
        'SteelGrade',
        secondary=gost_grade_association,
        back_populates='gosts',
        lazy='selectin'
    )

    __table_args__ = (
        UniqueConstraint('code', name='uq_gost_code'),
    )


class SteelGrade(Base):
    __tablename__ = 'steel_grade'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    short_description = Column(String, nullable=True)

    gosts = relationship(
        'Gost',
        secondary=gost_grade_association,
        back_populates='grades',
        lazy='selectin'
    )

    __table_args__ = (
        UniqueConstraint('name', name='uq_steel_grade_name'),
    )


