-- Optional image albums for property listings.
-- Public objects are used because listing cards and details must be able to render
-- their stored image URLs. Uploading and deleting remain restricted to signed-in users.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public_read_property_images" ON storage.objects;
CREATE POLICY "public_read_property_images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "authenticated_upload_property_images" ON storage.objects;
CREATE POLICY "authenticated_upload_property_images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "owners_update_property_images" ON storage.objects;
CREATE POLICY "owners_update_property_images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'property-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'property-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "owners_delete_property_images" ON storage.objects;
CREATE POLICY "owners_delete_property_images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
