CREATE OR REPLACE FUNCTION public.notify_order_status_webhooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_vendor_name text;
  v_customer_phone text;
  v_customer_name text;
  v_order_total numeric(12,2);
  v_delivery_fee numeric(12,2);
  v_pickup_location text;
  v_cyclist_name text;
  v_cyclist_phones text[];
  v_payload jsonb;
  v_neighborhood_name text;
  v_commune_name text;
BEGIN
  IF tg_op <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_customer_phone := coalesce(NEW.customer_phone, '');
  v_customer_name := coalesce(NEW.customer_name, '');
  v_order_total := coalesce(NEW.total_price, 0) + coalesce(NEW.delivery_fee, 0);
  v_delivery_fee := coalesce(NEW.delivery_fee, 0);

  SELECT v.store_name
    INTO v_vendor_name
  FROM public.vendors v
  WHERE v.id = NEW.vendor_id
  LIMIT 1;

  SELECT n.name, c.name
    INTO v_neighborhood_name, v_commune_name
  FROM public.neighborhoods n
  LEFT JOIN public.communes c ON c.id = n.commune_id
  WHERE n.id = NEW.neighborhood_id
  LIMIT 1;

  v_pickup_location := coalesce(v_neighborhood_name, v_commune_name, v_vendor_name, '');

  SELECT coalesce(array_agg(distinct c.phone_number) FILTER (WHERE c.phone_number IS NOT NULL AND c.phone_number <> ''), '{}')
    INTO v_cyclist_phones
  FROM public.cyclist_coverage cc
  JOIN public.cyclists c ON c.id = cc.cyclist_id
  WHERE cc.neighborhood_id = NEW.neighborhood_id
    AND c.is_active = true;

  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'preparing' THEN
    BEGIN
      v_payload := jsonb_build_object(
        'order_id', NEW.id,
        'customer_name', v_customer_name,
        'customer_phone', v_customer_phone,
        'vendor_name', coalesce(v_vendor_name, ''),
        'total', v_order_total
      );

      PERFORM net.http_post(
        url := 'https://n8n.srv961724.hstgr.cloud/webhook/order-accepted-alert',
        body := v_payload,
        params := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'order-accepted-alert webhook failed for order %: %', NEW.id, SQLERRM;
    END;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status IN ('preparing', 'ready')
     AND NEW.status = 'delivering' THEN
    BEGIN
      IF NEW.cyclist_id IS NOT NULL THEN
        SELECT c.full_name
          INTO v_cyclist_name
        FROM public.cyclists c
        WHERE c.id = NEW.cyclist_id
        LIMIT 1;
      END IF;

      v_payload := jsonb_build_object(
        'order_id', NEW.id,
        'total', v_order_total,
        'customer_phone', v_customer_phone,
        'customer_name', v_customer_name,
        'cyclist_name', coalesce(v_cyclist_name, ''),
        'payment_method', NEW.payment_method
      );

      PERFORM net.http_post(
        url := 'https://n8n.srv961724.hstgr.cloud/webhook/order-out-for-delivery',
        body := v_payload,
        params := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'order-out-for-delivery webhook failed for order %: %', NEW.id, SQLERRM;
    END;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ready' THEN
    BEGIN
      IF coalesce(array_length(v_cyclist_phones, 1), 0) = 0 THEN
        RAISE NOTICE 'No active cyclists found for order % in neighborhood %', NEW.id, NEW.neighborhood_id;
      END IF;

      v_payload := jsonb_build_object(
        'order_id', NEW.id,
        'vendor_name', coalesce(v_vendor_name, ''),
        'pickup_location', v_pickup_location,
        'delivery_fee', v_delivery_fee,
        'cyclist_phones', to_jsonb(coalesce(v_cyclist_phones, '{}'::text[])),
        'no_cyclists_in_zone', (coalesce(array_length(v_cyclist_phones, 1), 0) = 0)
      );

      PERFORM net.http_post(
        url := 'https://n8n.srv961724.hstgr.cloud/webhook/cyclist-broadcast-alert',
        body := v_payload,
        params := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'cyclist-broadcast-alert webhook failed for order %: %', NEW.id, SQLERRM;
    END;
  END IF;

  IF OLD.status = 'ready'
     AND NEW.status = 'delivering'
     AND NEW.cyclist_id IS NOT NULL
     AND (OLD.cyclist_id IS NULL OR OLD.cyclist_id <> NEW.cyclist_id) THEN
    BEGIN
      SELECT c.full_name
        INTO v_cyclist_name
      FROM public.cyclists c
      WHERE c.id = NEW.cyclist_id
      LIMIT 1;

      v_payload := jsonb_build_object(
        'order_id', NEW.id,
        'cyclist_name', coalesce(v_cyclist_name, ''),
        'cyclist_phones', to_jsonb(coalesce(v_cyclist_phones, '{}'::text[]))
      );

      PERFORM net.http_post(
        url := 'https://n8n.srv961724.hstgr.cloud/webhook/order-taken-alert',
        body := v_payload,
        params := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'order-taken-alert webhook failed for order %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notify_order_status_webhooks trigger failed for order %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_order_status_webhooks ON public.orders;

CREATE TRIGGER trg_notify_order_status_webhooks
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_status_webhooks();

REVOKE ALL ON FUNCTION public.notify_order_status_webhooks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_order_status_webhooks() FROM anon;
REVOKE ALL ON FUNCTION public.notify_order_status_webhooks() FROM authenticated;