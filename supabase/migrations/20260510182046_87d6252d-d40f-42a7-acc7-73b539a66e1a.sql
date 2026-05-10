create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_fr text,
  name_ar text,
  icon_name text,
  image_url text,
  accent_color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_ads (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  content_fr text,
  content_ar text,
  image_url text,
  link_url text,
  bg_color text,
  text_color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  content_fr text,
  content_ar text,
  image_url text,
  link_url text,
  bg_color text,
  text_color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_settings (
  id uuid primary key default gen_random_uuid(),
  store_name text,
  address text,
  phone text,
  tax_id text,
  footer_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.otp_requests (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  otp_code text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_carnet (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  customer_phone text not null,
  customer_name text,
  customer_cin text,
  current_debt numeric(12,2) not null default 0,
  max_limit numeric(12,2) not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, customer_phone)
);

create table if not exists public.carnet_payments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  customer_phone text not null,
  amount_paid numeric(12,2) not null,
  created_at timestamptz not null default now()
);

alter table public.master_products add column if not exists name_fr text;
alter table public.master_products add column if not exists name_ar text;
alter table public.master_products add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.master_products add column if not exists popularity_score integer not null default 0;

alter table public.vendor_products add column if not exists name_fr text;
alter table public.vendor_products add column if not exists name_ar text;
alter table public.vendor_products add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.vendor_products add column if not exists image_url text;
alter table public.vendor_products add column if not exists measurement_unit public.measurement_unit;
alter table public.vendor_products add column if not exists popularity_score integer not null default 0;
alter table public.vendor_products add column if not exists is_active boolean not null default true;
alter table public.vendor_products add column if not exists is_flash_sale boolean not null default false;
alter table public.vendor_products add column if not exists flash_sale_price numeric(12,2);
alter table public.vendor_products add column if not exists flash_sale_end_time timestamptz;

alter table public.orders add column if not exists delivery_fee numeric(12,2) not null default 0;

create or replace function public.complete_delivery_and_apply_payment(
  p_order_id uuid,
  p_cyclist_id uuid
)
returns table(order_id uuid, new_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_method public.payment_method;
  v_vendor_id uuid;
  v_customer_phone text;
  v_total numeric(12,2);
begin
  update public.orders
  set status = 'delivered', delivered_at = now(), updated_at = now()
  where id = p_order_id
    and cyclist_id = p_cyclist_id
    and status in ('ready', 'delivering')
  returning payment_method, vendor_id, customer_phone, total_price + delivery_fee
  into v_payment_method, v_vendor_id, v_customer_phone, v_total;

  if not found then
    raise exception 'Order not found or not assignable';
  end if;

  if v_payment_method = 'Carnet' then
    insert into public.vendor_carnet (vendor_id, customer_phone, current_debt, max_limit)
    values (v_vendor_id, v_customer_phone, v_total, 0)
    on conflict (vendor_id, customer_phone)
    do update set current_debt = public.vendor_carnet.current_debt + excluded.current_debt;
  end if;

  return query select p_order_id, 'delivered'::text;
end;
$$;

create or replace function public.clear_vendor_carnet_debt(
  p_vendor_id uuid,
  p_customer_phone text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.vendor_carnet
  set current_debt = 0,
      status = 'cleared',
      updated_at = now()
  where vendor_id = p_vendor_id and customer_phone = p_customer_phone;
$$;

create or replace function public.record_vendor_carnet_payment(
  p_vendor_id uuid,
  p_customer_phone text,
  p_amount numeric
)
returns table(payment_id uuid, remaining_debt numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_remaining numeric(12,2);
begin
  insert into public.carnet_payments(vendor_id, customer_phone, amount_paid)
  values (p_vendor_id, p_customer_phone, p_amount)
  returning id into v_payment_id;

  update public.vendor_carnet
  set current_debt = greatest(0, current_debt - p_amount),
      status = case when greatest(0, current_debt - p_amount) = 0 then 'cleared' else status end,
      updated_at = now()
  where vendor_id = p_vendor_id and customer_phone = p_customer_phone
  returning current_debt into v_remaining;

  return query select v_payment_id, coalesce(v_remaining, 0);
end;
$$;

alter table public.categories enable row level security;
alter table public.site_ads enable row level security;
alter table public.announcements enable row level security;
alter table public.invoice_settings enable row level security;
alter table public.otp_requests enable row level security;
alter table public.vendor_carnet enable row level security;
alter table public.carnet_payments enable row level security;

drop policy if exists "Public can view active categories" on public.categories;
create policy "Public can view active categories" on public.categories for select using (is_active = true);

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Public can view active site ads" on public.site_ads;
create policy "Public can view active site ads" on public.site_ads for select using (is_active = true);

drop policy if exists "Admins manage site ads" on public.site_ads;
create policy "Admins manage site ads" on public.site_ads for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Public can view active announcements" on public.announcements;
create policy "Public can view active announcements" on public.announcements for select using (is_active = true);

drop policy if exists "Admins manage announcements" on public.announcements;
create policy "Admins manage announcements" on public.announcements for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins manage invoice settings" on public.invoice_settings;
create policy "Admins manage invoice settings" on public.invoice_settings for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "No direct access to otp requests" on public.otp_requests;
create policy "No direct access to otp requests" on public.otp_requests for all using (false) with check (false);

insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

drop policy if exists "Public read products bucket" on storage.objects;
create policy "Public read products bucket" on storage.objects for select using (bucket_id = 'products');

drop policy if exists "Authenticated upload products bucket" on storage.objects;
create policy "Authenticated upload products bucket" on storage.objects for insert to authenticated with check (bucket_id = 'products');

revoke all on function public.complete_delivery_and_apply_payment(uuid, uuid) from public;
revoke all on function public.complete_delivery_and_apply_payment(uuid, uuid) from anon;
revoke all on function public.clear_vendor_carnet_debt(uuid, text) from public;
revoke all on function public.clear_vendor_carnet_debt(uuid, text) from anon;
revoke all on function public.record_vendor_carnet_payment(uuid, text, numeric) from public;
revoke all on function public.record_vendor_carnet_payment(uuid, text, numeric) from anon;
grant execute on function public.complete_delivery_and_apply_payment(uuid, uuid) to authenticated;
grant execute on function public.clear_vendor_carnet_debt(uuid, text) to authenticated;
grant execute on function public.record_vendor_carnet_payment(uuid, text, numeric) to authenticated;