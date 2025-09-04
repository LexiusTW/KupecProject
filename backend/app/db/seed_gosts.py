from typing import Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gost import Gost, SteelGrade


INITIAL_GOSTS: List[Dict] = [
    {
        "code": "ГОСТ 5781-82",
        "name": "Сталь горячекатаная для армирования железобетонных конструкций",
        "description": "Регламентирует прокат для армирования ЖБК (классы A240, A400, A500 и др.)",
        "grades": ["A240", "A400", "A500C", "A600", "A800"],
    },
    {
        "code": "ГОСТ 380-2005",
        "name": "Стали обыкновенного качества",
        "description": "Требования к сталям обыкновенного качества. В т.ч. Ст0-Ст6",
        "grades": ["Ст0", "Ст1", "Ст2", "Ст3", "Ст3сп", "Ст3пс", "Ст3кп"],
    },
    {
        "code": "ГОСТ 1050-2013",
        "name": "Прокат из качественной конструкционной углеродистой стали",
        "description": "Марки 10, 15, 20, 35, 45 и др. для конструкционных изделий",
        "grades": ["10", "15", "20", "35", "45", "50"],
    },
    {
        "code": "ГОСТ 19281-2014",
        "name": "Прокат из низколегированной стали повышенной прочности",
        "description": "Низколегированная сталь, напр. 09Г2С, 10Г2С1 и др.",
        "grades": ["09Г2С", "10Г2С1"],
    },
    {
        "code": "ГОСТ 5632-2014",
        "name": "Стали и сплавы коррозионно-стойкие, жаростойкие и жаропрочные",
        "description": "Марки нержавеющих и жаропрочных сталей и сплавов",
        "grades": ["12Х18Н10Т", "08Х18Н10", "20Х23Н18"],
    },
]


async def get_or_create_grade(session: AsyncSession, name: str) -> SteelGrade:
    result = await session.execute(select(SteelGrade).where(SteelGrade.name == name))
    grade = result.scalar_one_or_none()
    if grade is None:
        grade = SteelGrade(name=name)
        session.add(grade)
        await session.flush()
    return grade


async def get_or_create_gost(session: AsyncSession, code: str, name: str, description: str | None) -> Gost:
    result = await session.execute(select(Gost).where(Gost.code == code))
    gost = result.scalar_one_or_none()
    if gost is None:
        gost = Gost(code=code, name=name, description=description)
        session.add(gost)
        await session.flush()
    else:
        gost.name = name
        gost.description = description
    return gost


async def seed_gosts_and_grades(session: AsyncSession) -> None:
    for gost_data in INITIAL_GOSTS:
        gost = await get_or_create_gost(
            session=session,
            code=gost_data["code"],
            name=gost_data["name"],
            description=gost_data.get("description"),
        )

        grades = []
        for grade_name in gost_data.get("grades", []):
            grade = await get_or_create_grade(session, grade_name)
            grades.append(grade)

        # Устанавливаем связи многие-ко-многим без дубликатов
        existing = {g.id for g in gost.grades}
        for grade in grades:
            if grade.id not in existing:
                gost.grades.append(grade)

    await session.commit()


