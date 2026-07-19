-- Les commandes POS passent en "Commander" : paiement en attente jusqu'à validation.
create or replace function public.diego_create_pos_order(
  p_channel text,
  p_items jsonb,
  p_payment_method text,
  p_restaurant_table_id uuid default null,
  p_note text default null
)
returns table (id uuid, order_number bigint, total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_expected integer;
  v_valid integer;
begin
  if auth.uid() is null or not public.diego_is_staff() then
    raise exception 'Staff authentication required';
  end if;

  if p_channel not in ('comptoir', 'table', 'emporter', 'livraison') then
    raise exception 'Invalid POS order channel';
  end if;

  if p_payment_method not in ('especes', 'mobile_money', 'carte') then
    raise exception 'Invalid payment method';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  if p_restaurant_table_id is not null then
    if not exists (
      select 1
      from public."diego-restaurant-tables" t
      where t.id = p_restaurant_table_id and t.active
    ) then
      raise exception 'Invalid restaurant table';
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
    channel,
    restaurant_table_id,
    payment_method,
    payment_status,
    note
  )
  values (
    p_channel,
    p_restaurant_table_id,
    p_payment_method,
    'en_attente',
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

  if p_restaurant_table_id is not null then
    update public."diego-restaurant-tables"
    set status = 'occupee'
    where id = p_restaurant_table_id;
  end if;

  return query
  select o.id, o.order_number, o.total
  from public."diego-orders" o
  where o.id = v_order_id;
end;
$$;
