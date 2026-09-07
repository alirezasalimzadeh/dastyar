/*
# Seed Iran Counties and Cities - Batch 2: Major Provinces

Inserts counties and cities for remaining major provinces:
Isfahan, Fars, Khorasan Razavi, Khuzestan, East/West Azerbaijan, Gilan, Mazandaran, Kerman, Kermanshah, Golestan, Sistan-Baluchestan, Kurdistan, Lorestan, Hamadan, Yazd, Semnan, Chaharmahal, Kohgiluyeh, North/South Khorasan, Zanjan, Markazi, Ilam, Bushehr, Hormozgan, Ardabil.
*/

-- ISFAHAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'اصفهان', 'isfahan-county', '0401' FROM provinces WHERE slug = 'isfahan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'کاشان', 'kashan', '0402' FROM provinces WHERE slug = 'isfahan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'نجف‌آباد', 'najafabad', '0403' FROM provinces WHERE slug = 'isfahan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'خمینی‌شهر', 'khomeini-shahr', '0404' FROM provinces WHERE slug = 'isfahan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'شاهین‌شهر', 'shahin-shahr', '0405' FROM provinces WHERE slug = 'isfahan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'اصفهان', 'isfahan-city', '040101', 32.6540, 51.6680
FROM provinces p, counties c WHERE p.slug = 'isfahan' AND c.slug = 'isfahan-county'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'کاشان', 'kashan-city', '040201', 33.9850, 51.4100
FROM provinces p, counties c WHERE p.slug = 'isfahan' AND c.slug = 'kashan'
ON CONFLICT DO NOTHING;

-- FARS
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'شیراز', 'shiraz', '1701' FROM provinces WHERE slug = 'fars'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'مرودشت', 'marvdasht', '1702' FROM provinces WHERE slug = 'fars'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'کازرون', 'kazerun', '1703' FROM provinces WHERE slug = 'fars'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'جهرم', 'jahrom', '1704' FROM provinces WHERE slug = 'fars'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'فسا', 'fasa', '1705' FROM provinces WHERE slug = 'fars'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'شیراز', 'shiraz-city', '170101', 29.5900, 52.5800
FROM provinces p, counties c WHERE p.slug = 'fars' AND c.slug = 'shiraz'
ON CONFLICT DO NOTHING;

-- KHORASAN RAZAVI
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'مشهد', 'mashhad', '1101' FROM provinces WHERE slug = 'razavi-khorasan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'نیشابور', 'nishabur', '1102' FROM provinces WHERE slug = 'razavi-khorasan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'سبزوار', 'sabzevar', '1103' FROM provinces WHERE slug = 'razavi-khorasan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'تربت حیدریه', 'torbat-heydariyeh', '1104' FROM provinces WHERE slug = 'razavi-khorasan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'قوچان', 'quchan', '1105' FROM provinces WHERE slug = 'razavi-khorasan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'مشهد', 'mashhad-city', '110101', 36.2900, 59.6000
FROM provinces p, counties c WHERE p.slug = 'razavi-khorasan' AND c.slug = 'mashhad'
ON CONFLICT DO NOTHING;

-- KHUZESTAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'اهواز', 'ahvaz', '1301' FROM provinces WHERE slug = 'khuzestan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'آبادان', 'abadan', '1302' FROM provinces WHERE slug = 'khuzestan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'خرمشهر', 'khorramshahr', '1303' FROM provinces WHERE slug = 'khuzestan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'دزفول', 'dezful', '1304' FROM provinces WHERE slug = 'khuzestan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'اهواز', 'ahvaz-city', '130101', 31.3200, 48.6900
FROM provinces p, counties c WHERE p.slug = 'khuzestan' AND c.slug = 'ahvaz'
ON CONFLICT DO NOTHING;

-- EAST AZERBAIJAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'تبریز', 'tabriz', '0101' FROM provinces WHERE slug = 'east-azarbaijan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'مراغه', 'maragheh', '0102' FROM provinces WHERE slug = 'east-azarbaijan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'میانه', 'mianeh', '0103' FROM provinces WHERE slug = 'east-azarbaijan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'تبریز', 'tabriz-city', '010101', 38.0800, 46.2920
FROM provinces p, counties c WHERE p.slug = 'east-azarbaijan' AND c.slug = 'tabriz'
ON CONFLICT DO NOTHING;

-- WEST AZERBAIJAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'ارومیه', 'urmia', '0201' FROM provinces WHERE slug = 'west-azarbaijan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'خوی', 'khoy', '0202' FROM provinces WHERE slug = 'west-azarbaijan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'ماکو', 'maku', '0203' FROM provinces WHERE slug = 'west-azarbaijan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'ارومیه', 'urmia-city', '020101', 37.5500, 45.0750
FROM provinces p, counties c WHERE p.slug = 'west-azarbaijan' AND c.slug = 'urmia'
ON CONFLICT DO NOTHING;

-- GILAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'رشت', 'rasht', '2501' FROM provinces WHERE slug = 'gilan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'بندر انزلی', 'bandar-anzali', '2502' FROM provinces WHERE slug = 'gilan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'لاهیجان', 'lahijan', '2503' FROM provinces WHERE slug = 'gilan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'رشت', 'rasht-city', '250101', 37.2800, 49.5900
FROM provinces p, counties c WHERE p.slug = 'gilan' AND c.slug = 'rasht'
ON CONFLICT DO NOTHING;

-- MAZANDARAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'ساری', 'sari', '2701' FROM provinces WHERE slug = 'mazandaran'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'بابل', 'babol', '2702' FROM provinces WHERE slug = 'mazandaran'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'آمل', 'amol', '2703' FROM provinces WHERE slug = 'mazandaran'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'نوشهر', 'nowshahr', '2704' FROM provinces WHERE slug = 'mazandaran'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'ساری', 'sari-city', '270101', 36.3300, 52.9500
FROM provinces p, counties c WHERE p.slug = 'mazandaran' AND c.slug = 'sari'
ON CONFLICT DO NOTHING;

-- KERMAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'کرمان', 'kerman-county', '2101' FROM provinces WHERE slug = 'kerman'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'سیرجان', 'sirjan', '2102' FROM provinces WHERE slug = 'kerman'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'رفسنجان', 'rafsanjan', '2103' FROM provinces WHERE slug = 'kerman'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'کرمان', 'kerman-city', '210101', 30.2800, 57.0800
FROM provinces p, counties c WHERE p.slug = 'kerman' AND c.slug = 'kerman-county'
ON CONFLICT DO NOTHING;

-- KERMANSHAH
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'کرمانشاه', 'kermanshah-county', '2201' FROM provinces WHERE slug = 'kermanshah'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'سنندج', 'sanandaj', '2202' FROM provinces WHERE slug = 'kermanshah'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'کرمانشاه', 'kermanshah-city', '220101', 34.3200, 47.0700
FROM provinces p, counties c WHERE p.slug = 'kermanshah' AND c.slug = 'kermanshah-county'
ON CONFLICT DO NOTHING;

-- GOLESTAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'گرگان', 'gorgan', '2401' FROM provinces WHERE slug = 'golestan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'گنبد کاووس', 'gonbad-kavus', '2402' FROM provinces WHERE slug = 'golestan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'گرگان', 'gorgan-city', '240101', 36.8300, 54.4400
FROM provinces p, counties c WHERE p.slug = 'golestan' AND c.slug = 'gorgan'
ON CONFLICT DO NOTHING;

-- SISTAN-BALUCHESTAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'زاهدان', 'zahedan', '1601' FROM provinces WHERE slug = 'sistan-baluchestan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'زابل', 'zabol', '1602' FROM provinces WHERE slug = 'sistan-baluchestan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'زاهدان', 'zahedan-city', '160101', 27.0300, 60.6300
FROM provinces p, counties c WHERE p.slug = 'sistan-baluchestan' AND c.slug = 'zahedan'
ON CONFLICT DO NOTHING;

-- KURDISTAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'سنندج', 'sanandaj-county', '2001' FROM provinces WHERE slug = 'kurdistan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'سقز', 'saqqez', '2002' FROM provinces WHERE slug = 'kurdistan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'مریوان', 'marivan', '2003' FROM provinces WHERE slug = 'kurdistan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'سنندج', 'sanandaj-city', '200101', 35.3200, 47.0000
FROM provinces p, counties c WHERE p.slug = 'kurdistan' AND c.slug = 'sanandaj-county'
ON CONFLICT DO NOTHING;

-- LORESTAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'خرم‌آباد', 'khorramabad', '2601' FROM provinces WHERE slug = 'lorestan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'بروجرد', 'borujerd', '2602' FROM provinces WHERE slug = 'lorestan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'خرم‌آباد', 'khorramabad-city', '260101', 33.5100, 48.3800
FROM provinces p, counties c WHERE p.slug = 'lorestan' AND c.slug = 'khorramabad'
ON CONFLICT DO NOTHING;

-- HAMADAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'همدان', 'hamadan-county', '3001' FROM provinces WHERE slug = 'hamadan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'ملایر', 'malayer', '3002' FROM provinces WHERE slug = 'hamadan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'همدان', 'hamadan-city', '300101', 34.8000, 48.5200
FROM provinces p, counties c WHERE p.slug = 'hamadan' AND c.slug = 'hamadan-county'
ON CONFLICT DO NOTHING;

-- YAZD
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'یزد', 'yazd-county', '3101' FROM provinces WHERE slug = 'yazd'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'یزد', 'yazd-city', '310101', 31.9000, 54.3600
FROM provinces p, counties c WHERE p.slug = 'yazd' AND c.slug = 'yazd-county'
ON CONFLICT DO NOTHING;

-- SEMNAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'سمنان', 'semnan-county', '1501' FROM provinces WHERE slug = 'semnan'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'شاهرود', 'shahroud', '1502' FROM provinces WHERE slug = 'semnan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'سمنان', 'semnan-city', '150101', 35.5700, 53.3900
FROM provinces p, counties c WHERE p.slug = 'semnan' AND c.slug = 'semnan-county'
ON CONFLICT DO NOTHING;

-- CHAHARMAHAL-BAKHTIARI
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'شهرکرد', 'shahrekord', '0901' FROM provinces WHERE slug = 'chaharmahal-bakhtiari'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'شهرکرد', 'shahrekord-city', '090101', 31.9700, 50.8500
FROM provinces p, counties c WHERE p.slug = 'chaharmahal-bakhtiari' AND c.slug = 'shahrekord'
ON CONFLICT DO NOTHING;

-- KOHGILUYEH
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'یاسوج', 'yasuj', '2301' FROM provinces WHERE slug = 'kohgiluyeh-boyer-ahmad'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'یاسوج', 'yasuj-city', '230101', 30.6600, 51.6100
FROM provinces p, counties c WHERE p.slug = 'kohgiluyeh-boyer-ahmad' AND c.slug = 'yasuj'
ON CONFLICT DO NOTHING;

-- NORTH KHORASAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'بجنورد', 'bojnurd', '1201' FROM provinces WHERE slug = 'north-khorasan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'بجنورد', 'bojnurd-city', '120101', 37.4700, 58.1300
FROM provinces p, counties c WHERE p.slug = 'north-khorasan' AND c.slug = 'bojnurd'
ON CONFLICT DO NOTHING;

-- SOUTH KHORASAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'بیرجند', 'birjand', '1001' FROM provinces WHERE slug = 'south-khorasan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'بیرجند', 'birjand-city', '100101', 32.8600, 59.2100
FROM provinces p, counties c WHERE p.slug = 'south-khorasan' AND c.slug = 'birjand'
ON CONFLICT DO NOTHING;

-- ZANJAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'زنجان', 'zanjan-county', '1401' FROM provinces WHERE slug = 'zanjan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'زنجان', 'zanjan-city', '140101', 36.6700, 48.4800
FROM provinces p, counties c WHERE p.slug = 'zanjan' AND c.slug = 'zanjan-county'
ON CONFLICT DO NOTHING;

-- MARKAZI
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'اراک', 'arak', '2801' FROM provinces WHERE slug = 'markazi'
ON CONFLICT DO NOTHING;
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'ساوه', 'saveh', '2802' FROM provinces WHERE slug = 'markazi'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'اراک', 'arak-city', '280101', 34.0900, 49.7700
FROM provinces p, counties c WHERE p.slug = 'markazi' AND c.slug = 'arak'
ON CONFLICT DO NOTHING;

-- ILAM
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'ایلام', 'ilam-county', '0601' FROM provinces WHERE slug = 'ilam'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'ایلام', 'ilam-city', '060101', 33.6400, 46.4200
FROM provinces p, counties c WHERE p.slug = 'ilam' AND c.slug = 'ilam-county'
ON CONFLICT DO NOTHING;

-- BUSHEHR
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'بوشهر', 'bushehr-county', '0701' FROM provinces WHERE slug = 'bushehr'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'بوشهر', 'bushehr-city', '070101', 28.9700, 50.8400
FROM provinces p, counties c WHERE p.slug = 'bushehr' AND c.slug = 'bushehr-county'
ON CONFLICT DO NOTHING;

-- HORMOZGAN
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'بندرعباس', 'bandar-abbas', '2901' FROM provinces WHERE slug = 'hormozgan'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'بندرعباس', 'bandar-abbas-city', '290101', 27.1900, 56.2700
FROM provinces p, counties c WHERE p.slug = 'hormozgan' AND c.slug = 'bandar-abbas'
ON CONFLICT DO NOTHING;

-- ARDABIL
INSERT INTO counties (province_id, name, slug, official_code)
SELECT id, 'اردبیل', 'ardabil-county', '0301' FROM provinces WHERE slug = 'ardabil'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'اردبیل', 'ardabil-city', '030101', 38.2400, 48.2700
FROM provinces p, counties c WHERE p.slug = 'ardabil' AND c.slug = 'ardabil-county'
ON CONFLICT DO NOTHING;

-- Additional cities in Tehran province
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'رباط کریم', 'robat-karim-city', '080801', 35.4800, 51.0800
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'robat-karim'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'ورامین', 'varamin-city', '080901', 35.3200, 51.6400
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'varamin'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'شهریار', 'shahriar-city', '080701', 35.6600, 50.9600
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'shahriar'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'پیشوا', 'pishva-city', '081001', 35.0300, 51.7300
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'pishva'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'پاکدشت', 'pakdasht-city', '081101', 35.4700, 51.6800
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'pakdasht'
ON CONFLICT DO NOTHING;

-- Additional Alborz cities
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'نظرآباد', 'nazaraabad-city', '050201', 35.9500, 50.5600
FROM provinces p, counties c WHERE p.slug = 'alborz' AND c.slug = 'nazaraabad'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'هشتگرد', 'hashtgerd', '050301', 35.8900, 50.6800
FROM provinces p, counties c WHERE p.slug = 'alborz' AND c.slug = 'savojbolagh'
ON CONFLICT DO NOTHING;

-- New towns near Tehran
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'پردیس', 'pardis-city', '080102', 35.7500, 51.6700
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'tehran'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'بومهن', 'bumehen', '080103', 35.7400, 51.5800
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'tehran'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'لواسان', 'lavasan', '080104', 35.8300, 51.5800
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'tehran'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'اندیشه', 'andisheh', '080702', 35.6800, 50.8900
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'shahriar'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'ملارد', 'malard', '080703', 35.6700, 50.8400
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'shahriar'
ON CONFLICT DO NOTHING;
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'قرچک', 'qarchak', '080902', 35.4300, 51.5800
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'varamin'
ON CONFLICT DO NOTHING;

-- Parand city (near Tehran/Alborz)
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'پرند', 'parand', '080705', 35.5300, 50.9600
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'shahriar'
ON CONFLICT DO NOTHING;

-- Islamshahr
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'اسلامشهر', 'islamshahr', '080704', 35.5500, 51.2300
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'shahriar'
ON CONFLICT DO NOTHING;

-- Nasimshahr
INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, 'نسیم‌شهر', 'nasimshahr', '080706', 35.5200, 51.1700
FROM provinces p, counties c WHERE p.slug = 'tehran' AND c.slug = 'shahriar'
ON CONFLICT DO NOTHING;
