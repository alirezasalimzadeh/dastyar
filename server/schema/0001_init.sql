-- ============================================================================
-- دستیار مشاور — اسکیمای تمیز چندکاربره (پستگرس)
-- اجرا می‌شود: اولین استارت کانتینر db (docker-entrypoint-initdb.d)
--
-- مدل امنیتی:
--   • هر حساب کاربری (GoTrue/auth.users) فقط داده‌های خودش را می‌بیند:
--     جدول‌های کارِ کاربری ستون user_id دارند و سیاست RLS «فقط ردیف‌های خود» است.
--   • داده‌های مرجع (استان/شهرستان/شهر/محله، املاک/شعب) برای همه مشترک‌اند.
--   • profiles: فهرست همکاران قابل خواندن برای همه حساب‌ها، ویرایش فقط پروفایل خود.
--   • tags: دیکشنری تگِ هر کاربر جداست (برای هر حساب جدید، ۱۶ تگ پیش‌فرض seed می‌شود
--     — توسط تریگر 0002_profile_trigger.sql).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ۱) نقش‌ها و تابع auth.uid()
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin LOGIN SUPERUSER PASSWORD 'change-me';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dastyar') THEN
    CREATE ROLE dastyar LOGIN; -- کاربر اتصال PostgREST (غیر-سوپریور تا RLS اعمال شود)
  END IF;
END
$$;

GRANT anon, authenticated TO dastyar; -- PostgREST در هر درخواست SET ROLE می‌کند

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, dastyar;

-- ---------------------------------------------------------------------------
-- ۲) جغرافیا (مشترک بین همه حساب‌ها)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- ۳) ساختار سازمانی (مشترک)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  phone text,
  address text,
  city text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  address text,
  city text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- ۴) پروفایل کاربر (یک ردیف برای هر auth.users)
--    خواندن: همهٔ حساب‌ها (فهرست همکاران) — ویرایش/درج: فقط پروفایل خود
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY ,
  first_name text,
  last_name text,
  avatar_url text,
  mobile text,
  email text,
  role text NOT NULL DEFAULT 'consultant' CHECK (role IN ('manager', 'office_manager', 'consultant', 'system_admin')),
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  city text,
  areas_of_activity text,
  years_of_experience integer,
  specialization text,
  personal_notes text,
  account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'inactive')),
  last_activity timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- ۵) جدول‌های کاری — هر کدام user_id دارند و RLS «فقط ردیف‌های خود»
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  phone text NOT NULL,
  secondary_phone text,
  notes text,
  tags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
  assigned_consultant_id uuid ,
  last_contact timestamptz,
  next_followup timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  first_name text NOT NULL,
  last_name text,
  name text,
  mobile text NOT NULL,
  secondary_phone text,
  customer_type text DEFAULT 'individual',
  transaction_intention text CHECK (transaction_intention IN ('buy', 'rent', 'partnership', 'sell')),
  transaction_role text,
  budget_min numeric,
  budget_max numeric,
  preferred_category text,
  preferred_property_types text[] DEFAULT '{}',
  preferred_province_ids uuid[] DEFAULT '{}',
  preferred_county_ids uuid[] DEFAULT '{}',
  preferred_city_ids uuid[] DEFAULT '{}',
  min_area numeric,
  max_area numeric,
  bedrooms integer,
  required_features text[] DEFAULT '{}',
  preferred_floor integer,
  parking_required boolean DEFAULT false,
  elevator_required boolean DEFAULT false,
  urgency text DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  temperature text DEFAULT 'warm' CHECK (temperature IN ('hot', 'warm', 'cold')),
  lead_source text,
  assigned_consultant_id uuid ,
  notes text,
  tags text[] DEFAULT '{}',
  last_contact timestamptz,
  next_followup timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'converted', 'lost')),
  address text,
  county_id uuid REFERENCES counties(id) ON DELETE SET NULL,
  property_preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  description text,
  transaction_type text NOT NULL CHECK (transaction_type IN ('buy', 'rent', 'partnership', 'sell')),
  transaction_role text,
  category text NOT NULL CHECK (category IN ('residential', 'industrial', 'commercial', 'agricultural', 'office')),
  property_type text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'rented', 'inactive', 'pending')),
  is_hot boolean DEFAULT false,
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  assigned_consultant_id uuid ,
  province_id uuid REFERENCES provinces(id) ON DELETE SET NULL,
  county_id uuid REFERENCES counties(id) ON DELETE SET NULL,
  district_id uuid REFERENCES districts(id) ON DELETE SET NULL,
  city_id uuid REFERENCES cities(id) ON DELETE SET NULL,
  neighborhood_id uuid REFERENCES neighborhoods(id) ON DELETE SET NULL,
  address text,
  street text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  land_area numeric,
  building_area numeric,
  rooms integer,
  bedrooms integer,
  floor integer,
  total_floors integer,
  unit_number text,
  building_age integer,
  parking boolean DEFAULT false,
  storage boolean DEFAULT false,
  elevator boolean DEFAULT false,
  balcony boolean DEFAULT false,
  yard boolean DEFAULT false,
  garden boolean DEFAULT false,
  pool boolean DEFAULT false,
  security boolean DEFAULT false,
  heating text,
  cooling text,
  sale_price numeric,
  deposit_price numeric,
  monthly_rent numeric,
  price_per_meter numeric,
  owner_requested_price numeric,
  participation_price numeric,
  negotiable boolean DEFAULT false,
  payment_conditions text,
  commission numeric,
  owner_notes text,
  owner_relationship text,
  owner_followup_status text,
  images text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS property_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('buy', 'rent', 'partnership', 'sell')),
  transaction_role text,
  category text NOT NULL CHECK (category IN ('residential', 'industrial', 'commercial', 'agricultural', 'office')),
  property_type text,
  province_id uuid REFERENCES provinces(id) ON DELETE SET NULL,
  county_id uuid REFERENCES counties(id) ON DELETE SET NULL,
  city_id uuid REFERENCES cities(id) ON DELETE SET NULL,
  neighborhood_id uuid REFERENCES neighborhoods(id) ON DELETE SET NULL,
  budget_min numeric,
  budget_max numeric,
  min_area numeric,
  max_area numeric,
  bedrooms integer,
  required_features text[] DEFAULT '{}',
  preferred_floor integer,
  parking_required boolean DEFAULT false,
  elevator_required boolean DEFAULT false,
  notes text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  consultant_id uuid ,
  call_date timestamptz NOT NULL DEFAULT now(),
  duration_minutes integer,
  direction text DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  result text CHECK (result IN ('answered', 'no_answer', 'interested', 'needs_review', 'introduced', 'viewing_scheduled', 'deal_done', 'disinterested', 'wrong_number', 'needs_followup')),
  notes text,
  next_action text,
  next_followup timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  entity_type text NOT NULL CHECK (entity_type IN ('customer', 'owner', 'property', 'deal')),
  entity_id uuid NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  reason text,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  due_date date NOT NULL,
  due_time time,
  assigned_consultant_id uuid ,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'missed', 'cancelled')),
  notes text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  consultant_id uuid ,
  transaction_type text NOT NULL CHECK (transaction_type IN ('buy', 'rent', 'partnership', 'sell')),
  deal_value numeric,
  commission numeric,
  status text NOT NULL DEFAULT 'negotiating' CHECK (status IN ('negotiating', 'agreement', 'contracted', 'completed', 'cancelled')),
  negotiation_status text,
  contract_date date,
  completion_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  description text,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  due_date date,
  due_time time,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_user_id uuid ,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  follow_up_id uuid REFERENCES follow_ups(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS property_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  factors jsonb DEFAULT '[]',
  differences jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE (property_id, customer_id)
);

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  type text NOT NULL,
  title text NOT NULL,
  message text,
  entity_type text,
  entity_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- ۶) تگ‌ها — دیکشنری جدا برای هر کاربر
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  color text DEFAULT 'blue',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS customer_tags (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, tag_id)
);

CREATE TABLE IF NOT EXISTS property_tags (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (property_id, tag_id)
);

CREATE TABLE IF NOT EXISTS customer_preferred_neighborhoods (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  neighborhood_id uuid NOT NULL REFERENCES neighborhoods(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, neighborhood_id)
);

CREATE TABLE IF NOT EXISTS customer_preferred_cities (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, city_id)
);

-- ---------------------------------------------------------------------------
-- ۷) ایندکس‌ها
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_counties_province ON counties(province_id);
CREATE INDEX IF NOT EXISTS idx_districts_county ON districts(county_id);
CREATE INDEX IF NOT EXISTS idx_cities_province ON cities(province_id);
CREATE INDEX IF NOT EXISTS idx_cities_county ON cities(county_id);
CREATE INDEX IF NOT EXISTS idx_cities_district ON cities(district_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_city ON neighborhoods(city_id);
CREATE INDEX IF NOT EXISTS idx_branches_agency ON branches(agency_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owners_user ON owners(user_id);
CREATE INDEX IF NOT EXISTS idx_owners_consultant ON owners(assigned_consultant_id);
CREATE INDEX IF NOT EXISTS idx_owners_phone ON owners(phone);
CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_consultant ON customers(assigned_consultant_id);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_temperature ON customers(temperature);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_next_followup ON customers(next_followup);
CREATE INDEX IF NOT EXISTS idx_customers_property_prefs ON customers USING gin(property_preferences);
CREATE INDEX IF NOT EXISTS idx_properties_user ON properties(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_consultant ON properties(assigned_consultant_id);
CREATE INDEX IF NOT EXISTS idx_properties_transaction ON properties(transaction_type);
CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city_id);
CREATE INDEX IF NOT EXISTS idx_properties_neighborhood ON properties(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_properties_sale_price ON properties(sale_price);
CREATE INDEX IF NOT EXISTS idx_properties_created ON properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_requests_user ON property_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_property_requests_customer ON property_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_calls_user ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_customer ON calls(customer_id);
CREATE INDEX IF NOT EXISTS idx_calls_owner ON calls(owner_id);
CREATE INDEX IF NOT EXISTS idx_calls_property ON calls(property_id);
CREATE INDEX IF NOT EXISTS idx_calls_consultant ON calls(consultant_id);
CREATE INDEX IF NOT EXISTS idx_calls_date ON calls(call_date DESC);
CREATE INDEX IF NOT EXISTS idx_follow_ups_user ON follow_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_entity ON follow_ups(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_due_date ON follow_ups(due_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_assigned ON follow_ups(assigned_consultant_id);
CREATE INDEX IF NOT EXISTS idx_deals_user ON deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_consultant ON deals(consultant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_property_matches_user ON property_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_property_matches_property ON property_matches(property_id);
CREATE INDEX IF NOT EXISTS idx_property_matches_customer ON property_matches(customer_id);
CREATE INDEX IF NOT EXISTS idx_property_matches_score ON property_matches(score DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);

-- ---------------------------------------------------------------------------
-- ۸) RLS — جداسازی کامل حساب‌ها
-- ---------------------------------------------------------------------------
ALTER TABLE provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE counties ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_preferred_neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_preferred_cities ENABLE ROW LEVEL SECURITY;

-- داده‌های مرجع: خواندن برای همه، نوشتن برای حساب‌های واردشده
CREATE POLICY "public_read_provinces" ON provinces FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_counties" ON counties FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_districts" ON districts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_cities" ON cities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_neighborhoods" ON neighborhoods FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_agencies" ON agencies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_branches" ON branches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth_write_geo" ON provinces FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_counties" ON counties FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_districts" ON districts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_cities" ON cities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_neighborhoods" ON neighborhoods FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_agencies" ON agencies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_branches" ON branches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- پروفایل: خواندن برای همهٔ حساب‌ها (فهرست همکاران)، باقی‌کارها فقط روی پروفایل خود
CREATE POLICY "read_profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own_profile" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own_profile_update" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- جدول‌های کاری: فقط ردیف‌های خودش
CREATE POLICY "own_owners" ON owners FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_customers" ON customers FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_properties" ON properties FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_property_requests" ON property_requests FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_calls" ON calls FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_follow_ups" ON follow_ups FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_deals" ON deals FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_tasks" ON tasks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_property_matches" ON property_matches FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_activities" ON activities FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_notifications" ON notifications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_tags" ON tags FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_customer_tags" ON customer_tags FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_property_tags" ON property_tags FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_cust_pref_nbh" ON customer_preferred_neighborhoods FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_cust_pref_city" ON customer_preferred_cities FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ۹) مجوزها (grants)
-- ---------------------------------------------------------------------------
GRANT SELECT ON provinces, counties, districts, cities, neighborhoods, agencies, branches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON provinces, counties, districts, cities, neighborhoods, agencies, branches TO authenticated;
GRANT SELECT ON profiles TO authenticated;
GRANT INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  owners, customers, properties, property_requests, calls, follow_ups, deals, tasks,
  property_matches, activities, notifications, tags, customer_tags, property_tags,
  customer_preferred_neighborhoods, customer_preferred_cities
TO authenticated;

-- ---------------------------------------------------------------------------
-- ۱۰) seed داده‌های مرجع جغرافیایی (همان seedهای نسخهٔ ابری — بدون هیچ دادهٔ کاربری)
-- ---------------------------------------------------------------------------
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

-- شهرستان‌ها و شهرها (استان‌های اصلی + کامل‌شده)
INSERT INTO counties (province_id, name, slug, official_code)
SELECT p.id, v.name, v.slug, v.code
FROM provinces p
CROSS JOIN (VALUES
  ('تهران', 'tehran', '0801'),
  ('رباط کریم', 'robat-karim', '0808'),
  ('ورامین', 'varamin', '0809'),
  ('شهریار', 'shahriar', '0807'),
  ('پیشوا', 'pishva', '0810'),
  ('پاکدشت', 'pakdasht', '0811'),
  ('اسلامشهر', 'eslamshahr', '0804'),
  ('گلستان', 'golestan-tehran', '0805'),
  ('قرچک', 'gharchak', '0806'),
  ('کرج', 'karaj', '0501'),
  ('نظرآباد', 'nazaraabad', '0502'),
  ('ساوجبلاغ', 'savojbolagh', '0503'),
  ('طالقان', 'taleqan', '0504'),
  ('قم', 'qom-county', '1901'),
  ('قزوین', 'qazvin-county', '1801'),
  ('تاکستان', 'takestan', '1802'),
  ('آبیک', 'abeyek', '1803'),
  ('بوئین‌زهرا', 'buin-zahra', '1804'),
  ('اصفهان', 'isfahan-county', '0401'),
  ('کاشان', 'kashan', '0402'),
  ('نجف‌آباد', 'najafabad', '0403'),
  ('خمینی‌شهر', 'khomeini-shahr', '0404'),
  ('شاهین‌شهر', 'shahin-shahr', '0405'),
  ('شیراز', 'shiraz', '1701'),
  ('مرودشت', 'marvdasht', '1702'),
  ('کازرون', 'kazerun', '1703'),
  ('جهرم', 'jahrom', '1704'),
  ('فسا', 'fasa', '1705'),
  ('مشهد', 'mashhad', '1101'),
  ('نیشابور', 'nishabur', '1102'),
  ('سبزوار', 'sabzevar', '1103'),
  ('تربت حیدریه', 'torbat-heydariyeh', '1104'),
  ('قوچان', 'quchan', '1105'),
  ('اهواز', 'ahvaz', '1301'),
  ('آبادان', 'abadan', '1302'),
  ('خرمشهر', 'khorramshahr', '1303'),
  ('دزفول', 'dezful', '1304'),
  ('تبریز', 'tabriz', '0101'),
  ('مراغه', 'maragheh', '0102'),
  ('میانه', 'mianeh', '0103'),
  ('ارومیه', 'urmia', '0201'),
  ('خوی', 'khoy', '0202'),
  ('ماکو', 'maku', '0203'),
  ('رشت', 'rasht', '2501'),
  ('بندر انزلی', 'bandar-anzali', '2502'),
  ('لاهیجان', 'lahijan', '2503'),
  ('ساری', 'sari', '2701'),
  ('بابل', 'babol', '2702'),
  ('آمل', 'amol', '2703'),
  ('نوشهر', 'nowshahr', '2704'),
  ('کرمان', 'kerman-county', '2101'),
  ('سیرجان', 'sirjan', '2102'),
  ('رفسنجان', 'rafsanjan', '2103'),
  ('کرمانشاه', 'kermanshah-county', '2201'),
  ('سنندج', 'sanandaj', '2202'),
  ('گرگان', 'gorgan', '2401'),
  ('گنبد کاووس', 'gonbad-kavus', '2402'),
  ('زاهدان', 'zahedan', '1601'),
  ('زابل', 'zabol', '1602'),
  ('کردستان-سنندج', 'sanandaj-county', '2001'),
  ('سقز', 'saqqez', '2002'),
  ('مریوان', 'marivan', '2003'),
  ('خرم‌آباد', 'khorramabad', '2601'),
  ('بروجرد', 'borujerd', '2602'),
  ('همدان', 'hamadan-county', '3001'),
  ('ملایر', 'malayer', '3002'),
  ('یزد', 'yazd-county', '3101'),
  ('سمنان', 'semnan-county', '1501'),
  ('شاهرود', 'shahroud', '1502'),
  ('شهرکرد', 'shahrekord', '0901'),
  ('یاسوج', 'yasuj', '2301'),
  ('بجنورد', 'bojnurd', '1201'),
  ('بیرجند', 'birjand', '1001'),
  ('زنجان', 'zanjan-county', '1401'),
  ('اراک', 'arak', '2801'),
  ('ساوه', 'saveh', '2802'),
  ('ایلام', 'ilam-county', '0601'),
  ('بوشهر', 'bushehr-county', '0701'),
  ('بندرعباس', 'bandar-abbas', '2901'),
  ('اردبیل', 'ardabil-county', '0301')
) AS v(name, slug, code)
WHERE (p.slug = 'tehran' AND v.slug IN ('tehran','robat-karim','varamin','shahriar','pishva','pakdasht','eslamshahr','golestan-tehran','gharchak'))
   OR (p.slug = 'alborz' AND v.slug IN ('karaj','nazaraabad','savojbolagh','taleqan'))
   OR (p.slug = 'qom' AND v.slug = 'qom-county')
   OR (p.slug = 'qazvin' AND v.slug IN ('qazvin-county','takestan','abeyek','buin-zahra'))
   OR (p.slug = 'isfahan' AND v.slug IN ('isfahan-county','kashan','najafabad','khomeini-shahr','shahin-shahr'))
   OR (p.slug = 'fars' AND v.slug IN ('shiraz','marvdasht','kazerun','jahrom','fasa'))
   OR (p.slug = 'razavi-khorasan' AND v.slug IN ('mashhad','nishabur','sabzevar','torbat-heydariyeh','quchan'))
   OR (p.slug = 'khuzestan' AND v.slug IN ('ahvaz','abadan','khorramshahr','dezful'))
   OR (p.slug = 'east-azarbaijan' AND v.slug IN ('tabriz','maragheh','mianeh'))
   OR (p.slug = 'west-azarbaijan' AND v.slug IN ('urmia','khoy','maku'))
   OR (p.slug = 'gilan' AND v.slug IN ('rasht','bandar-anzali','lahijan'))
   OR (p.slug = 'mazandaran' AND v.slug IN ('sari','babol','amol','nowshahr'))
   OR (p.slug = 'kerman' AND v.slug IN ('kerman-county','sirjan','rafsanjan'))
   OR (p.slug = 'kermanshah' AND v.slug IN ('kermanshah-county'))
   OR (p.slug = 'sistan-baluchestan' AND v.slug IN ('zahedan','zabol'))
   OR (p.slug = 'kurdistan' AND v.slug IN ('sanandaj-county','saqqez','marivan'))
   OR (p.slug = 'lorestan' AND v.slug IN ('khorramabad','borujerd'))
   OR (p.slug = 'hamadan' AND v.slug IN ('hamadan-county','malayer'))
   OR (p.slug = 'yazd' AND v.slug = 'yazd-county')
   OR (p.slug = 'semnan' AND v.slug IN ('semnan-county','shahroud'))
   OR (p.slug = 'chaharmahal-bakhtiari' AND v.slug = 'shahrekord')
   OR (p.slug = 'kohgiluyeh-boyer-ahmad' AND v.slug = 'yasuj')
   OR (p.slug = 'north-khorasan' AND v.slug = 'bojnurd')
   OR (p.slug = 'south-khorasan' AND v.slug = 'birjand')
   OR (p.slug = 'zanjan' AND v.slug = 'zanjan-county')
   OR (p.slug = 'markazi' AND v.slug IN ('arak','saveh'))
   OR (p.slug = 'ilam' AND v.slug = 'ilam-county')
   OR (p.slug = 'bushehr' AND v.slug = 'bushehr-county')
   OR (p.slug = 'hormozgan' AND v.slug = 'bandar-abbas')
   OR (p.slug = 'ardabil' AND v.slug = 'ardabil-county')
ON CONFLICT DO NOTHING;

INSERT INTO cities (province_id, county_id, name, slug, official_code, latitude, longitude)
SELECT p.id, c.id, v.name, v.slug, v.code, v.lat, v.lng
FROM provinces p
JOIN counties c ON c.province_id = p.id
CROSS JOIN (VALUES
  ('تهران', 'tehran-city', '080101', 35.6890, 51.3890, 'tehran', 'tehran'),
  ('رباط کریم', 'robat-karim-city', '080801', 35.4800, 51.0800, 'tehran', 'robat-karim'),
  ('ورامین', 'varamin-city', '080901', 35.3200, 51.6400, 'tehran', 'varamin'),
  ('شهریار', 'shahriar-city', '080701', 35.6600, 50.9600, 'tehran', 'shahriar'),
  ('پیشوا', 'pishva-city', '081001', 35.0300, 51.7300, 'tehran', 'pishva'),
  ('پاکدشت', 'pakdasht-city', '081101', 35.4700, 51.6800, 'tehran', 'pakdasht'),
  ('پردیس', 'pardis-city', '080102', 35.7500, 51.6700, 'tehran', 'tehran'),
  ('بومهن', 'bumehen', '080103', 35.7400, 51.5800, 'tehran', 'tehran'),
  ('لواسان', 'lavasan', '080104', 35.8300, 51.5800, 'tehran', 'tehran'),
  ('اندیشه', 'andisheh', '080702', 35.6800, 50.8900, 'tehran', 'shahriar'),
  ('ملارد', 'malard', '080703', 35.6700, 50.8400, 'tehran', 'shahriar'),
  ('قرچک', 'qarchak', '080902', 35.4300, 51.5800, 'tehran', 'varamin'),
  ('پرند', 'parand', '080705', 35.5300, 50.9600, 'tehran', 'shahriar'),
  ('اسلامشهر', 'islamshahr', '080704', 35.5500, 51.2300, 'tehran', 'shahriar'),
  ('نسیم‌شهر', 'nasimshahr', '080706', 35.5200, 51.1700, 'tehran', 'shahriar'),
  ('کرج', 'karaj-city', '050101', 35.8400, 50.9200, 'alborz', 'karaj'),
  ('ماهدشت', 'mahdasht', '050102', 35.7800, 50.8500, 'alborz', 'karaj'),
  ('اشتهارد', 'eshtehard', '050103', 35.7200, 50.3500, 'alborz', 'karaj'),
  ('نظرآباد', 'nazaraabad-city', '050201', 35.9500, 50.5600, 'alborz', 'nazaraabad'),
  ('هشتگرد', 'hashtgerd', '050301', 35.8900, 50.6800, 'alborz', 'savojbolagh'),
  ('قم', 'qom-city', '190101', 34.6400, 50.8800, 'qom', 'qom-county'),
  ('قزوین', 'qazvin-city', '180101', 36.2700, 50.0000, 'qazvin', 'qazvin-county'),
  ('تاکستان', 'takestan-city', '180201', 36.0700, 49.7000, 'qazvin', 'takestan'),
  ('اصفهان', 'isfahan-city', '040101', 32.6540, 51.6680, 'isfahan', 'isfahan-county'),
  ('کاشان', 'kashan-city', '040201', 33.9850, 51.4100, 'isfahan', 'kashan'),
  ('شیراز', 'shiraz-city', '170101', 29.5900, 52.5800, 'fars', 'shiraz'),
  ('مشهد', 'mashhad-city', '110101', 36.2900, 59.6000, 'razavi-khorasan', 'mashhad'),
  ('اهواز', 'ahvaz-city', '130101', 31.3200, 48.6900, 'khuzestan', 'ahvaz'),
  ('تبریز', 'tabriz-city', '010101', 38.0800, 46.2920, 'east-azarbaijan', 'tabriz'),
  ('ارومیه', 'urmia-city', '020101', 37.5500, 45.0750, 'west-azarbaijan', 'urmia'),
  ('رشت', 'rasht-city', '250101', 37.2800, 49.5900, 'gilan', 'rasht'),
  ('ساری', 'sari-city', '270101', 36.3300, 52.9500, 'mazandaran', 'sari'),
  ('کرمان', 'kerman-city', '210101', 30.2800, 57.0800, 'kerman', 'kerman-county'),
  ('سنندج', 'sanandaj-city', '220201', 34.3200, 47.0700, 'kermanshah', 'kermanshah-county'),
  ('گرگان', 'gorgan-city', '240101', 36.8300, 54.4400, 'golestan', 'gorgan'),
  ('زاهدان', 'zahedan-city', '160101', 27.0300, 60.6300, 'sistan-baluchestan', 'zahedan'),
  ('سنندج-کردستان', 'sanandaj-kurd-city', '200101', 34.5500, 47.0000, 'kurdistan', 'sanandaj-county'),
  ('خرم‌آباد', 'khorramabad-city', '260101', 33.5100, 48.3800, 'lorestan', 'khorramabad'),
  ('همدان', 'hamadan-city', '300101', 34.8000, 48.5200, 'hamadan', 'hamadan-county'),
  ('یزد', 'yazd-city', '310101', 31.9000, 54.3600, 'yazd', 'yazd-county'),
  ('سمنان', 'semnan-city', '150101', 35.5700, 53.3900, 'semnan', 'semnan-county'),
  ('شهرکرد', 'shahrekord-city', '090101', 31.9700, 50.8500, 'chaharmahal-bakhtiari', 'shahrekord'),
  ('یاسوج', 'yasuj-city', '230101', 30.6600, 51.6100, 'kohgiluyeh-boyer-ahmad', 'yasuj'),
  ('بجنورد', 'bojnurd-city', '120101', 37.4700, 58.1300, 'north-khorasan', 'bojnurd'),
  ('بیرجند', 'birjand-city', '100101', 32.8600, 59.2100, 'south-khorasan', 'birjand'),
  ('زنجان', 'zanjan-city', '140101', 36.6700, 48.4800, 'zanjan', 'zanjan-county'),
  ('اراک', 'arak-city', '280101', 34.0900, 49.7700, 'markazi', 'arak'),
  ('ایلام', 'ilam-city', '060101', 33.6400, 46.4200, 'ilam', 'ilam-county'),
  ('بوشهر', 'bushehr-city', '070101', 28.9700, 50.8400, 'bushehr', 'bushehr-county'),
  ('بندرعباس', 'bandar-abbas-city', '290101', 27.1900, 56.2700, 'hormozgan', 'bandar-abbas'),
  ('اردبیل', 'ardabil-city', '030101', 38.2400, 48.2700, 'ardabil', 'ardabil-county')
) AS v(name, slug, code, lat, lng, p_slug, c_slug)
WHERE p.slug = v.p_slug AND c.slug = v.c_slug
ON CONFLICT DO NOTHING;

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

-- محله‌های رباط کریم
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
WHERE ci.slug = 'robat-karim-city'
ON CONFLICT DO NOTHING;

