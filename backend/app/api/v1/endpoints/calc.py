from fastapi import APIRouter
from pydantic import BaseModel, Field
from math import pi


router = APIRouter(prefix="/calc", tags=["calc"])


class WeightRequest(BaseModel):
    shape: str = Field(..., description="sheet|round|square|pipe|rectPipe|angle")
    material: str | None = Field(None, description="black|stainless|aluminum|copper|brass|bronze|titanium")
    material_density: float | None = Field(None, description="Плотность, кг/м^3 (если задано — приоритет)\nПо material подставляется автоматически")
    length_m: float = Field(..., ge=0)

    thickness_mm: float | None = None
    width_mm: float | None = None
    height_mm: float | None = None
    diameter_mm: float | None = None
    outer_d_mm: float | None = None


class WeightResponse(BaseModel):
    area_m2: float
    mass_per_meter_kg: float
    mass_total_kg: float
    used_density: float


def mm_to_m(v: float | None) -> float:
    return (v or 0.0) / 1000.0


def area_sheet(thickness_mm: float, width_mm: float) -> float:
    return mm_to_m(thickness_mm) * mm_to_m(width_mm)


def area_round(diameter_mm: float) -> float:
    d = mm_to_m(diameter_mm)
    return pi * d * d / 4.0


def area_square(side_mm: float) -> float:
    a = mm_to_m(side_mm)
    return a * a


def area_pipe(Dmm: float, thickness_mm: float) -> float:
    D = mm_to_m(Dmm)
    t = mm_to_m(thickness_mm)
    d_in = max(D - 2.0 * t, 0.0)
    return pi * (D * D - d_in * d_in) / 4.0


def area_rect_pipe(width_mm: float, height_mm: float, thickness_mm: float) -> float:
    b = mm_to_m(width_mm)
    h = mm_to_m(height_mm)
    t = mm_to_m(thickness_mm)
    bi = max(b - 2.0 * t, 0.0)
    hi = max(h - 2.0 * t, 0.0)
    return b * h - bi * hi


def area_angle(width_mm: float, height_mm: float, thickness_mm: float) -> float:
    b = mm_to_m(width_mm)
    h = mm_to_m(height_mm)
    t = mm_to_m(thickness_mm)
    return max(t * (b + h - t), 0.0)


MATERIALS = {
    "black": 7850.0,
    "stainless": 7900.0,
    "aluminum": 2700.0,
    "copper": 8960.0,
    "brass": 8500.0,
    "bronze": 8800.0,
    "titanium": 4500.0,
}

SORTAMENTS = {
    "square": {"title": "Квадрат", "shape": "square", "required_fields": ["width_mm"]},
    "round": {"title": "Круг/пруток", "shape": "round", "required_fields": ["diameter_mm"]},
    "strip": {"title": "Лента", "shape": "sheet", "required_fields": ["thickness_mm", "width_mm"]},
    "sheet": {"title": "Лист/плита", "shape": "sheet", "required_fields": ["thickness_mm", "width_mm"]},
    "elbow": {"title": "Отвод", "shape": None, "required_fields": []},
    "pipe": {"title": "Труба круглая", "shape": "pipe", "required_fields": ["outer_d_mm", "thickness_mm"]},
    "rectPipe": {"title": "Труба профильная", "shape": "rectPipe", "required_fields": ["width_mm", "height_mm", "thickness_mm"]},
    "angle": {"title": "Уголок", "shape": "angle", "required_fields": ["width_mm", "height_mm", "thickness_mm"]},
    "flange": {"title": "Фланец плоский", "shape": None, "required_fields": []},
    "channel": {"title": "Швеллер", "shape": None, "required_fields": []},
    "hex": {"title": "Шестигранник", "shape": "round", "required_fields": ["diameter_mm"]},
}

class CalcSchemaResponse(BaseModel):
    materials: list[str]
    sortament: dict
    note: str | None = None

@router.get("/schema", response_model=CalcSchemaResponse)
def get_schema():
    return CalcSchemaResponse(
        materials=["black", "stainless", "aluminum", "copper", "brass", "bronze", "titanium"],
        sortament=SORTAMENTS,
        note=("Отвод, фланец, швеллер требуют точного сортамента; в текущей версии не рассчитываются."),
    )


@router.post("/weight", response_model=WeightResponse)
def calc_weight(payload: WeightRequest):
    s = payload.shape
    if payload.material_density is not None:
        density = payload.material_density
    else:
        density = MATERIALS.get((payload.material or "").lower(), MATERIALS["black"])
    L = payload.length_m

    area = 0.0
    if s == 'sheet':
        area = area_sheet(payload.thickness_mm or 0.0, payload.width_mm or 0.0)
    elif s == 'round':
        area = area_round(payload.diameter_mm or 0.0)
    elif s == 'square':
        area = area_square(payload.width_mm or 0.0)
    elif s == 'pipe':
        area = area_pipe(payload.outer_d_mm or 0.0, payload.thickness_mm or 0.0)
    elif s == 'rectPipe':
        area = area_rect_pipe(payload.width_mm or 0.0, payload.height_mm or 0.0, payload.thickness_mm or 0.0)
    elif s == 'angle':
        area = area_angle(payload.width_mm or 0.0, payload.height_mm or 0.0, payload.thickness_mm or 0.0)

    mass_per_meter = area * density
    mass_total = mass_per_meter * L
    return WeightResponse(area_m2=area, mass_per_meter_kg=mass_per_meter, mass_total_kg=mass_total, used_density=density)


