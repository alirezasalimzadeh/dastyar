-- Dedicated colleagues and explicit property contact ownership.
-- A property can be sourced directly from its owner or through a colleague.

CREATE TABLE IF NOT EXISTS colleagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  secondary_phone text,
  agency_name text,
  specialization text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  assigned_consultant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE colleagues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_colleagues" ON colleagues;
CREATE POLICY "public_read_colleagues" ON colleagues FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_colleagues" ON colleagues;
CREATE POLICY "auth_insert_colleagues" ON colleagues FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_colleagues" ON colleagues;
CREATE POLICY "auth_update_colleagues" ON colleagues FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_colleagues" ON colleagues;
CREATE POLICY "auth_delete_colleagues" ON colleagues FOR DELETE
  TO authenticated USING (true);

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS contact_type text NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS colleague_id uuid REFERENCES colleagues(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_contact_type_check'
  ) THEN
    ALTER TABLE properties
      ADD CONSTRAINT properties_contact_type_check
      CHECK (contact_type IN ('owner', 'colleague'));
  END IF;
END $$;

-- Preserve colleagues created by the older tag-based implementation. Keeping the
-- same UUID also lets us safely convert legacy owner_relationship references.
INSERT INTO colleagues (
  id, name, phone, secondary_phone, notes, status,
  assigned_consultant_id, created_at, updated_at
)
SELECT
  id, name, phone, secondary_phone, notes,
  CASE WHEN status = 'active' THEN 'active' ELSE 'inactive' END,
  assigned_consultant_id, created_at, updated_at
FROM owners
WHERE tags @> ARRAY['همکار']::text[]
ON CONFLICT (id) DO NOTHING;

UPDATE properties p
SET colleague_id = c.id,
    contact_type = 'colleague',
    owner_id = NULL
FROM colleagues c
WHERE p.owner_relationship = c.id::text
  AND p.colleague_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_contact_source_check'
  ) THEN
    ALTER TABLE properties
      ADD CONSTRAINT properties_contact_source_check
      CHECK (
        (contact_type = 'owner' AND colleague_id IS NULL)
        OR
        (contact_type = 'colleague' AND colleague_id IS NOT NULL AND owner_id IS NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_colleagues_phone ON colleagues(phone);
CREATE INDEX IF NOT EXISTS idx_colleagues_status ON colleagues(status);
CREATE INDEX IF NOT EXISTS idx_properties_colleague ON properties(colleague_id);
CREATE INDEX IF NOT EXISTS idx_properties_contact_type ON properties(contact_type);
