alter table public.neighborhoods
add column if not exists delivery_fee numeric(12,2) not null default 0;