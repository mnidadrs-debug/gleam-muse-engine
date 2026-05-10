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