/*
# Create Core CRM Tables: Owners, Customers, Properties, Requests

1. New Tables
- `owners` — Property owners (مالکین) with contact info and assignment.
- `customers` — Leads/customers (مشتریان) with preferences, budget, temperature.
- `properties` — Property listings (فایل‌ها) with full physical/financial details.
- `property_requests` — Customer property requests (درخواست‌های مشتری).
- `customer_preferred_neighborhoods` — Many-to-many: customer ↔ neighborhoods.
- `customer_preferred_cities` — Many-to-many: customer ↔ cities.

2. Relationships
- owners.assigned_consultant_id → auth.users.id
- customers.assigned_consultant_id → auth.users.id
- properties.owner_id → owners.id
- properties.assigned_consultant_id → auth.users.id
- properties linked to province/county/district/city/neighborhood
- property_requests.customer_id → customers.id
- property_requests linked to province/county/city/neighborhood

3. Security
- Enable RLS on all tables.
- Public read + authenticated CRUD (shared team CRM data).

4. Notes
- Transaction types: 'buy' | 'rent' | 'partnership' | 'sell'
- Transaction roles vary by type (e.g. for rent: 'owner' | 'applicant')
- Customer temperature: 'hot' | 'warm' | 'cold'
- Property status: 'active' | 'sold' | 'rented' | 'inactive' | 'pending'
- All financial values stored as numeric for precision.
*/

CREATE TABLE IF NOT EXISTS owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  secondary_phone text,
  notes text,
  tags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
  assigned_consultant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_contact timestamptz,
  next_followup timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_owners" ON owners;
CREATE POLICY "public_read_owners" ON owners FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_owners" ON owners;
CREATE POLICY "auth_insert_owners" ON owners FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_owners" ON owners;
CREATE POLICY "auth_update_owners" ON owners FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_owners" ON owners;
CREATE POLICY "auth_delete_owners" ON owners FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text,
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
  assigned_consultant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  tags text[] DEFAULT '{}',
  last_contact timestamptz,
  next_followup timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'converted', 'lost')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_customers" ON customers;
CREATE POLICY "public_read_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_customers" ON customers;
CREATE POLICY "auth_insert_customers" ON customers FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_customers" ON customers;
CREATE POLICY "auth_update_customers" ON customers FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_customers" ON customers;
CREATE POLICY "auth_delete_customers" ON customers FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS customer_preferred_neighborhoods (
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  neighborhood_id uuid NOT NULL REFERENCES neighborhoods(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, neighborhood_id)
);

ALTER TABLE customer_preferred_neighborhoods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_cust_pref_nbh" ON customer_preferred_neighborhoods;
CREATE POLICY "public_read_cust_pref_nbh" ON customer_preferred_neighborhoods FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_cust_pref_nbh" ON customer_preferred_neighborhoods;
CREATE POLICY "auth_insert_cust_pref_nbh" ON customer_preferred_neighborhoods FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_cust_pref_nbh" ON customer_preferred_neighborhoods;
CREATE POLICY "auth_delete_cust_pref_nbh" ON customer_preferred_neighborhoods FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS customer_preferred_cities (
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, city_id)
);

ALTER TABLE customer_preferred_cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_cust_pref_city" ON customer_preferred_cities;
CREATE POLICY "public_read_cust_pref_city" ON customer_preferred_cities FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_cust_pref_city" ON customer_preferred_cities;
CREATE POLICY "auth_insert_cust_pref_city" ON customer_preferred_cities FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_cust_pref_city" ON customer_preferred_cities;
CREATE POLICY "auth_delete_cust_pref_city" ON customer_preferred_cities FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  transaction_type text NOT NULL CHECK (transaction_type IN ('buy', 'rent', 'partnership', 'sell')),
  transaction_role text,
  category text NOT NULL CHECK (category IN ('residential', 'industrial', 'commercial', 'agricultural')),
  property_type text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'rented', 'inactive', 'pending')),
  is_hot boolean DEFAULT false,
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  assigned_consultant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  province_id uuid REFERENCES provinces(id) ON DELETE SET NULL,
  county_id uuid REFERENCES counties(id) ON DELETE SET NULL,
  district_id uuid REFERENCES districts(id) ON DELETE SET NULL,
  city_id uuid REFERENCES cities(id) ON DELETE SET NULL,
  neighborhood_id uuid REFERENCES neighborhoods(id) ON DELETE SET NULL,
  address text,
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

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_properties" ON properties;
CREATE POLICY "public_read_properties" ON properties FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_properties" ON properties;
CREATE POLICY "auth_insert_properties" ON properties FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_properties" ON properties;
CREATE POLICY "auth_update_properties" ON properties FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_properties" ON properties;
CREATE POLICY "auth_delete_properties" ON properties FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS property_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('buy', 'rent', 'partnership', 'sell')),
  transaction_role text,
  category text NOT NULL CHECK (category IN ('residential', 'industrial', 'commercial', 'agricultural')),
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

ALTER TABLE property_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_property_requests" ON property_requests;
CREATE POLICY "public_read_property_requests" ON property_requests FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_property_requests" ON property_requests;
CREATE POLICY "auth_insert_property_requests" ON property_requests FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_property_requests" ON property_requests;
CREATE POLICY "auth_update_property_requests" ON property_requests FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_property_requests" ON property_requests;
CREATE POLICY "auth_delete_property_requests" ON property_requests FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_owners_consultant ON owners(assigned_consultant_id);
CREATE INDEX IF NOT EXISTS idx_owners_phone ON owners(phone);
CREATE INDEX IF NOT EXISTS idx_customers_consultant ON customers(assigned_consultant_id);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_temperature ON customers(temperature);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_next_followup ON customers(next_followup);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_consultant ON properties(assigned_consultant_id);
CREATE INDEX IF NOT EXISTS idx_properties_transaction ON properties(transaction_type);
CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city_id);
CREATE INDEX IF NOT EXISTS idx_properties_neighborhood ON properties(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_properties_sale_price ON properties(sale_price);
CREATE INDEX IF NOT EXISTS idx_properties_created ON properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_requests_customer ON property_requests(customer_id);
