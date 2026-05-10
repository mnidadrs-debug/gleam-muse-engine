create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'moderator', 'user');
create type public.product_category as enum ('Vegetables', 'Fruits', 'Dairy', 'Bakery', 'Pantry');
create type public.measurement_unit as enum ('Kg', 'Liter', 'Piece', 'Pack');
create type public.order_status as enum ('new', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled');
create type public.payment_method as enum ('COD', 'Carnet');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  preferred_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.communes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  commune_id uuid not null references public.communes(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (commune_id, name)
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  store_name text not null,
  owner_name text,
  phone_number text not null unique,
  neighborhood_id uuid references public.neighborhoods(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cyclists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  phone_number text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cyclist_coverage (
  id uuid primary key default gen_random_uuid(),
  cyclist_id uuid not null references public.cyclists(id) on delete cascade,
  neighborhood_id uuid not null references public.neighborhoods(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (cyclist_id, neighborhood_id)
);

create table public.master_products (
  id uuid primary key default gen_random_uuid(),
  product_name text not null unique,
  category public.product_category not null,
  measurement_unit public.measurement_unit not null,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendor_products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  master_product_id uuid not null references public.master_products(id) on delete cascade,
  vendor_price numeric(12,2) not null default 0,
  is_available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, master_product_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  phone_number text unique,
  full_name text,
  saved_instructions text,
  neighborhood_id uuid references public.neighborhoods(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id),
  cyclist_id uuid references public.cyclists(id) on delete set null,
  neighborhood_id uuid references public.neighborhoods(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  delivery_notes text not null default '',
  payment_method public.payment_method not null default 'COD',
  status public.order_status not null default 'new',
  total_price numeric(12,2) not null default 0,
  item_count integer not null default 0,
  order_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index idx_neighborhoods_commune_id on public.neighborhoods(commune_id);
create index idx_vendors_neighborhood_id on public.vendors(neighborhood_id);
create index idx_cyclists_user_id on public.cyclists(user_id);
create index idx_vendor_products_vendor_id on public.vendor_products(vendor_id);
create index idx_vendor_products_master_product_id on public.vendor_products(master_product_id);
create index idx_orders_customer_user_id on public.orders(customer_user_id);
create index idx_orders_vendor_id on public.orders(vendor_id);
create index idx_orders_cyclist_id on public.orders(cyclist_id);
create index idx_orders_status_created_at on public.orders(status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger trg_communes_set_updated_at
before update on public.communes
for each row
execute function public.set_updated_at();

create trigger trg_neighborhoods_set_updated_at
before update on public.neighborhoods
for each row
execute function public.set_updated_at();

create trigger trg_vendors_set_updated_at
before update on public.vendors
for each row
execute function public.set_updated_at();

create trigger trg_cyclists_set_updated_at
before update on public.cyclists
for each row
execute function public.set_updated_at();

create trigger trg_master_products_set_updated_at
before update on public.master_products
for each row
execute function public.set_updated_at();

create trigger trg_vendor_products_set_updated_at
before update on public.vendor_products
for each row
execute function public.set_updated_at();

create trigger trg_customers_set_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

create trigger trg_orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.communes enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.vendors enable row level security;
alter table public.cyclists enable row level security;
alter table public.cyclist_coverage enable row level security;
alter table public.master_products enable row level security;
alter table public.vendor_products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;

create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id or public.has_role(auth.uid(), 'admin'))
with check (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

create policy "Users can view own roles"
on public.user_roles
for select
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Admins manage roles"
on public.user_roles
for all
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Public can view communes"
on public.communes
for select
using (true);

create policy "Public can view neighborhoods"
on public.neighborhoods
for select
using (true);

create policy "Public can view active master products"
on public.master_products
for select
using (is_active = true);

create policy "Public can view available vendor products"
on public.vendor_products
for select
using (is_available = true);

create policy "Vendors can view own profile rows"
on public.vendors
for select
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Vendors can update own profile rows"
on public.vendors
for update
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Admins insert and manage vendors"
on public.vendors
for all
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Cyclists can view own profile rows"
on public.cyclists
for select
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Cyclists can update own profile rows"
on public.cyclists
for update
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Admins insert and manage cyclists"
on public.cyclists
for all
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage cyclist coverage"
on public.cyclist_coverage
for all
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Vendors can read own inventory"
on public.vendor_products
for select
using (
  exists (
    select 1 from public.vendors v
    where v.id = vendor_products.vendor_id
      and v.user_id = auth.uid()
  ) or public.has_role(auth.uid(), 'admin')
);

create policy "Vendors can manage own inventory"
on public.vendor_products
for all
using (
  exists (
    select 1 from public.vendors v
    where v.id = vendor_products.vendor_id
      and v.user_id = auth.uid()
  ) or public.has_role(auth.uid(), 'admin')
)
with check (
  exists (
    select 1 from public.vendors v
    where v.id = vendor_products.vendor_id
      and v.user_id = auth.uid()
  ) or public.has_role(auth.uid(), 'admin')
);

create policy "Users manage own customer row"
on public.customers
for all
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Customers view own orders"
on public.orders
for select
using (
  customer_user_id = auth.uid()
  or public.has_role(auth.uid(), 'admin')
  or exists (
    select 1 from public.vendors v
    where v.id = orders.vendor_id
      and v.user_id = auth.uid()
  )
  or exists (
    select 1 from public.cyclists c
    where c.id = orders.cyclist_id
      and c.user_id = auth.uid()
  )
);

create policy "Customers create own orders"
on public.orders
for insert
with check (customer_user_id = auth.uid());

create policy "Vendors update their orders"
on public.orders
for update
using (
  exists (
    select 1 from public.vendors v
    where v.id = orders.vendor_id
      and v.user_id = auth.uid()
  ) or public.has_role(auth.uid(), 'admin')
)
with check (
  exists (
    select 1 from public.vendors v
    where v.id = orders.vendor_id
      and v.user_id = auth.uid()
  ) or public.has_role(auth.uid(), 'admin')
);

create policy "Cyclists update assigned orders"
on public.orders
for update
using (
  exists (
    select 1 from public.cyclists c
    where c.id = orders.cyclist_id
      and c.user_id = auth.uid()
  ) or public.has_role(auth.uid(), 'admin')
)
with check (
  exists (
    select 1 from public.cyclists c
    where c.id = orders.cyclist_id
      and c.user_id = auth.uid()
  ) or public.has_role(auth.uid(), 'admin')
);

revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.has_role(uuid, public.app_role) from anon;
revoke all on function public.has_role(uuid, public.app_role) from authenticated;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

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

REVOKE EXECUTE ON FUNCTION public.clear_vendor_carnet_debt(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_vendor_carnet_payment(uuid, text, numeric) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_delivery_and_apply_payment(uuid, uuid) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.clear_vendor_carnet_debt(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_vendor_carnet_payment(uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_delivery_and_apply_payment(uuid, uuid) TO service_role;

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

DROP POLICY IF EXISTS "Public read products bucket" ON storage.objects;

CREATE POLICY "Public read products images only"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'products'
  AND (storage.foldername(name))[1] = 'master-products'
);

alter table public.neighborhoods
add column if not exists delivery_fee numeric(12,2) not null default 0;

alter table public.neighborhoods
add column if not exists vendor_id uuid;

alter table public.neighborhoods
drop constraint if exists neighborhoods_vendor_id_fkey;

alter table public.neighborhoods
add constraint neighborhoods_vendor_id_fkey
foreign key (vendor_id)
references public.vendors(id)
on delete set null;

with ranked_vendor_territories as (
  select distinct on (v.neighborhood_id)
    v.id as vendor_id,
    v.neighborhood_id
  from public.vendors v
  where v.neighborhood_id is not null
  order by v.neighborhood_id, v.created_at asc, v.id asc
)
update public.neighborhoods n
set vendor_id = r.vendor_id
from ranked_vendor_territories r
where n.id = r.neighborhood_id
  and n.vendor_id is null;

create index if not exists idx_neighborhoods_vendor_id on public.neighborhoods(vendor_id);

drop index if exists public.idx_vendors_neighborhood_id;

alter table public.vendors
drop column if exists neighborhood_id;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS neighborhood_id uuid;

UPDATE public.profiles
SET full_name = COALESCE(NULLIF(full_name, ''), display_name)
WHERE full_name IS NULL OR full_name = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_id_fkey_auth_users'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey_auth_users
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_neighborhood_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_neighborhood_id_fkey
      FOREIGN KEY (neighborhood_id) REFERENCES public.neighborhoods(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_neighborhood_id ON public.profiles(neighborhood_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, display_name, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Admins manage profiles"
ON public.profiles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
ON public.profiles (phone)
WHERE phone IS NOT NULL;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_auth_code VARCHAR(6);

ALTER TABLE public.orders
ALTER COLUMN delivery_auth_code SET DEFAULT LPAD((FLOOR(RANDOM() * 1000000)::int)::text, 6, '0');

UPDATE public.orders
SET delivery_auth_code = LPAD((FLOOR(RANDOM() * 1000000)::int)::text, 6, '0')
WHERE delivery_auth_code IS NULL;

ALTER TABLE public.orders
ALTER COLUMN delivery_auth_code SET NOT NULL;

create table if not exists public.global_settings (
  id uuid primary key default gen_random_uuid(),
  global_delivery_fee numeric not null default 10,
  minimum_order_amount numeric not null default 50,
  free_delivery_threshold numeric not null default 500,
  marketplace_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.global_settings enable row level security;

create policy "Admins manage global settings"
on public.global_settings
for all
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Public can view global settings"
on public.global_settings
for select
using (true);

insert into public.global_settings (global_delivery_fee, minimum_order_amount, free_delivery_threshold, marketplace_active)
select 10, 50, 500, true
where not exists (select 1 from public.global_settings);

create trigger set_global_settings_updated_at
before update on public.global_settings
for each row
execute function public.set_updated_at();

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