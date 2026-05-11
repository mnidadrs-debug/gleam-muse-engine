drop trigger if exists trg_notify_order_status_webhooks on public.orders;
drop function if exists public.notify_order_status_webhooks();

drop extension if exists pg_net cascade;
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_order_status_webhooks()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_vendor_name text;
  v_customer_phone text;
  v_order_total numeric(12,2);
  v_delivery_fee numeric(12,2);
  v_pickup_address text;
  v_cyclist_name text;
  v_cyclist_phones text[];
  v_payload jsonb;
  v_neighborhood_name text;
  v_commune_name text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  v_customer_phone := coalesce(new.customer_phone, '');
  v_order_total := coalesce(new.total_price, 0) + coalesce(new.delivery_fee, 0);
  v_delivery_fee := coalesce(new.delivery_fee, 0);

  select v.store_name
    into v_vendor_name
  from public.vendors v
  where v.id = new.vendor_id
  limit 1;

  select n.name, c.name
    into v_neighborhood_name, v_commune_name
  from public.neighborhoods n
  left join public.communes c on c.id = n.commune_id
  where n.id = new.neighborhood_id
  limit 1;

  v_pickup_address := concat_ws(', ', nullif(v_vendor_name, ''), nullif(v_neighborhood_name, ''), nullif(v_commune_name, ''));

  select coalesce(array_agg(distinct c.phone_number) filter (where c.phone_number is not null and c.phone_number <> ''), '{}')
    into v_cyclist_phones
  from public.cyclist_coverage cc
  join public.cyclists c on c.id = cc.cyclist_id
  where cc.neighborhood_id = new.neighborhood_id
    and c.is_active = true;

  if old.status is distinct from new.status and new.status = 'preparing' then
    begin
      v_payload := jsonb_build_object(
        'order_id', new.id,
        'customer_phone', v_customer_phone,
        'vendor_name', coalesce(v_vendor_name, ''),
        'total', v_order_total
      );

      perform net.http_post(
        url := 'https://n8n.srv961724.hstgr.cloud/webhook/order-accepted-alert',
        body := v_payload,
        params := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    exception when others then
      raise notice 'order-accepted-alert webhook failed for order %: %', new.id, sqlerrm;
    end;
  end if;

  if old.status is distinct from new.status and new.status = 'delivering' then
    begin
      v_payload := jsonb_build_object(
        'order_id', new.id,
        'customer_phone', v_customer_phone,
        'vendor_name', coalesce(v_vendor_name, ''),
        'total', v_order_total
      );

      perform net.http_post(
        url := 'https://n8n.srv961724.hstgr.cloud/webhook/order-out-for-delivery',
        body := v_payload,
        params := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    exception when others then
      raise notice 'order-out-for-delivery webhook failed for order %: %', new.id, sqlerrm;
    end;
  end if;

  if old.status is distinct from new.status and new.status = 'ready' then
    begin
      v_payload := jsonb_build_object(
        'order_id', new.id,
        'vendor_name', coalesce(v_vendor_name, ''),
        'pickup_address', coalesce(v_pickup_address, coalesce(v_vendor_name, '')),
        'delivery_fee', v_delivery_fee,
        'cyclist_phones', to_jsonb(coalesce(v_cyclist_phones, '{}'::text[]))
      );

      perform net.http_post(
        url := 'https://n8n.srv961724.hstgr.cloud/webhook/cyclist-broadcast-alert',
        body := v_payload,
        params := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    exception when others then
      raise notice 'cyclist-broadcast-alert webhook failed for order %: %', new.id, sqlerrm;
    end;
  end if;

  if old.status = 'ready'
     and new.status = 'delivering'
     and new.cyclist_id is not null
     and (old.cyclist_id is null or old.cyclist_id <> new.cyclist_id) then
    begin
      select c.full_name
        into v_cyclist_name
      from public.cyclists c
      where c.id = new.cyclist_id
      limit 1;

      v_payload := jsonb_build_object(
        'order_id', new.id,
        'cyclist_name', coalesce(v_cyclist_name, ''),
        'cyclist_phones', to_jsonb(coalesce(v_cyclist_phones, '{}'::text[]))
      );

      perform net.http_post(
        url := 'https://n8n.srv961724.hstgr.cloud/webhook/order-taken-alert',
        body := v_payload,
        params := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    exception when others then
      raise notice 'order-taken-alert webhook failed for order %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
exception when others then
  raise notice 'notify_order_status_webhooks trigger failed for order %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke execute on function public.notify_order_status_webhooks() from public;
revoke execute on function public.notify_order_status_webhooks() from anon;
revoke execute on function public.notify_order_status_webhooks() from authenticated;

create trigger trg_notify_order_status_webhooks
after update on public.orders
for each row
execute function public.notify_order_status_webhooks();