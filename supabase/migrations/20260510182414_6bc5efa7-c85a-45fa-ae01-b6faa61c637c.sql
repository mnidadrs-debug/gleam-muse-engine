-- Restrict SECURITY DEFINER function execution to trusted backend role
REVOKE EXECUTE ON FUNCTION public.clear_vendor_carnet_debt(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_vendor_carnet_payment(uuid, text, numeric) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_delivery_and_apply_payment(uuid, uuid) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.clear_vendor_carnet_debt(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_vendor_carnet_payment(uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_delivery_and_apply_payment(uuid, uuid) TO service_role;

-- vendor_carnet policies
CREATE POLICY "Admins manage vendor carnet"
ON public.vendor_carnet
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vendors can view own carnet ledger"
ON public.vendor_carnet
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = vendor_carnet.vendor_id
      AND v.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Vendors can update own carnet ledger"
ON public.vendor_carnet
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = vendor_carnet.vendor_id
      AND v.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = vendor_carnet.vendor_id
      AND v.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- carnet_payments policies
CREATE POLICY "Admins manage carnet payments"
ON public.carnet_payments
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vendors can view own carnet payments"
ON public.carnet_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = carnet_payments.vendor_id
      AND v.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Vendors can create own carnet payments"
ON public.carnet_payments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = carnet_payments.vendor_id
      AND v.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);