/*
# Seed Tehran Neighborhoods

Inserts key neighborhoods for Tehran city with municipality zones.
*/

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'ولنجک', 'valenjak', '1', 35.7770, 51.3750
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'تجریش', 'tajrish', '1', 35.8040, 51.4330
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'نیاوران', 'niavaran', '1', 35.8180, 51.4650
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'درکه', 'darakeh', '1', 35.7640, 51.3600
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'فرشته', 'fereshteh', '1', 35.8100, 51.4500
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'قلهک', 'qolhak', '1', 35.7560, 51.4560
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'ظفر', 'zafar', '2', 35.7400, 51.4300
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'میرداماد', 'mirdamad', '2', 35.7430, 51.4180
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'الهیه', 'elahiye', '2', 35.7470, 51.4300
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'ونک', 'vanak', '2', 35.7260, 51.4100
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'فرشته', 'fereshteh-2', '3', 35.8050, 51.4480
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'پاسداران', 'pasdaran', '3', 35.7750, 51.4800
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'دزاشیب', 'dezashib', '3', 35.8060, 51.4400
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'دولت', 'dolat', '3', 35.7450, 51.4450
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'قیطریه', 'qeytariyeh', '3', 35.7830, 51.4450
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'کامرانیه', 'kamaraniyeh', '3', 35.7700, 51.4700
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'شیان', 'shian', '3', 35.7900, 51.4600
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'اختیاریه', 'ekhtiyariyeh', '3', 35.7700, 51.4600
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'اردیبهشت', 'ordibehesht', '4', 35.7250, 51.3800
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'سعادت‌آباد', 'saadat-abad', '2', 35.7700, 51.3700
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'پونک', 'punak', '2', 35.7450, 51.3200
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'تهرانپارس', 'tehranpars', '4', 35.7300, 51.4800
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'تهران‌نو', 'tehran-no', '4', 35.6900, 51.4900
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'نارمک', 'narmak', '4', 35.7300, 51.4100
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'سبلان', 'sablan', '4', 35.7100, 51.4300
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'شهرآرا', 'shahrara', '4', 35.7000, 51.4200
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'فرجام', 'farjam', '4', 35.7200, 51.4900
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'هفت‌حوض', 'haft-houz', '4', 35.7100, 51.4600
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'جردن', 'jordan', '3', 35.7370, 51.4220
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'آفریقا', 'africa', '3', 35.7380, 51.4250
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'نخجوان', 'nakhjavan', '5', 35.7000, 51.4200
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'بهار', 'bahar', '5', 35.6900, 51.3900
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'آزادی', 'azadi', '5', 35.6900, 51.3800
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'شیخ فضل‌الله', 'sheikh-fazlollah', '5', 35.6900, 51.3700
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'میدان انقلاب', 'enghelab-square', '6', 35.7000, 51.3900
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'امیریه', 'amiriyeh', '6', 35.7100, 51.4000
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'بهارستان', 'baharestan', '6', 35.6900, 51.4100
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'مجیدیه', 'majidiyeh', '7', 35.6900, 51.4600
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'نواب', 'navab', '7', 35.6600, 51.3900
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'شوش', 'shush', '7', 35.6500, 51.4000
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'خانی‌آباد', 'khaniabad', '7', 35.6600, 51.3700
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'یافت‌آباد', 'yaftabad', '8', 35.6600, 51.3500
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'آزادگان', 'azadegan', '8', 35.6500, 51.3500
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'مشیریه', 'moshiriyeh', '8', 35.6400, 51.3700
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'شهرک غرب', 'shahrak-gharb', '2', 35.7600, 51.3700
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'گیشا', 'gisha', '2', 35.7300, 51.3700
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'آپادانا', 'apadana', '2', 35.7250, 51.3500
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'شادآباد', 'shadabad', '9', 35.6900, 51.3100
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'شهرایمان', 'shahr-e-eman', '9', 35.6800, 51.3200
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'پارشین', 'parshin', '9', 35.6700, 51.3300
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'جی', 'ji', '10', 35.6400, 51.4400
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'داودیه', 'davoodiyeh', '10', 35.6700, 51.4500
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'نازی‌آباد', 'naziabad', '10', 35.6600, 51.4100
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'منیریه', 'moniriyeh', '11', 35.6700, 51.4000
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'خزانه', 'khazaneh', '11', 35.6400, 51.4200
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'پیروزی', 'pirozi', '12', 35.6600, 51.4600
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'نظام‌آباد', 'nezamabad', '12', 35.6700, 51.4500
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'احمدآباد', 'ahmadabad', '12', 35.6500, 51.4700
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'شریف‌آباد', 'sharifabad', '13', 35.6300, 51.4700
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'افسریه', 'afsariyeh', '13', 35.6200, 51.4800
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'جوادیه', 'javadiyeh', '13', 35.6400, 51.4300
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'خاوران', 'khavaran', '14', 35.6100, 51.4900
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'شهرک نصر', 'shahrak-nasr', '4', 35.7400, 51.4800
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'گلستان', 'golestan-tehran', '15', 35.5900, 51.3900
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'شهرک معلم', 'shahrak-moallem', '5', 35.7100, 51.3600
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'شهرک دانشگاه', 'shahrak-daneshgah', '2', 35.7450, 51.3600
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'آجرک', 'ajarak', '9', 35.6800, 51.3300
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'شهرک قائم', 'shahrak-ghaem', '4', 35.7300, 51.5000
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'هروی', 'heravi', '4', 35.7500, 51.4900
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'دربند', 'darband', '1', 35.8240, 51.4240
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'جمهوری', 'jomhuri', '7', 35.7000, 51.3800
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'لاله‌زار', 'lalehzar', '7', 35.7100, 51.4100
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'فردوسی', 'ferdowsi', '7', 35.7100, 51.4000
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'پامنار', 'pamnar', '7', 35.7100, 51.3900
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'سنایی', 'sanayi', '7', 35.7000, 51.3700
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'آذربایجان', 'azarbaijan', '7', 35.6900, 51.3600
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'امیربهادر', 'amir-bahador', '6', 35.7100, 51.3800
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'کشاورز', 'keshavarz', '6', 35.7100, 51.3800
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'آرژانتین', 'argentina', '6', 35.7300, 51.3900
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'توحید', 'tohid', '6', 35.7100, 51.3700
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'ستارخان', 'sattarkhan', '6', 35.7100, 51.3700
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;

INSERT INTO neighborhoods (city_id, name, slug, municipality_zone, latitude, longitude)
SELECT c.id, 'فردیس', 'fardis', '6', 35.7400, 50.9800
FROM cities c WHERE c.slug = 'tehran-city'
ON CONFLICT DO NOTHING;
