from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class SteelGradeBase(BaseModel):
    name: str
    short_description: Optional[str] = None


class SteelGradeOut(SteelGradeBase):
    id: int

    class SomeSchema(BaseModel):
        model_config = ConfigDict(from_attributes=True)


class GostBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


class GostOut(GostBase):
    id: int
    grades: List[SteelGradeOut] = []

    class SomeSchema(BaseModel):
        model_config = ConfigDict(from_attributes=True)


class GostListItem(BaseModel):
    id: int
    code: str
    name: str

    class SomeSchema(BaseModel):
        model_config = ConfigDict(from_attributes=True)


class SteelGradeWithGosts(SteelGradeOut):
    gosts: List[GostListItem] = []


