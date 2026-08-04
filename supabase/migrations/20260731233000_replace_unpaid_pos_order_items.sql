-- Allow staff to edit unpaid POS sales (add/remove items) before payment.

create or replace function public.diego_replace_unpaid_pos_order_items(
  p_order_id uuid,
  p_items jsonb,
  p_note text default null,
  p_payment_method text default null,
  p_restaurant_table_id uuid default null,
  p_channel text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_status text;
  v_status text;
  v_previous_table_id uuid;
  v_expected integer;
  v_valid integer;
  v_total integer;
  v_channel text;
  v_next_table_id uuid;
begin
  if not public.diego_is_staff() then
    raise exception 'Staff only';
  end if;

  select o.payment_status, o.status, o.restaurant_table_id, o.channel
    into v_payment_status, v_status, v_previous_table_id, v_channel
  from public."diego-orders" o
  where o.id = p_order_id
  for update;

  if v_payment_status is null then
    raise exception 'Order not found';
  end if;

  if v_status = 'annule' then
    raise exception 'Cancelled orders cannot be edited';
  end if;

  if v_payment_status <> 'en_attente' then
    raise exception 'Only unpaid sales can be edited';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  if p_channel is not null and p_channel not in ('table', 'livraison', 'emporter') then
    raise exception 'Invalid channel';
  end if;

  if p_payment_method is not null
     and p_payment_method not in ('especes', 'mobile_money', 'carte') then
    raise exception 'Invalid payment method';
  end if;

  v_expected := jsonb_array_length(p_items);

  select count(*) into v_valid
  from jsonb_to_recordset(p_items) as input(product_id uuid, quantity integer, note text)
  join public."diego-products" p on p.id = input.product_id
  where p.active and input.quantity between 1 and 99;

  if v_valid <> v_expected then
    raise exception 'One or more products are invalid';
  end if;

  v_channel := coalesce(p_channel, v_channel);
  v_next_table_id := case
    when v_channel = 'livraison' then null
    else p_restaurant_table_id
  end;

  delete from public."diego-order-items" where order_id = p_order_id;

  insert into public."diego-order-items" (
    order_id,
    product_id,
    product_name,
    unit_price,
    quantity,
    note
  )
  select
    p_order_id,
    p.id,
    p.name,
    p.price,
    input.quantity,
    nullif(trim(input.note), '')
  from jsonb_to_recordset(p_items) as input(product_id uuid, quantity integer, note text)
  join public."diego-products" p on p.id = input.product_id
  where p.active;

  select coalesce(sum(oi.unit_price * oi.quantity), 0)::integer
    into v_total
  from public."diego-order-items" oi
  where oi.order_id = p_order_id;

  update public."diego-orders" o
  set
    note = case
      when p_note is null then o.note
      else nullif(trim(p_note), '')
    end,
    payment_method = coalesce(p_payment_method, o.payment_method),
    channel = v_channel,
    restaurant_table_id = v_next_table_id,
    subtotal = v_total,
    total = v_total
  where o.id = p_order_id;

  if v_previous_table_id is not null
     and v_previous_table_id is distinct from v_next_table_id
  then
    update public."diego-restaurant-tables"
    set status = 'libre'
    where id = v_previous_table_id
      and not exists (
        select 1
        from public."diego-orders" o2
        where o2.restaurant_table_id = v_previous_table_id
          and o2.id <> p_order_id
          and o2.status <> 'annule'
          and o2.payment_status = 'en_attente'
      );
  end if;

  if v_next_table_id is not null then
    update public."diego-restaurant-tables"
    set status = 'occupee'
    where id = v_next_table_id;
  end if;

  return v_total;
end;
$$;

revoke all on function public.diego_replace_unpaid_pos_order_items(uuid, jsonb, text, text, uuid, text) from public;
grant execute on function public.diego_replace_unpaid_pos_order_items(uuid, jsonb, text, text, uuid, text) to authenticated;
