-- Add property_preferences JSONB column to store type-specific preference fields
ALTER TABLE customers ADD COLUMN IF NOT EXISTS property_preferences jsonb DEFAULT '{}';

-- Add index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_customers_property_prefs ON customers USING gin(property_preferences);
