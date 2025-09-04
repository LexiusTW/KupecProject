INSERT INTO gost (code, name, description) VALUES
('ГОСТ 5781-82', 'Сталь горячекатаная для армирования железобетонных конструкций', 'Регламентирует прокат для армирования ЖБК (классы A240, A400, A500 и др.)')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO gost (code, name, description) VALUES
('ГОСТ 380-2005', 'Стали обыкновенного качества', 'Требования к сталям обыкновенного качества. В т.ч. Ст0-Ст6')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO gost (code, name, description) VALUES
('ГОСТ 1050-2013', 'Прокат из качественной конструкционной углеродистой стали', 'Марки 10, 15, 20, 35, 45 и др. для конструкционных изделий')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO gost (code, name, description) VALUES
('ГОСТ 19281-2014', 'Прокат из низколегированной стали повышенной прочности', 'Низколегированная сталь, напр. 09Г2С, 10Г2С1 и др.')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO gost (code, name, description) VALUES
('ГОСТ 5632-2014', 'Стали и сплавы коррозионно-стойкие, жаростойкие и жаропрочные', 'Марки нержавеющих и жаропрочных сталей и сплавов')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO steel_grade (name) VALUES
('A240') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('A400') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('A500C') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('A600') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('A800') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('Ст0') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('Ст1') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('Ст2') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('Ст3') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('Ст3сп') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('Ст3пс') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('Ст3кп') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('10') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('15') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('20') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('35') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('45') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('50') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('09Г2С') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('10Г2С1') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('12Х18Н10Т') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('08Х18Н10') ON CONFLICT (name) DO NOTHING;
INSERT INTO steel_grade (name) VALUES
('20Х23Н18') ON CONFLICT (name) DO NOTHING;

INSERT INTO gost_grade (gost_id, grade_id)
SELECT g.id, s.id FROM gost g JOIN steel_grade s ON s.name IN ('A240', 'A400', 'A500C', 'A600', 'A800') WHERE g.code = 'ГОСТ 5781-82'
ON CONFLICT DO NOTHING;

INSERT INTO gost_grade (gost_id, grade_id)
SELECT g.id, s.id FROM gost g JOIN steel_grade s ON s.name IN ('Ст0', 'Ст1', 'Ст2', 'Ст3', 'Ст3сп', 'Ст3пс', 'Ст3кп') WHERE g.code = 'ГОСТ 380-2005'
ON CONFLICT DO NOTHING;

INSERT INTO gost_grade (gost_id, grade_id)
SELECT g.id, s.id FROM gost g JOIN steel_grade s ON s.name IN ('10', '15', '20', '35', '45', '50') WHERE g.code = 'ГОСТ 1050-2013'
ON CONFLICT DO NOTHING;

INSERT INTO gost_grade (gost_id, grade_id)
SELECT g.id, s.id FROM gost g JOIN steel_grade s ON s.name IN ('09Г2С', '10Г2С1') WHERE g.code = 'ГОСТ 19281-2014'
ON CONFLICT DO NOTHING;

INSERT INTO gost_grade (gost_id, grade_id)
SELECT g.id, s.id FROM gost g JOIN steel_grade s ON s.name IN ('12Х18Н10Т', '08Х18Н10', '20Х23Н18') WHERE g.code = 'ГОСТ 5632-2014'
ON CONFLICT DO NOTHING;


