-- Table client : commande web marque la table occupée ;
-- suivi public de la commande active liée à une table (tant qu'elle n'est pas vidée).

create or replace function public.diego_create_order(
  p_channel text,
  p_items jsonb,
  p_table_qr_token uuid default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_delivery_address text default null,
  p_scheduled_for timestamptz default null,
  p_note text default null
)
returns table (id uuid, order_number bigint, tracking_token uuid, total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_table_id uuid;
  v_expected integer;
  v_valid integer;
begin
  if p_channel not in ('table', 'emporter', 'livraison') then
    raise exception 'Invalid customer order channel';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  if p_channel = 'table' then
    select t.id into v_table_id
    from public."diego-restaurant-tables" t
    where t.qr_token = p_table_qr_token and t.active;

    if v_table_id is null then
      raise exception 'Invalid table QR code';
    end if;
  end if;

  v_expected := jsonb_array_length(p_items);

  select count(*) into v_valid
  from jsonb_to_recordset(p_items) as input(product_id uuid, quantity integer, note text)
  join public."diego-products" p on p.id = input.product_id
  where p.active and p.in_stock and input.quantity between 1 and 99;

  if v_valid <> v_expected then
    raise exception 'One or more products are invalid or unavailable';
  end if;

  insert into public."diego-orders" (
    customer_id,
    channel,
    restaurant_table_id,
    customer_name,
    customer_phone,
    delivery_address,
    scheduled_for,
    note
  )
  values (
    auth.uid(),
    p_channel,
    v_table_id,
    nullif(trim(p_customer_name), ''),
    nullif(trim(p_customer_phone), ''),
    nullif(trim(p_delivery_address), ''),
    p_scheduled_for,
    nullif(trim(p_note), '')
  )
  returning public."diego-orders".id into v_order_id;

  insert into public."diego-order-items" (
    order_id,
    product_id,
    product_name,
    unit_price,
    quantity,
    note
  )
  select
    v_order_id,
    p.id,
    p.name,
    p.price,
    input.quantity,
    nullif(trim(input.note), '')
  from jsonb_to_recordset(p_items) as input(product_id uuid, quantity integer, note text)
  join public."diego-products" p on p.id = input.product_id
  where p.active and p.in_stock;

  update public."diego-orders" o
  set
    subtotal = totals.amount,
    total = totals.amount
  from (
    select sum(oi.unit_price * oi.quantity)::integer as amount
    from public."diego-order-items" oi
    where oi.order_id = v_order_id
  ) totals
  where o.id = v_order_id;

  if v_table_id is not null then
    update public."diego-restaurant-tables"
    set status = 'occupee'
    where id = v_table_id;
  end if;

  return query
  select o.id, o.order_number, o.tracking_token, o.total
  from public."diego-orders" o
  where o.id = v_order_id;
end;
$$;

revoke all on function public.diego_create_order(
  text, jsonb, uuid, text, text, text, timestamptz, text
) from public;
grant execute on function public.diego_create_order(
  text, jsonb, uuid, text, text, text, timestamptz, text
) to anon, authenticated;

-- Commande active d'une table : disponible tant que la table n'est pas « libre ».
create or replace function public.diego_track_table_order(p_table_qr_token uuid)
returns table (
  id uuid,
  order_number bigint,
  status text,
  channel text,
  total integer,
  created_at timestamptz,
  table_status text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_table_id uuid;
  v_table_status text;
begin
  select t.id, t.status into v_table_id, v_table_status
  from public."diego-restaurant-tables" t
  where t.qr_token = p_table_qr_token and t.active;

  if v_table_id is null then
    return;
  end if;

  if v_table_status = 'libre' then
    return query
    select
      null::uuid,
      null::bigint,
      null::text,
      null::text,
      null::integer,
      null::timestamptz,
      v_table_status;
    return;
  end if;

  return query
  select
    o.id,
    o.order_number,
    o.status,
    o.channel,
    o.total,
    o.created_at,
    v_table_status
  from public."diego-orders" o
  where o.restaurant_table_id = v_table_id
    and o.status <> 'annule'
  order by o.created_at desc
  limit 1;
end;
$$;

revoke all on function public.diego_track_table_order(uuid) from public;
grant execute on function public.diego_track_table_order(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
