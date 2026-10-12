-- Phase 1 hardening: atomically snapshot locked cart lines at checkout.
-- No data is touched by this change; replaces a function and narrows profile edits.
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
  v_lines jsonb;
begin
  if v_uid is null then raise exception 'Login required'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 120
    or length(trim(coalesce(p_phone,''))) not between 5 and 30
    or length(trim(coalesce(p_city,''))) not between 1 and 120
    or length(trim(coalesce(p_address,''))) not between 5 and 500
  then raise exception 'Invalid delivery details'; end if;

  -- Lock the selected cart rows AND product rows, then use one snapshot for
  -- both the trusted order total and its order lines.
  select count(*)::integer,
         count(*) filter(where s.is_published and s.stock_qty >= s.quantity)::integer,
         coalesce(sum(s.price_kes * s.quantity),0)::bigint,
         coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    into v_count,v_valid,v_subtotal,v_lines
  from (
    select c.product_id, c.color, c.quantity, p.name as product_name,
           p.price_kes, p.stock_qty, p.is_published
    from public.cart_items c
    join public.products p on p.id = c.product_id
    where c.user_id = v_uid
    order by p.id, c.id
    for update of p,c
  ) s;

  if v_count = 0 then raise exception 'Cart is empty'; end if;
  if v_count <> v_valid then
    raise exception 'Cart contains unavailable or insufficient-stock products';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  insert into public.orders(user_id,customer_email,customer_name,phone,delivery_city,delivery_address,subtotal_kes)
  values(v_uid,v_email,trim(p_name),trim(p_phone),trim(p_city),trim(p_address),v_subtotal)
  returning id into v_order;

  insert into public.order_items(order_id,product_id,product_name,color,quantity,unit_price_kes)
  select v_order, l.product_id, l.product_name, l.color, l.quantity, l.price_kes
  from jsonb_to_recordset(v_lines) as l(
    product_id uuid, color text, quantity integer, product_name text,
    price_kes bigint, stock_qty integer, is_published boolean
  );
  return query select v_order,v_subtotal;
end;
$$;
revoke all on function public.phonehub_create_pending_order(text,text,text,text) from public;
grant execute on function public.phonehub_create_pending_order(text,text,text,text) to authenticated;

-- Users may edit their display name, but not impersonate another email.
-- Supabase grants table privileges by default; narrow update privilege here.
revoke update on public.profiles from anon,authenticated;
grant update (display_name) on public.profiles to authenticated;
