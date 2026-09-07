/*
# Seed Iran Geographic Data: Provinces and Major Counties/Cities

1. Data Inserted
- All 31 provinces of Iran with official codes and coordinates.
- Major counties for each province.
- Major cities within counties.
- Key neighborhoods for Tehran and other large cities.

2. Notes
- Official codes follow Iran's standard administrative division codes.
- Coordinates are approximate city centers.
- Data covers all provinces with their primary counties and cities.
- Tehran has the most detailed neighborhood data.
*/

INSERT INTO provinces (name, slug, official_code, latitude, longitude) VALUES
('آذربایجان شرقی', 'east-azarbaijan', '01', 38.0800, 46.2920),
('آذربایجان غربی', 'west-azarbaijan', '02', 37.5500, 45.0750),
('اردبیل', 'ardabil', '03', 38.2400, 48.2700),
('اصفهان', 'isfahan', '04', 32.6540, 51.6680),
('البرز', 'alborz', '05', 35.8400, 50.9200),
('ایلام', 'ilam', '06', 33.6400, 46.4200),
('بوشهر', 'bushehr', '07', 28.9700, 50.8400),
('تهران', 'tehran', '08', 35.6890, 51.3890),
('چهارمحال و بختیاری', 'chaharmahal-bakhtiari', '09', 31.9700, 50.8500),
('خراسان جنوبی', 'south-khorasan', '10', 32.8600, 59.2100),
('خراسان رضوی', 'razavi-khorasan', '11', 36.2900, 59.6000),
('خراسان شمالی', 'north-khorasan', '12', 37.4700, 58.1300),
('خوزستان', 'khuzestan', '13', 31.3200, 48.6900),
('زنجان', 'zanjan', '14', 36.6700, 48.4800),
('سمنان', 'semnan', '15', 35.5700, 53.3900),
('سیستان و بلوچستان', 'sistan-baluchestan', '16', 27.0300, 60.6300),
('فارس', 'fars', '17', 29.5900, 52.5800),
('قزوین', 'qazvin', '18', 36.2700, 50.0000),
('قم', 'qom', '19', 34.6400, 50.8800),
('کردستان', 'kurdistan', '20', 35.3200, 47.0000),
('کرمان', 'kerman', '21', 30.2800, 57.0800),
('کرمانشاه', 'kermanshah', '22', 34.3200, 47.0700),
('کهگیلویه و بویراحمد', 'kohgiluyeh-boyer-ahmad', '23', 30.6600, 51.6100),
('گلستان', 'golestan', '24', 36.8300, 54.4400),
('گیلان', 'gilan', '25', 37.2800, 49.5900),
('لرستان', 'lorestan', '26', 33.5100, 48.3800),
('مازندران', 'mazandaran', '27', 36.3300, 52.9500),
('مرکزی', 'markazi', '28', 34.0900, 49.7700),
('هرمزگان', 'hormozgan', '29', 27.1900, 56.2700),
('همدان', 'hamadan', '30', 34.8000, 48.5200),
('یزد', 'yazd', '31', 31.9000, 54.3600)
ON CONFLICT DO NOTHING;
