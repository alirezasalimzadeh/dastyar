-- ============================================================
-- ساختار جغرافیایی جدید + فیلدهای خیابان و آدرس کامل
-- این اسکریپت idempotent است و می‌توان چند بار اجرا کرد.
-- ============================================================

-- ۱) ستون خیابان برای فایل‌ها (فقط محله رباط کریم استفاده می‌کند)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS street text;

-- ۲) آدرس کامل و شهرستان برای مشتری‌ها
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS county_id uuid REFERENCES counties(id) ON DELETE SET NULL;

-- ۳) شهرستان‌های جاافتاده استان تهران
INSERT INTO counties (province_id, name, slug, official_code)
SELECT p.id, v.name, v.slug, v.code
FROM provinces p
CROSS JOIN (VALUES
  ('اسلامشهر', 'eslamshahr', '0804'),
  ('گلستان', 'golestan-tehran', '0805'),
  ('قرچک', 'gharchak', '0806')
) AS v(name, slug, code)
WHERE p.slug = 'tehran'
  AND NOT EXISTS (SELECT 1 FROM counties c WHERE c.province_id = p.id AND c.name = v.name);

-- ۴) شهر انکر برای محله‌های شهرستان رباط کریم
INSERT INTO cities (province_id, county_id, name, slug, official_code)
SELECT p.id, c.id, 'رباط کریم', 'robat-karim-city', '080801'
FROM provinces p, counties c
WHERE p.slug = 'tehran' AND c.slug = 'robat-karim'
  AND NOT EXISTS (SELECT 1 FROM cities ci WHERE ci.county_id = c.id AND ci.name = 'رباط کریم');

-- ۵) محله‌های شهرستان رباط کریم
INSERT INTO neighborhoods (city_id, name, slug, active)
SELECT ci.id, v.name, v.slug, true
FROM cities ci
CROSS JOIN (VALUES
  ('رباط کریم', 'rk-robatkarim'),
  ('نصیرشهر', 'rk-nasirshahr'),
  ('پرند', 'rk-parand'),
  ('آبشناسان', 'rk-abshenasan'),
  ('پرندک', 'rk-parandak'),
  ('آلارد', 'rk-alard'),
  ('وهن آباد', 'rk-vahnabad'),
  ('حصارمهتر', 'rk-hesar-mehtar'),
  ('انجم آباد', 'rk-anjamabad'),
  ('شهرآباد', 'rk-shahrabad'),
  ('یقه', 'rk-yeqe'),
  ('منجیل آباد', 'rk-manjilabad'),
  ('امام زاده ابوطالب', 'rk-emamzadeh-abutaleb')
) AS v(name, slug)
WHERE ci.county_id = (SELECT id FROM counties WHERE slug = 'robat-karim')
  AND NOT EXISTS (SELECT 1 FROM neighborhoods n WHERE n.city_id = ci.id AND n.name = v.name);
