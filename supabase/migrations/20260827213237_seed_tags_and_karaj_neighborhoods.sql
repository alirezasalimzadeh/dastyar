/*
# Seed Common Tags and Karaj Neighborhoods

1. Tags
- Common real-estate tags used across the CRM.

2. Karaj Neighborhoods
- Key neighborhoods for Karaj city.
*/

INSERT INTO tags (name, color) VALUES
('سرمایه‌گذار', 'green'),
('فوری', 'red'),
('تخلیه فوری', 'red'),
('مالک سخت‌گیر', 'orange'),
('مشتری جدی', 'green'),
('مناسب سرمایه‌گذاری', 'blue'),
('نقدینگی بالا', 'green'),
('تخفیف', 'purple'),
('تبدیل‌پذیر', 'blue'),
('داغ', 'red'),
('سرد', 'blue'),
('گرم', 'orange'),
('VIP', 'gold'),
('منطقه پررونق', 'green'),
('نوسازی', 'teal'),
('قابل بازسازی', 'orange')
ON CONFLICT DO NOTHING;

-- Karaj neighborhoods
INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'گوهردشت', 'gohardasht', '1', 35.8200, 50.9200
FROM cities c WHERE c.slug = 'karaj-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'محمدشهر', 'mohammadshahr', '2', 35.7800, 50.9500
FROM cities c WHERE c.slug = 'karaj-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'عظیمیه', 'azimiyeh', '3', 35.8400, 50.9800
FROM cities c WHERE c.slug = 'karaj-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'چهارمردان', 'chaharmardan', '4', 35.8100, 50.8900
FROM cities c WHERE c.slug = 'karaj-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'حصارک', 'hesarak', '5', 35.8500, 50.9400
FROM cities c WHERE c.slug = 'karaj-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'کمال‌آباد', 'kamalabad', '6', 35.8300, 50.8700
FROM cities c WHERE c.slug = 'karaj-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'شهرک باغ‌مینا', 'bagh-mina', '7', 35.7900, 50.9700
FROM cities c WHERE c.slug = 'karaj-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'جهانشهر', 'jahanshahr', '8', 35.8000, 50.9900
FROM cities c WHERE c.slug = 'karaj-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'مهرشهر', 'mehrshahr', '9', 35.7900, 50.8800
FROM cities c WHERE c.slug = 'karaj-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'فردیس', 'fardis-karaj', '10', 35.7400, 50.9800
FROM cities c WHERE c.slug = 'karaj-city'
ON CONFLICT DO NOTHING;
