-- PhoneHub / client-owned Supabase / phase 3.
-- Run AFTER 202610130001_phonehub_core.sql and 202610130002_checkout_snapshot.sql.
-- No sample delivery zones, products, orders, cards or payment records are inserted.

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 2 and 120),
  fee_kes bigint not null default 0 check (fee_kes >= 0),
  estimated_days integer check (estimated_days between 1 and 60),
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists delivery_zones_enabled_idx on public.delivery_zones(is_enabled, name);
drop trigger if exists phonehub_delivery_zones_updated on public.delivery_zones;
create trigger phonehub_delivery_zones_updated before update on public.delivery_zones
for each row execute function public.phonehub_set_updated_at();

alter table public.delivery_zones enable row level security;
drop policy if exists delivery_zones_read on public.delivery_zones;
create policy delivery_zones_read on public.delivery_zones for select to anon, authenticated
using (is_enabled or (select public.is_phonehub_admin()));
drop policy if exists delivery_zones_insert on public.delivery_zones;
create policy delivery_zones_insert on public.delivery_zones for insert to authenticated
with check ((select public.is_phonehub_admin()));
drop policy if exists delivery_zones_update on public.delivery_zones;
create policy delivery_zones_update on public.delivery_zones for update to authenticated
using ((select public.is_phonehub_admin()))
with check ((select public.is_phonehub_admin()));
drop policy if exists delivery_zones_delete on public.delivery_zones;
create policy delivery_zones_delete on public.delivery_zones for delete to authenticated
using ((select public.is_phonehub_admin()));

alter table public.orders
  add column if not exists delivery_zone_id uuid references public.delivery_zones(id) on delete set null;

-- Reject the old 4-text-argument checkout RPC: a user must not bypass the
-- authoritative delivery-zone shipping fee by using the obsolete signature.
revoke all on function public.phonehub_create_pending_order(text,text,text,text)
  from public, anon, authenticated;
drop function if exists public.phonehub_create_pending_order(text,text,text,text);

create or replace function public.phonehub_create_pending_order(
  p_name text, p_phone text, p_address text, p_zone_id uuid
)
returns table(order_id uuid,total_kes bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_valid integer;
  v_subtotal bigint;
  v_order uuid;
  v_email text;
  v_lines jsonb;
  v_zone public.delivery_zones%rowtype;
begin
  if v_uid is null then raise exception 'Login required'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 120
    or length(trim(coalesce(p_phone,''))) not between 5 and 30
    or length(trim(coalesce(p_address,''))) not between 5 and 500
  then raise exception 'Invalid delivery details'; end if;

  select * into v_zone from public.delivery_zones
  where id = p_zone_id and is_enabled = true;
  if not found then raise exception 'Selected delivery zone is unavailable'; end if;

  -- Lock cart rows and catalog prices for a consistent unpaid snapshot.
  select count(*)::integer,
         count(*) filter(where s.is_published and s.stock_qty >= s.quantity)::integer,
         coalesce(sum(s.price_kes * s.quantity),0)::bigint,
         coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    into v_count,v_valid,v_subtotal,v_lines
  from (
    select c.product_id,c.color,c.quantity,p.name as product_name,
           p.price_kes,p.stock_qty,p.is_published
    from public.cart_items c
    join public.products p on p.id = c.product_id
    where c.user_id = v_uid
    order by p.id,c.id
    for update of p,c
  ) s;
  if v_count = 0 then raise exception 'Cart is empty'; end if;
  if v_count <> v_valid then raise exception 'Cart contains unavailable or insufficient-stock products'; end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  insert into public.orders(
    user_id,customer_email,customer_name,phone,delivery_city,delivery_address,
    delivery_zone_id,subtotal_kes,shipping_kes
  ) values (
    v_uid,v_email,trim(p_name),trim(p_phone),v_zone.name,trim(p_address),
    v_zone.id,v_subtotal,v_zone.fee_kes
  ) returning id into v_order;

  insert into public.order_items(
    order_id,product_id,product_name,color,quantity,unit_price_kes
  )
  select v_order,l.product_id,l.product_name,l.color,l.quantity,l.price_kes
  from jsonb_to_recordset(v_lines) as l(
    product_id uuid,color text,quantity integer,product_name text,
    price_kes bigint,stock_qty integer,is_published boolean
  );
  return query select v_order,(v_subtotal + v_zone.fee_kes);
end;
$$;
revoke all on function public.phonehub_create_pending_order(text,text,text,uuid)
  from public, anon;
grant execute on function public.phonehub_create_pending_order(text,text,text,uuid)
  to authenticated;

-- Public product photography: readable by shoppers, only administrators may write.
-- 5 MiB maximum each; MIME restrictions also enforced in the upload client.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('phonehub-product-images','phonehub-product-images',true,5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict(id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists phonehub_images_public_read on storage.objects;
create policy phonehub_images_public_read on storage.objects for select to anon,authenticated
using (bucket_id = 'phonehub-product-images');
drop policy if exists phonehub_images_admin_insert on storage.objects;
create policy phonehub_images_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'phonehub-product-images'
  and (select public.is_phonehub_admin()));
drop policy if exists phonehub_images_admin_update on storage.objects;
create policy phonehub_images_admin_update on storage.objects for update to authenticated
using (bucket_id = 'phonehub-product-images' and (select public.is_phonehub_admin()))
with check (bucket_id = 'phonehub-product-images' and (select public.is_phonehub_admin()));
drop policy if exists phonehub_images_admin_delete on storage.objects;
create policy phonehub_images_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'phonehub-product-images' and (select public.is_phonehub_admin()));

comment on table public.delivery_zones is
  'Explicit merchant-managed destinations and shipping fees. No sample zones inserted.';
