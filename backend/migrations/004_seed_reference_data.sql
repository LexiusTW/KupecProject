-- 004_seed_reference_data.sql
-- Расширенное наполнение ГОСТов, марок стали и примеров металлопроката.
-- Скрипт идемпотентен: использует ON CONFLICT / WHERE NOT EXISTS.

-- 1) ГОСТы (основные группы, охватывающие большую часть металлопроката и марок)
INSERT INTO gost (code, name, description) VALUES
('ГОСТ 380-2005', 'Сталь углеродистая обыкновенного качества. Марки', 'Ст0–Ст6, варианты спокойная/полуспокойная/кипящая'),
('ГОСТ 1050-2013', 'Прокат из качественной конструкционной углеродистой стали', '08–70, качественные конструкционные стали'),
('ГОСТ 4543-2016', 'Стали конструкционные легированные и высоколегированные. Марки', 'Легированные и высоколегированные конструкционные стали'),
('ГОСТ 5632-2014', 'Стали и сплавы коррозионно-стойкие, жаростойкие и жаропрочные', 'Нержавеющие и жаропрочные стали/сплавы'),
('ГОСТ 19281-2014', 'Прокат из низколегированной стали повышенной прочности', 'Низколегированные стали: 09Г2С, 10Г2С1, 17Г1С и др.'),
('ГОСТ 977-88', 'Чугуны литейные', 'Серые, высокопрочные и др. чугуны (для полноты справочника)'),
('ГОСТ 17379-2001', 'Латуни. Марки', 'Деформируемые латуни, базовые обозначения'),
('ГОСТ 18175-78', 'Бронзы безоловянные, обрабатываемые давлением', 'Марки безоловянных бронз'),
('ГОСТ 5017-2006', 'Бронзы оловянные, обрабатываемые давлением', 'Марки оловянных бронз')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2) Марки стали/сплавов (существенно расширенный список)
-- Углеродистые обыкновенного качества (ГОСТ 380-2005)
INSERT INTO steel_grade (name) VALUES
('Ст0'),('Ст1'),('Ст2'),('Ст3'),('Ст4'),('Ст5'),('Ст6'),
('Ст3сп'),('Ст3пс'),('Ст3кп')
ON CONFLICT (name) DO NOTHING;

-- Качественные конструкционные углеродистые (ГОСТ 1050-2013)
INSERT INTO steel_grade (name) VALUES
('08'),('10'),('15'),('20'),('25'),('30'),('35'),('40'),('45'),('50'),('55'),('60'),('65'),('70')
ON CONFLICT (name) DO NOTHING;

-- Конструкционные легированные (ГОСТ 4543-2016)
INSERT INTO steel_grade (name) VALUES
('20Х'),('30Х'),('40Х'),('38ХС'),('30ХГСА'),('12ХН3А'),('20ХН3А'),('40ХН'),('18ХГТ'),('20ХГТ'),('20Х2Н4А'),('12Х2Н4А'),('40ХФА'),('18Х2Н4ВА')
ON CONFLICT (name) DO NOTHING;

-- Нержавеющие/жаропрочные (ГОСТ 5632-2014)
INSERT INTO steel_grade (name) VALUES
('08Х18Н10'),('12Х18Н10Т'),('10Х17Н13М2Т'),('08Х17Т'),('15Х25Т'),('20Х23Н18'),('03Х17Н14М3'),('10Х17Н13М2'),('12Х17'),('08Х18Н12Б'),('15Х28'),('40Х13'),('95Х18')
ON CONFLICT (name) DO NOTHING;

-- Низколегированные повышенной прочности (ГОСТ 19281-2014)
INSERT INTO steel_grade (name) VALUES
('09Г2С'),('10Г2С1'),('15ХСНД'),('10ХСНД'),('14ХГСНД'),('16ГС'),('17Г1С'),('15Г2СФ'),('17ГС')
ON CONFLICT (name) DO NOTHING;

-- Цветные сплавы (для полноты справочника)
INSERT INTO steel_grade (name) VALUES
('Л63'),('Л68'),('М1'),('М2'),('АД31'),('АМг5'),('БрАЖ9-4'),('БрОЦС4-4-2,5')
ON CONFLICT (name) DO NOTHING;

-- 3) Связи ГОСТ ↔ Марки
-- ГОСТ 380-2005
INSERT INTO gost_grade (gost_id, grade_id)
SELECT g.id, s.id FROM gost g JOIN steel_grade s ON s.name IN ('Ст0','Ст1','Ст2','Ст3','Ст4','Ст5','Ст6','Ст3сп','Ст3пс','Ст3кп') WHERE g.code = 'ГОСТ 380-2005'
ON CONFLICT DO NOTHING;

-- ГОСТ 1050-2013
INSERT INTO gost_grade (gost_id, grade_id)
SELECT g.id, s.id FROM gost g JOIN steel_grade s ON s.name IN ('08','10','15','20','25','30','35','40','45','50','55','60','65','70') WHERE g.code = 'ГОСТ 1050-2013'
ON CONFLICT DO NOTHING;

-- ГОСТ 4543-2016
INSERT INTO gost_grade (gost_id, grade_id)
SELECT g.id, s.id FROM gost g JOIN steel_grade s ON s.name IN ('20Х','30Х','40Х','38ХС','30ХГСА','12ХН3А','20ХН3А','40ХН','18ХГТ','20ХГТ','20Х2Н4А','12Х2Н4А','40ХФА','18Х2Н4ВА') WHERE g.code = 'ГОСТ 4543-2016'
ON CONFLICT DO NOTHING;

-- ГОСТ 5632-2014
INSERT INTO gost_grade (gost_id, grade_id)
SELECT g.id, s.id FROM gost g JOIN steel_grade s ON s.name IN ('08Х18Н10','12Х18Н10Т','10Х17Н13М2Т','08Х17Т','15Х25Т','20Х23Н18','03Х17Н14М3','10Х17Н13М2','12Х17','08Х18Н12Б','15Х28','40Х13','95Х18') WHERE g.code = 'ГОСТ 5632-2014'
ON CONFLICT DO NOTHING;

-- ГОСТ 19281-2014
INSERT INTO gost_grade (gost_id, grade_id)
SELECT g.id, s.id FROM gost g JOIN steel_grade s ON s.name IN ('09Г2С','10Г2С1','15ХСНД','10ХСНД','14ХГСНД','16ГС','17Г1С','15Г2СФ','17ГС') WHERE g.code = 'ГОСТ 19281-2014'
ON CONFLICT DO NOTHING;

-- 4) Готовим склад для привязки металлопозиций (если нет — создаём системный)
-- Создаём системный склад один раз (город: Екатеринбург, supplier: SYSTEM)
INSERT INTO warehouse (city, supplier)
SELECT 'Екатеринбург', 'SYSTEM'
WHERE NOT EXISTS (
    SELECT 1 FROM warehouse WHERE city = 'Екатеринбург' AND supplier = 'SYSTEM'
);

-- Получаем id системного склада
WITH sys_wh AS (
    SELECT id FROM warehouse WHERE city = 'Екатеринбург' AND supplier = 'SYSTEM' LIMIT 1
)
-- 5) Примеры наполнения таблицы metal базовыми номенклатурами по ключевым категориям
-- Вставляем только если аналогичных записей ещё нет (по ключу name+category+stamp+state_standard)
INSERT INTO metal (name, state_standard, category, stamp, diameter, thickness, width, length, material, price, unit, price_updated_at, comments, warehouse_id)
SELECT * FROM (
    VALUES
    -- Лист горячекатаный по ГОСТ 19903/19281 (используем 19281 как основной для марки)
    ('Лист горячекатаный', 'ГОСТ 19281-2014', 'листовой', '09Г2С', NULL, 8.0, 1500.0, 6000.0, 'Сталь', NULL, 'т', NOW(), 'Справочник', (SELECT id FROM sys_wh)),
    ('Лист горячекатаный', 'ГОСТ 1050-2013', 'листовой', '20', NULL, 5.0, 1250.0, 2500.0, 'Сталь', NULL, 'т', NOW(), 'Справочник', (SELECT id FROM sys_wh)),
    -- Арматура по ГОСТ 5781 / 52544 (здесь используем 5781)
    ('Арматура периодическая', 'ГОСТ 5781-82', 'сортовой', 'A500C', 12.0, NULL, NULL, NULL, 'Сталь', NULL, 'т', NOW(), 'Справочник', (SELECT id FROM sys_wh)),
    -- Труба стальная электросварная (марка по 380)
    ('Труба электросварная', 'ГОСТ 10704-91', 'трубный', 'Ст3сп', 57.0, 3.5, NULL, 6000.0, 'Сталь', NULL, 'т', NOW(), 'Справочник', (SELECT id FROM sys_wh)),
    -- Круг (прокат) конструкционный
    ('Круг горячекатаный', 'ГОСТ 1050-2013', 'сортовой', '45', 50.0, NULL, NULL, 6000.0, 'Сталь', NULL, 'т', NOW(), 'Справочник', (SELECT id FROM sys_wh)),
    -- Нержавейка лист
    ('Лист нержавеющий', 'ГОСТ 5632-2014', 'листовой', '12Х18Н10Т', NULL, 2.0, 1000.0, 2000.0, 'Нержавеющая сталь', NULL, 'т', NOW(), 'Справочник', (SELECT id FROM sys_wh))
 ) AS v(name, state_standard, category, stamp, diameter, thickness, width, length, material, price, unit, price_updated_at, comments, warehouse_id)
WHERE NOT EXISTS (
    SELECT 1 FROM metal m
    WHERE m.name = v.name AND COALESCE(m.state_standard,'') = COALESCE(v.state_standard,'')
      AND COALESCE(m.category,'') = COALESCE(v.category,'') AND COALESCE(m.stamp,'') = COALESCE(v.stamp,'')
);

-- Конец миграции


