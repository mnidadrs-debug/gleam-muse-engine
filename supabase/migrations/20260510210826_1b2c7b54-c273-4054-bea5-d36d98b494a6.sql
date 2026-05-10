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