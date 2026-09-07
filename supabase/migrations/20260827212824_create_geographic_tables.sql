/*
# Create Geographic Database Tables

1. New Tables
- `provinces` — Iran's 31 provinces with official codes and coordinates.
- `counties` — Counties (شهرستان) within each province.
- `districts` — Districts (بخش) within each county.
- `cities` — Cities (شهر) linked to province, county, and district.
- `neighborhoods` — Neighborhoods (محله) within each city.

2. Relationships
- counties.province_id → provinces.id
- districts.county_id → counties.id
- cities.province_id → provinces.id, cities.county_id → counties.id, cities.district_id → districts.id
- neighborhoods.city_id → cities.id

3. Security
- Enable RLS on all tables.
- Public read access (anon + authenticated) since geographic data is shared reference data.
- Only authenticated users can modify (for admin management).

4. Notes
- All tables have `active` boolean for activation/deactivation.
- Slug fields for URL-friendly identifiers.
- Latitude/longitude stored for future map integration.
- Official codes match Iran's standard administrative division codes.
*/

CREATE TABLE IF NOT EXISTS provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  official_code text,
  latitude double precision,
  longitude double precision,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE provinces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_provinces" ON provinces;
CREATE POLICY "public_read_provinces" ON provinces FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_provinces" ON provinces;
CREATE POLICY "auth_insert_provinces" ON provinces FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_provinces" ON provinces;
CREATE POLICY "auth_update_provinces" ON provinces FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_provinces" ON provinces;
CREATE POLICY "auth_delete_provinces" ON provinces FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS counties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  official_code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE counties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_counties" ON counties;
CREATE POLICY "public_read_counties" ON counties FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_counties" ON counties;
CREATE POLICY "auth_insert_counties" ON counties FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_counties" ON counties;
CREATE POLICY "auth_update_counties" ON counties FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_counties" ON counties;
CREATE POLICY "auth_delete_counties" ON counties FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  county_id uuid NOT NULL REFERENCES counties(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  official_code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE districts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_districts" ON districts;
CREATE POLICY "public_read_districts" ON districts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_districts" ON districts;
CREATE POLICY "auth_insert_districts" ON districts FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_districts" ON districts;
CREATE POLICY "auth_update_districts" ON districts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_districts" ON districts;
CREATE POLICY "auth_delete_districts" ON districts FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  county_id uuid NOT NULL REFERENCES counties(id) ON DELETE CASCADE,
  district_id uuid REFERENCES districts(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text,
  official_code text,
  latitude double precision,
  longitude double precision,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_cities" ON cities;
CREATE POLICY "public_read_cities" ON cities FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_cities" ON cities;
CREATE POLICY "auth_insert_cities" ON cities FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_cities" ON cities;
CREATE POLICY "auth_update_cities" ON cities FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_cities" ON cities;
CREATE POLICY "auth_delete_cities" ON cities FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  municipality_zone text,
  latitude double precision,
  longitude double precision,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE neighborhoods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_neighborhoods" ON neighborhoods;
CREATE POLICY "public_read_neighborhoods" ON neighborhoods FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_neighborhoods" ON neighborhoods;
CREATE POLICY "auth_insert_neighborhoods" ON neighborhoods FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_neighborhoods" ON neighborhoods;
CREATE POLICY "auth_update_neighborhoods" ON neighborhoods FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_neighborhoods" ON neighborhoods;
CREATE POLICY "auth_delete_neighborhoods" ON neighborhoods FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_counties_province ON counties(province_id);
CREATE INDEX IF NOT EXISTS idx_districts_county ON districts(county_id);
CREATE INDEX IF NOT EXISTS idx_cities_province ON cities(province_id);
CREATE INDEX IF NOT EXISTS idx_cities_county ON cities(county_id);
CREATE INDEX IF NOT EXISTS idx_cities_district ON cities(district_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_city ON neighborhoods(city_id);
