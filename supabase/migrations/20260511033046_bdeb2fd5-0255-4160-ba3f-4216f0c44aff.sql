CREATE TABLE IF NOT EXISTS public.vendor_service_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, neighborhood_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_service_zones_vendor_id
  ON public.vendor_service_zones(vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_service_zones_neighborhood_id
  ON public.vendor_service_zones(neighborhood_id);

ALTER TABLE public.vendor_service_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage vendor service zones" ON public.vendor_service_zones;
CREATE POLICY "Admins manage vendor service zones"
ON public.vendor_service_zones
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Vendors can view own service zones" ON public.vendor_service_zones;
CREATE POLICY "Vendors can view own service zones"
ON public.vendor_service_zones
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = vendor_service_zones.vendor_id
      AND v.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

INSERT INTO public.vendor_service_zones (vendor_id, neighborhood_id)
SELECT n.vendor_id, n.id
FROM public.neighborhoods n
WHERE n.vendor_id IS NOT NULL
ON CONFLICT (vendor_id, neighborhood_id) DO NOTHING;

DROP POLICY IF EXISTS "Vendors can read own inventory" ON public.vendor_products;
CREATE POLICY "Vendors can read own inventory"
ON public.vendor_products
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = vendor_products.vendor_id
      AND v.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Vendors can manage own inventory" ON public.vendor_products;
CREATE POLICY "Vendors can manage own inventory"
ON public.vendor_products
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = vendor_products.vendor_id
      AND v.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = vendor_products.vendor_id
      AND v.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Vendors update their orders" ON public.orders;
CREATE POLICY "Vendors update their orders"
ON public.orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = orders.vendor_id
      AND v.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = orders.vendor_id
      AND v.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Customers view own orders" ON public.orders;
CREATE POLICY "Customers view own orders"
ON public.orders
FOR SELECT
USING (
  customer_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = orders.vendor_id
      AND v.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.cyclists c
    WHERE c.id = orders.cyclist_id
      AND c.user_id = auth.uid()
  )
);