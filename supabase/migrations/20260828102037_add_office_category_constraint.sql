-- Update CHECK constraints on properties.category to include 'office'
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_category_check;
ALTER TABLE properties ADD CONSTRAINT properties_category_check
  CHECK (category IN ('residential', 'industrial', 'commercial', 'agricultural', 'office'));

-- Update CHECK constraints on property_requests.category to include 'office'
ALTER TABLE property_requests DROP CONSTRAINT IF EXISTS property_requests_category_check;
ALTER TABLE property_requests ADD CONSTRAINT property_requests_category_check
  CHECK (category IN ('residential', 'industrial', 'commercial', 'agricultural', 'office'));
