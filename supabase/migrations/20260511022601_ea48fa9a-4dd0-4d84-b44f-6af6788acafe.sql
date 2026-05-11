ALTER TYPE public.measurement_unit ADD VALUE IF NOT EXISTS 'Gram';
ALTER TYPE public.measurement_unit ADD VALUE IF NOT EXISTS 'Bunch';
ALTER TYPE public.measurement_unit ADD VALUE IF NOT EXISTS 'Tray';
ALTER TYPE public.measurement_unit ADD VALUE IF NOT EXISTS 'Box';

ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Groceries';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Vegetables & Fruits';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Meat & Poultry';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Bakery & Pastry';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Dairy & Eggs';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Drinks & Water';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Cleaning Supplies';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'vendor_type'
  ) THEN
    CREATE TYPE public.vendor_type AS ENUM ('general', 'specialized');
  END IF;
END $$;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS vendor_type public.vendor_type NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS assigned_categories text[] NOT NULL DEFAULT '{}'::text[];