DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'vendor_settlement_status'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.vendor_settlement_status AS ENUM ('pending', 'settled');
  END IF;
END
$$;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS vendor_settlement_status public.vendor_settlement_status NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_orders_cyclist_settlement_status
ON public.orders (cyclist_id, vendor_settlement_status, status, delivered_at);