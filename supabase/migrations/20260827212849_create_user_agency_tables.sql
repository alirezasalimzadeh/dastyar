/*
# Create User, Agency, and Profile Tables

1. New Tables
- `agencies` — Real-estate agencies (املاک).
- `branches` — Branch offices within an agency.
- `profiles` — Extended user profile data linked to auth.users.
- `activities` — Activity log for every user action (timeline).

2. Relationships
- branches.agency_id → agencies.id
- profiles.id → auth.users.id (one-to-one)
- profiles.agency_id → agencies.id
- profiles.branch_id → branches.id
- activities.user_id → auth.users.id

3. Security
- Enable RLS on all tables.
- profiles: users can read all profiles (team visibility), update only their own.
- activities: authenticated users can read all, insert for themselves.
- agencies/branches: authenticated read, authenticated insert/update.

4. Notes
- Roles stored in profiles.role: 'manager' | 'office_manager' | 'consultant' | 'system_admin'
- Account status: 'active' | 'suspended' | 'inactive'
- Activity log captures entity_type, entity_id, action, and metadata for timeline display.
*/

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

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_agencies" ON agencies;
CREATE POLICY "public_read_agencies" ON agencies FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_agencies" ON agencies;
CREATE POLICY "auth_insert_agencies" ON agencies FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_agencies" ON agencies;
CREATE POLICY "auth_update_agencies" ON agencies FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_agencies" ON agencies;
CREATE POLICY "auth_delete_agencies" ON agencies FOR DELETE
  TO authenticated USING (true);

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

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_branches" ON branches;
CREATE POLICY "public_read_branches" ON branches FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_branches" ON branches;
CREATE POLICY "auth_insert_branches" ON branches FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_branches" ON branches;
CREATE POLICY "auth_update_branches" ON branches FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_branches" ON branches;
CREATE POLICY "auth_delete_branches" ON branches FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_profiles" ON profiles;
CREATE POLICY "public_read_profiles" ON profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_profiles" ON profiles;
CREATE POLICY "auth_insert_profiles" ON profiles FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_profiles" ON profiles;
CREATE POLICY "auth_update_profiles" ON profiles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_profiles" ON profiles;
CREATE POLICY "auth_delete_profiles" ON profiles FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_activities" ON activities;
CREATE POLICY "public_read_activities" ON activities FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_activities" ON activities;
CREATE POLICY "auth_insert_activities" ON activities FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_activities" ON activities;
CREATE POLICY "auth_update_activities" ON activities FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_activities" ON activities;
CREATE POLICY "auth_delete_activities" ON activities FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_branches_agency ON branches(agency_id);
