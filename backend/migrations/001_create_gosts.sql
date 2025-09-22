CREATE TABLE IF NOT EXISTS gost (
    id SERIAL PRIMARY KEY,
    code VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT NULL,
    CONSTRAINT uq_gost_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS steel_grade (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    short_description TEXT NULL,
    CONSTRAINT uq_steel_grade_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS gost_grade (
    gost_id INTEGER NOT NULL REFERENCES gost(id) ON DELETE CASCADE,
    grade_id INTEGER NOT NULL REFERENCES steel_grade(id) ON DELETE CASCADE,
    PRIMARY KEY (gost_id, grade_id)
);

-- Создаем таблицу metal если её нет
CREATE TABLE IF NOT EXISTS metal (
    id SERIAL PRIMARY KEY,
    name VARCHAR,
    state_standard VARCHAR,
    category VARCHAR,
    stamp VARCHAR,
    diameter FLOAT,
    thickness FLOAT,
    width FLOAT,
    length FLOAT,
    material VARCHAR,
    price FLOAT,
    unit VARCHAR,
    price_updated_at TIMESTAMP,
    comments TEXT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouse(id)
);

-- Создаем системный склад если его нет
INSERT INTO warehouse (city, supplier, phone_number, email, legal_entity, working_hours)
SELECT 'Екатеринбург', 'SYSTEM', '+7(343)123-45-67', 'system@kupec.ru', 'ООО Купец', 'Пн-Пт 9:00-18:00'
WHERE NOT EXISTS (
    SELECT 1 FROM warehouse WHERE city = 'Екатеринбург' AND supplier = 'SYSTEM'
);


