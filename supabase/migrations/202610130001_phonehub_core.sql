-- PhoneHub phase 1: Supabase schema and access rules.
-- This migration creates NO live stock, sample orders, or payment transactions.
-- Prices are whole Kenyan shillings (KES), stored as integers.
-- Run in a Supabase project with auth.users and pgcrypto.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role = 'admin'),
  granted_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  brand text not null check (length(trim(brand)) between 1 and 80),
  name text not null check (length(trim(name)) between 1 and 150),
  description text not null default '',
  storage text not null default '',
  camera text not null default '',
  display text not null default '',
  image_url text,
  colors text[] not null default '{}',
  price_kes bigint not null check (price_kes > 0),
  compare_at_kes bigint check (compare_at_kes is null or compare_at_kes > 0),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_storefront_idx on public.products(is_published,brand,name);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  color text not null default '',
  quantity integer not null check (quantity between 1 and 20),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, color)
);
create index if not exists cart_items_user_idx on public.cart_items(user_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  customer_email text,
  customer_name text not null check (length(trim(customer_name)) between 1 and 120),
  phone text not null check (length(trim(phone)) between 5 and 30),
  delivery_city text not null check (length(trim(delivery_city)) between 1 and 120),
  delivery_address text not null check (length(trim(delivery_address)) between 5 and 500),
  currency char(3) not null default 'KES' check (currency = 'KES'),
  subtotal_kes bigint not null check (subtotal_kes >= 0),
  shipping_kes bigint not null default 0 check (shipping_kes >= 0),
  total_kes bigint generated always as (subtotal_kes + shipping_kes) stored,
  status text not null default 'pending_payment' check (status in ('pending_payment','paid','payment_failed','cancelled','fulfilled')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders(user_id,created_at desc);
create index if not exists orders_status_idx on public.orders(status,created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  color text not null default '',
  quantity integer not null check (quantity between 1 and 20),
  unit_price_kes bigint not null check (unit_price_kes > 0),
  line_total_kes bigint generated always as (quantity::bigint * unit_price_kes) stored
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null check (provider in ('stripe','paystack')),
  provider_reference text unique,
  status text not null check (status in ('pending','succeeded','failed','requires_action')),
  card_brand text,
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  card_type text,
  issuer_country text,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_attempts_order_idx on public.payment_attempts(order_id,created_at desc);

-- Read-only role check; no public/admin self-promotion route.
create or replace function public.is_phonehub_admin()
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.staff_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke all on function public.is_phonehub_admin() from public;
grant execute on function public.is_phonehub_admin() to anon, authenticated;

create or replace function public.phonehub_create_profile()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id,email)
  values(new.id,new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists phonehub_auth_user_created on auth.users;
create trigger phonehub_auth_user_created
after insert on auth.users
for each row execute function public.phonehub_create_profile();

create or replace function public.phonehub_set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists phonehub_profiles_updated on public.profiles;
create trigger phonehub_profiles_updated before update on public.profiles
for each row execute function public.phonehub_set_updated_at();
drop trigger if exists phonehub_products_updated on public.products;
create trigger phonehub_products_updated before update on public.products
for each row execute function public.phonehub_set_updated_at();
drop trigger if exists phonehub_cart_updated on public.cart_items;
create trigger phonehub_cart_updated before update on public.cart_items
for each row execute function public.phonehub_set_updated_at();
drop trigger if exists phonehub_orders_updated on public.orders;
create trigger phonehub_orders_updated before update on public.orders
for each row execute function public.phonehub_set_updated_at();

alter table public.profiles enable row level security;
alter table public.staff_roles enable row level security;
alter table public.products enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_attempts enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_phonehub_admin()));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists staff_roles_admin_read on public.staff_roles;
create policy staff_roles_admin_read on public.staff_roles for select to authenticated
using ((select public.is_phonehub_admin()));

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon,authenticated
using (is_published or (select public.is_phonehub_admin()));
drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert on public.products for insert to authenticated
with check ((select public.is_phonehub_admin()));
drop policy if exists products_admin_update on public.products;
create policy products_admin_update on public.products for update to authenticated
using ((select public.is_phonehub_admin())) with check ((select public.is_phonehub_admin()));
drop policy if exists products_admin_delete on public.products;
create policy products_admin_delete on public.products for delete to authenticated
using ((select public.is_phonehub_admin()));

drop policy if exists cart_read_self on public.cart_items;
create policy cart_read_self on public.cart_items for select to authenticated
using (user_id = (select auth.uid()));
drop policy if exists cart_insert_self on public.cart_items;
create policy cart_insert_self on public.cart_items for insert to authenticated
with check (user_id = (select auth.uid()));
drop policy if exists cart_update_self on public.cart_items;
create policy cart_update_self on public.cart_items for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists cart_delete_self on public.cart_items;
create policy cart_delete_self on public.cart_items for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists orders_read_self_or_admin on public.orders;
create policy orders_read_self_or_admin on public.orders for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_phonehub_admin()));
-- No authenticated INSERT, UPDATE or DELETE policies for orders. Checkout RPC only.
drop policy if exists order_items_read_self_or_admin on public.order_items;
create policy order_items_read_self_or_admin on public.order_items for select to authenticated
using (exists (
  select 1 from public.orders o where o.id = order_id
  and (o.user_id = (select auth.uid()) or (select public.is_phonehub_admin()))
));
-- Payment events may only be written using a future signature-verified service role webhook.
drop policy if exists payment_attempts_admin_read on public.payment_attempts;
create policy payment_attempts_admin_read on public.payment_attempts for select to authenticated
using ((select public.is_phonehub_admin()));

-- SECURITY DEFINER for server-calculated totals; no access to client-supplied prices.
-- Returns pending order ONLY. Payment cannot be asserted by the customer.
create or replace function public.phonehub_create_pending_order(
  p_name text, p_phone text, p_city text, p_address text
)
returns table(order_id uuid,total_kes bigint)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_valid integer;
  v_subtotal bigint;
  v_order uuid;
  v_email text;
begin
  if v_uid is null then raise exception 'Login required'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 120
    or length(trim(coalesce(p_phone,''))) not between 5 and 30
    or length(trim(coalesce(p_city,''))) not between 1 and 120
    or length(trim(coalesce(p_address,''))) not between 5 and 500
  then raise exception 'Invalid delivery details'; end if;

  -- Consistent lock order prevents product price/stock changes mid-snapshot.
  perform p.id from public.products p
  join public.cart_items c on c.product_id = p.id
  where c.user_id = v_uid
  order by p.id
  for update of p;

  select count(*)::integer,
         count(*) filter (where p.is_published and p.stock_qty >= c.quantity)::integer,
         coalesce(sum(p.price_kes * c.quantity),0)::bigint
    into v_count,v_valid,v_subtotal
  from public.cart_items c join public.products p on p.id = c.product_id
  where c.user_id = v_uid;
  if v_count = 0 then raise exception 'Cart is empty'; end if;
  if v_count <> v_valid then raise exception 'Cart contains unavailable or insufficient-stock products'; end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  insert into public.orders(user_id,customer_email,customer_name,phone,delivery_city,delivery_address,subtotal_kes)
  values (v_uid,v_email,trim(p_name),trim(p_phone),trim(p_city),trim(p_address),v_subtotal)
  returning id into v_order;

  insert into public.order_items(order_id,product_id,product_name,color,quantity,unit_price_kes)
  select v_order,p.id,p.name,c.color,c.quantity,p.price_kes
  from public.cart_items c join public.products p on p.id = c.product_id
  where c.user_id = v_uid;
  return query select v_order,v_subtotal;
end;
$$;
revoke all on function public.phonehub_create_pending_order(text,text,text,text) from public;
grant execute on function public.phonehub_create_pending_order(text,text,text,text) to authenticated;

comment on table public.payment_attempts is 'Provider-verified payment metadata only; never store PAN or CVV';
comment on function public.phonehub_create_pending_order(text,text,text,text) is 'Creates pending order with trusted catalog prices. Does not collect payment or mark order paid.';
