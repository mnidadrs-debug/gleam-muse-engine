DROP POLICY IF EXISTS "Public read products bucket" ON storage.objects;

CREATE POLICY "Public read products images only"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'products'
  AND (storage.foldername(name))[1] = 'master-products'
);