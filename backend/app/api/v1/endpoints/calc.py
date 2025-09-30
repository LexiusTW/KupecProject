from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from math import pi


router = APIRouter(prefix="/calc", tags=["calc"])


class WeightRequest(BaseModel):
    shape: str | None = Field(None, description="sheet|round|square|pipe|rectPipe|angle|flange|channel|hex|elbow")
    sortament: str | None = Field(None, description="square|round|strip|sheet|elbow|pipe|rectPipe|angle|flange|channel|hex")

    material: str | None = Field(None, description="black|stainless|aluminum|copper|brass|bronze|titanium")
    material_label: str | None = Field(None, description="Черный|Нержавейка|Алюминий|Медь|Латунь|Бронза|Титан")
    material_density: float | None = Field(None, description="Плотность, кг/м^3 (приоритет над material)")

    length_m: float = Field(..., ge=0)

    thickness_mm: float | None = None
    width_mm: float | None = None
    height_mm: float | None = None
    diameter_mm: float | None = None
    outer_d_mm: float | None = None
    inner_d_mm: float | None = None
    holes_count: int | None = None
    hole_d_mm: float | None = None
    bend_radius_mm: float | None = None
    angle_deg: float | None = None
    h_mm: float | None = None
    b_mm: float | None = None
    tw_mm: float | None = None
    tf_mm: float | None = None
    across_flats_mm: float | None = None


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


def area_hex(across_flats_mm: float) -> float:
    from math import sqrt
    s = mm_to_m(across_flats_mm)
    return (s * s * sqrt(3.0)) / 6.0


def area_flange(outer_d_mm: float, inner_d_mm: float, holes_count: int | None, hole_d_mm: float | None) -> float:
    Do = mm_to_m(outer_d_mm)
    Di = mm_to_m(inner_d_mm)
    ring = pi * (Do * Do - Di * Di) / 4.0
    if holes_count and hole_d_mm:
        dh = mm_to_m(hole_d_mm)
        ring -= holes_count * (pi * dh * dh / 4.0)
    return max(ring, 0.0)


def area_channel(h_mm: float, b_mm: float, tw_mm: float, tf_mm: float) -> float:
    h = mm_to_m(h_mm)
    b = mm_to_m(b_mm)
    tw = mm_to_m(tw_mm)
    tf = mm_to_m(tf_mm)
    web = max(h - 2.0 * tf, 0.0) * tw
    flanges = 2.0 * (b * tf)
    return max(web + flanges, 0.0)


MATERIALS = {
    "black":     {"label": "Черный",     "density": 7850.0},
    "stainless": {"label": "Нержавейка", "density": 7900.0},
    "aluminum":  {"label": "Алюминий",   "density": 2700.0},
    "copper":    {"label": "Медь",       "density": 8960.0},
    "brass":     {"label": "Латунь",     "density": 8500.0},
    "bronze":    {"label": "Бронза",     "density": 8800.0},
    "titanium":  {"label": "Титан",      "density": 4500.0},
}

RUS_TO_KEY = {v["label"].lower(): k for k, v in MATERIALS.items()}

SORTAMENTS = {
    "square":   {"label": "Квадрат",         "shape": "square",   "required_fields": ["width_mm"],                               "supported": True},
    "round":    {"label": "Круг/пруток",      "shape": "round",    "required_fields": ["diameter_mm"],                            "supported": True},
    "strip":    {"label": "Лента",           "shape": "sheet",    "required_fields": ["thickness_mm", "width_mm"],              "supported": True},
    "sheet":    {"label": "Лист/плита",      "shape": "sheet",    "required_fields": ["thickness_mm", "width_mm"],              "supported": True},
    "elbow":    {"label": "Отвод",           "shape": "elbow",    "required_fields": ["outer_d_mm", "thickness_mm", "bend_radius_mm"], "optional_fields": ["angle_deg"], "supported": True},
    "pipe":     {"label": "Труба круглая",    "shape": "pipe",     "required_fields": ["outer_d_mm", "thickness_mm"],            "supported": True},
    "rectPipe": {"label": "Труба профильная", "shape": "rectPipe", "required_fields": ["width_mm", "height_mm", "thickness_mm"], "supported": True},
    "angle":    {"label": "Уголок",          "shape": "angle",    "required_fields": ["width_mm", "height_mm", "thickness_mm"], "supported": True},
    "flange":   {"label": "Фланец плоский",  "shape": "flange",   "required_fields": ["outer_d_mm", "inner_d_mm", "thickness_mm"],      "optional_fields": ["holes_count", "hole_d_mm"], "supported": True},
    "channel":  {"label": "Швеллер",         "shape": "channel",  "required_fields": ["h_mm", "b_mm", "tw_mm", "tf_mm"],       "supported": True},
    "hex":      {"label": "Шестигранник",    "shape": "hex",      "required_fields": ["across_flats_mm"],                       "supported": True},
}

class CalcSchemaResponse(BaseModel):
    materials: list[dict]
    sortament: dict
    note: str | None = None

@router.get("/schema", response_model=CalcSchemaResponse)
def get_schema():
    order = ["black", "stainless", "aluminum", "copper", "brass", "bronze", "titanium"]
    mats = [{"key": k, "label": MATERIALS[k]["label"], "density": MATERIALS[k]["density"]} for k in order]
    return CalcSchemaResponse(
        materials=mats,
        sortament=SORTAMENTS,
        note=("Фланец учитывает отверстия (если переданы). Отвод — по длине дуги по осевой линии."),
    )


@router.post("/weight", response_model=WeightResponse)
def calc_weight(payload: WeightRequest):
    shape = payload.shape
    if not shape and payload.sortament:
        spec = SORTAMENTS.get(payload.sortament)
        if not spec:
            raise HTTPException(status_code=400, detail="Unknown sortament")
        if not spec.get("supported", False):
            raise HTTPException(status_code=400, detail="This sortament is not supported")
        shape = spec["shape"]
    if not shape:
        raise HTTPException(status_code=400, detail="shape or sortament is required")

    if payload.material_density is not None:
        density = payload.material_density
    else:
        key = (payload.material or "").lower()
        if not key and payload.material_label:
            key = RUS_TO_KEY.get(payload.material_label.lower(), "")
        density = MATERIALS.get(key, MATERIALS["black"]) ["density"]

    if payload.sortament and payload.sortament in SORTAMENTS:
        req = SORTAMENTS[payload.sortament].get("required_fields", [])
        missing = [f for f in req if getattr(payload, f) in (None, 0, 0.0)]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(missing)}")

    L = payload.length_m
    area = 0.0
    if shape == 'sheet':
        area = area_sheet(payload.thickness_mm or 0.0, payload.width_mm or 0.0)
    elif shape == 'round':
        area = area_round(payload.diameter_mm or 0.0)
    elif shape == 'square':
        area = area_square(payload.width_mm or 0.0)
    elif shape == 'pipe':
        area = area_pipe(payload.outer_d_mm or 0.0, payload.thickness_mm or 0.0)
    elif shape == 'rectPipe':
        area = area_rect_pipe(payload.width_mm or 0.0, payload.height_mm or 0.0, payload.thickness_mm or 0.0)
    elif shape == 'angle':
        area = area_angle(payload.width_mm or 0.0, payload.height_mm or 0.0, payload.thickness_mm or 0.0)
    elif shape == 'flange':
        area = area_flange(payload.outer_d_mm or 0.0, payload.inner_d_mm or 0.0, payload.holes_count, payload.hole_d_mm)
    elif shape == 'channel':
        area = area_channel(payload.h_mm or 0.0, payload.b_mm or 0.0, payload.tw_mm or 0.0, payload.tf_mm or 0.0)
    elif shape == 'hex':
        area = area_hex(payload.across_flats_mm or 0.0)
    elif shape == 'elbow':
        # Масса отвода по дуге центра (угол по умолчанию 90°)
        angle_rad = (payload.angle_deg or 90.0) * pi / 180.0
        R_c = mm_to_m(payload.bend_radius_mm or 0.0)
        area_cs = area_pipe(payload.outer_d_mm or 0.0, payload.thickness_mm or 0.0)
        mass_total = area_cs * (angle_rad * R_c) * density
        return WeightResponse(area_m2=area_cs, mass_per_meter_kg=area_cs * density, mass_total_kg=mass_total, used_density=density)
    else:
        raise HTTPException(status_code=400, detail="Unsupported shape")

    mass_per_meter = area * density
    mass_total = mass_per_meter * L
    return WeightResponse(area_m2=area, mass_per_meter_kg=mass_per_meter, mass_total_kg=mass_total, used_density=density)


