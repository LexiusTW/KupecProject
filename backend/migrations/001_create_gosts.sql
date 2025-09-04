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


