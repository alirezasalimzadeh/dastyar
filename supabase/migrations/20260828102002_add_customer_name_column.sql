-- Add a single `name` column to customers for combined first+last name entry
ALTER TABLE customers ADD COLUMN IF NOT EXISTS name text;

-- Backfill existing rows from first_name + last_name
UPDATE customers
SET name = CONCAT_WS(' ', NULLIF(first_name, ''), NULLIF(last_name, ''))
WHERE name IS NULL;

-- Make name NOT NULL after backfill (only if all rows have a name)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM customers WHERE name IS NULL OR name = '') THEN
    ALTER TABLE customers ALTER COLUMN name SET NOT NULL;
  END IF;
END $$;

-- Add index for searching by name
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
