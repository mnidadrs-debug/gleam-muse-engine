ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_auth_code VARCHAR(6);

ALTER TABLE public.orders
ALTER COLUMN delivery_auth_code SET DEFAULT LPAD((FLOOR(RANDOM() * 1000000)::int)::text, 6, '0');

UPDATE public.orders
SET delivery_auth_code = LPAD((FLOOR(RANDOM() * 1000000)::int)::text, 6, '0')
WHERE delivery_auth_code IS NULL;

ALTER TABLE public.orders
ALTER COLUMN delivery_auth_code SET NOT NULL;