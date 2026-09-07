/*
# Create CRM Activity Tables: Calls, Follow-ups, Deals, Tasks, Matches, Notifications, Tags

1. New Tables
- `calls` — Recorded phone calls with customers/owners.
- `follow_ups` — Follow-up reminders linked to customers/owners/properties.
- `deals` — Deal tracking through negotiation to completion.
- `tasks` — Task management linked to any entity.
- `property_matches` — Calculated compatibility scores between properties and customers.
- `notifications` — In-app notifications for follow-ups, matches, etc.
- `tags` — Reusable tag definitions.
- `property_tags` — Many-to-many: property ↔ tags.
- `customer_tags` — Many-to-many: customer ↔ tags.

2. Relationships
- calls.customer_id → customers.id, calls.owner_id → owners.id, calls.property_id → properties.id
- calls.consultant_id → auth.users.id
- follow_ups linked to customer/owner/property + consultant
- deals linked to customer/owner/property/consultant
- tasks linked to customer/owner/property/deal/follow_up + assigned_user
- property_matches.property_id → properties.id, property_matches.customer_id → customers.id

3. Security
- Enable RLS on all tables. Public read + authenticated CRUD (shared team data).

4. Notes
- Call results: 'answered', 'no_answer', 'interested', 'needs_review', 'introduced', 'viewing_scheduled', 'deal_done', 'disinterested', 'wrong_number', 'needs_followup'
- Follow-up status: 'pending' | 'completed' | 'missed' | 'cancelled'
- Task status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
- Deal status: 'negotiating' | 'agreement' | 'contracted' | 'completed' | 'cancelled'
- Match scores stored 0-100 with factors and differences as JSONB.
*/

CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  consultant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  call_date timestamptz NOT NULL DEFAULT now(),
  duration_minutes integer,
  direction text DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  result text CHECK (result IN ('answered', 'no_answer', 'interested', 'needs_review', 'introduced', 'viewing_scheduled', 'deal_done', 'disinterested', 'wrong_number', 'needs_followup')),
  notes text,
  next_action text,
  next_followup timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_calls" ON calls;
CREATE POLICY "public_read_calls" ON calls FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_calls" ON calls;
CREATE POLICY "auth_insert_calls" ON calls FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_calls" ON calls;
CREATE POLICY "auth_update_calls" ON calls FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_calls" ON calls;
CREATE POLICY "auth_delete_calls" ON calls FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('customer', 'owner', 'property', 'deal')),
  entity_id uuid NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  reason text,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  due_date date NOT NULL,
  due_time time,
  assigned_consultant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'missed', 'cancelled')),
  notes text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_follow_ups" ON follow_ups;
CREATE POLICY "public_read_follow_ups" ON follow_ups FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_follow_ups" ON follow_ups;
CREATE POLICY "auth_insert_follow_ups" ON follow_ups FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_follow_ups" ON follow_ups;
CREATE POLICY "auth_update_follow_ups" ON follow_ups FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_follow_ups" ON follow_ups;
CREATE POLICY "auth_delete_follow_ups" ON follow_ups FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  consultant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
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

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_deals" ON deals;
CREATE POLICY "public_read_deals" ON deals FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_deals" ON deals;
CREATE POLICY "auth_insert_deals" ON deals FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_deals" ON deals;
CREATE POLICY "auth_update_deals" ON deals FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_deals" ON deals;
CREATE POLICY "auth_delete_deals" ON deals FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  due_date date,
  due_time time,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  follow_up_id uuid REFERENCES follow_ups(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_tasks" ON tasks;
CREATE POLICY "public_read_tasks" ON tasks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_tasks" ON tasks;
CREATE POLICY "auth_insert_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_tasks" ON tasks;
CREATE POLICY "auth_update_tasks" ON tasks FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_tasks" ON tasks;
CREATE POLICY "auth_delete_tasks" ON tasks FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS property_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  factors jsonb DEFAULT '[]',
  differences jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE (property_id, customer_id)
);

ALTER TABLE property_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_property_matches" ON property_matches;
CREATE POLICY "public_read_property_matches" ON property_matches FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_property_matches" ON property_matches;
CREATE POLICY "auth_insert_property_matches" ON property_matches FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_property_matches" ON property_matches;
CREATE POLICY "auth_update_property_matches" ON property_matches FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_property_matches" ON property_matches;
CREATE POLICY "auth_delete_property_matches" ON property_matches FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  entity_type text,
  entity_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_notifications" ON notifications;
CREATE POLICY "public_read_notifications" ON notifications FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_notifications" ON notifications;
CREATE POLICY "auth_insert_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_notifications" ON notifications;
CREATE POLICY "auth_update_notifications" ON notifications FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_notifications" ON notifications;
CREATE POLICY "auth_delete_notifications" ON notifications FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text DEFAULT 'blue',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_tags" ON tags;
CREATE POLICY "public_read_tags" ON tags FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_tags" ON tags;
CREATE POLICY "auth_insert_tags" ON tags FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_tags" ON tags;
CREATE POLICY "auth_update_tags" ON tags FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_tags" ON tags;
CREATE POLICY "auth_delete_tags" ON tags FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS property_tags (
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (property_id, tag_id)
);

ALTER TABLE property_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_property_tags" ON property_tags;
CREATE POLICY "public_read_property_tags" ON property_tags FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_property_tags" ON property_tags;
CREATE POLICY "auth_insert_property_tags" ON property_tags FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_property_tags" ON property_tags;
CREATE POLICY "auth_delete_property_tags" ON property_tags FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS customer_tags (
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, tag_id)
);

ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_customer_tags" ON customer_tags;
CREATE POLICY "public_read_customer_tags" ON customer_tags FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_customer_tags" ON customer_tags;
CREATE POLICY "auth_insert_customer_tags" ON customer_tags FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_customer_tags" ON customer_tags;
CREATE POLICY "auth_delete_customer_tags" ON customer_tags FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_calls_customer ON calls(customer_id);
CREATE INDEX IF NOT EXISTS idx_calls_owner ON calls(owner_id);
CREATE INDEX IF NOT EXISTS idx_calls_property ON calls(property_id);
CREATE INDEX IF NOT EXISTS idx_calls_consultant ON calls(consultant_id);
CREATE INDEX IF NOT EXISTS idx_calls_date ON calls(call_date DESC);
CREATE INDEX IF NOT EXISTS idx_follow_ups_entity ON follow_ups(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_due_date ON follow_ups(due_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_assigned ON follow_ups(assigned_consultant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_consultant ON deals(consultant_id);
CREATE INDEX IF NOT EXISTS idx_property_matches_property ON property_matches(property_id);
CREATE INDEX IF NOT EXISTS idx_property_matches_customer ON property_matches(customer_id);
CREATE INDEX IF NOT EXISTS idx_property_matches_score ON property_matches(score DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
