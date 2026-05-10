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