/*
# Seed Iran Counties and Cities - Batch 1: Tehran, Alborz, Qom, Qazvin

Inserts counties and cities for Tehran, Alborz, Qom, and Qazvin provinces.
*/

-- TEHRAN PROVINCE
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'تهران', 'tehran', '0801' FROM provinces WHERE slug = 'tehran'
ON CONFLICT DO NOTHING;

INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'رباط کریم', 'robat-karim', '0808' FROM provinces WHERE slug = 'tehran'
ON CONFLICT DO NOTHING;

INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'ورامین', 'varamin', '0809' FROM provinces WHERE slug = 'tehran'
ON CONFLICT DO NOTHING;

INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'شهریار', 'shahriar', '0807' FROM provinces WHERE slug = 'tehran'
ON CONFLICT DO NOTHING;

INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'پیشوا', 'pishva', '0810' FROM provinces WHERE slug = 'tehran'
ON CONFLICT DO NOTHING;

INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'پاکدشت', 'pakdasht', '0811' FROM provinces WHERE slug = 'tehran'
ON CONFLICT DO NOTHING;

INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'تهران', 'tehran-city', '080101', 35.6890, 51.3890
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'tehran'
ON CONFLICT DO NOTHING;

-- ALBORZ PROVINCE
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'کرج', 'karaj', '0501' FROM provinces WHERE slug = 'alborz'
ON CONFLICT DO NOTHING;

INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'نظرآباد', 'nazaraabad', '0502' FROM provinces WHERE slug = 'alborz'
ON CONFLICT DO NOTHING;

INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'ساوجبلاغ', 'savojbolagh', '0503' FROM provinces WHERE slug = 'alborz'
ON CONFLICT DO NOTHING;

INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'طالقان', 'taleqan', '0504' FROM provinces WHERE slug = 'alborz'
ON CONFLICT DO NOTHING;

INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'کرج', 'karaj-city', '050101', 35.8400, 50.9200
FROM provinces p, counties c WHERE p.slug = 'alborz' AND c.slug = 'karaj'
ON CONFLICT DO NOTHING;

INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'ماهدشت', 'mahdasht', '050102', 35.7800, 50.8500
FROM provinces p, counties c WHERE p.slug = 'alborz' AND c.slug = 'karaj'
ON CONFLICT DO NOTHING;

INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'اشتهارد', 'eshtehard', '050103', 35.7200, 50.3500
FROM provinces p, counties c WHERE p.slug = 'alborz' AND c.slug = 'karaj'
ON CONFLICT DO NOTHING;

-- QOM PROVINCE
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'قم', 'qom-county', '1901' FROM provinces WHERE slug = 'qom'
ON CONFLICT DO NOTHING;

INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'قم', 'qom-city', '190101', 34.6400, 50.8800
FROM provinces p, counties c WHERE p.slug = 'qom' AND c.slug = 'qom-county'
ON CONFLICT DO NOTHING;

-- QAZVIN PROVINCE
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'قزوین', 'qazvin-county', '1801' FROM provinces WHERE slug = 'qazvin'
ON CONFLICT DO NOTHING;

INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'تاکستان', 'takestan', '1802' FROM provinces WHERE slug = 'qazvin'
ON CONFLICT DO NOTHING;

INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'آبیک', 'abeyek', '1803' FROM provinces WHERE slug = 'qazvin'
ON CONFLICT DO NOTHING;

INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'بوئین‌زهرا', 'buin-zahra', '1804' FROM provinces WHERE slug = 'qazvin'
ON CONFLICT DO NOTHING;

INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'قزوین', 'qazvin-city', '180101', 36.2700, 50.0000
FROM provinces p, counties c WHERE p.slug = 'qazvin' AND c.slug = 'qazvin-county'
ON CONFLICT DO NOTHING;

INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'تاکستان', 'takestan-city', '180201', 36.0700, 49.7000
FROM provinces p, counties c WHERE p.slug = 'qazvin' AND c.slug = 'takestan'
ON CONFLICT DO NOTHING;
