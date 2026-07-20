-- Reçu client : liste des articles + prix (sans étapes de suivi).

create or replace function public.diego_customer_order_receipt(p_order_number bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', o.id,
    'orderNumber', o.order_number,
    'status', o.status,
    'channel', o.channel,
    'total', o.total,
    'createdAt', o.created_at,
    'tableStatus', null,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', oi.product_name,
          'quantity', oi.quantity,
          'unitPrice', oi.unit_price,
          'lineTotal', oi.unit_price * oi.quantity,
          'note', oi.note
        )
        order by oi.created_at
      )
      from public."diego-order-items" oi
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  into v_result
  from public."diego-orders" o
  where o.order_number = p_order_number;

  return v_result;
end;
$$;

revoke all on function public.diego_customer_order_receipt(bigint) from public;
grant execute on function public.diego_customer_order_receipt(bigint) to anon, authenticated;

-- Reçu table : tous les plats commandés tant que la table n'est pas vidée.
create or replace function public.diego_customer_table_receipt(p_table_qr_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_table_id uuid;
  v_table_status text;
  v_order_id uuid;
  v_order_number bigint;
  v_status text;
  v_channel text;
  v_created_at timestamptz;
  v_total integer;
  v_items jsonb;
begin
  select t.id, t.status into v_table_id, v_table_status
  from public."diego-restaurant-tables" t
  where t.qr_token = p_table_qr_token and t.active;

  if v_table_id is null then
    return null;
  end if;

  if v_table_status = 'libre' then
    return jsonb_build_object(
      'id', null,
      'orderNumber', null,
      'status', null,
      'channel', 'table',
      'total', 0,
      'createdAt', null,
      'tableStatus', 'libre',
      'items', '[]'::jsonb
    );
  end if;

  select
    o.id,
    o.order_number,
    o.status,
    o.channel,
    o.created_at
  into
    v_order_id,
    v_order_number,
    v_status,
    v_channel,
    v_created_at
  from public."diego-orders" o
  where o.restaurant_table_id = v_table_id
    and o.status <> 'annule'
  order by o.created_at desc
  limit 1;

  if v_order_id is null then
    return jsonb_build_object(
      'id', null,
      'orderNumber', null,
      'status', null,
      'channel', 'table',
      'total', 0,
      'createdAt', null,
      'tableStatus', v_table_status,
      'items', '[]'::jsonb
    );
  end if;

  select
    coalesce(sum(oi.unit_price * oi.quantity), 0)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', oi.product_name,
          'quantity', oi.quantity,
          'unitPrice', oi.unit_price,
          'lineTotal', oi.unit_price * oi.quantity,
          'note', oi.note
        )
        order by oi.created_at
      ),
      '[]'::jsonb
    )
  into v_total, v_items
  from public."diego-order-items" oi
  join public."diego-orders" o on o.id = oi.order_id
  where o.restaurant_table_id = v_table_id
    and o.status <> 'annule';

  return jsonb_build_object(
    'id', v_order_id,
    'orderNumber', v_order_number,
    'status', v_status,
    'channel', coalesce(v_channel, 'table'),
    'total', v_total,
    'createdAt', v_created_at,
    'tableStatus', v_table_status,
    'items', v_items
  );
end;
$$;

revoke all on function public.diego_customer_table_receipt(uuid) from public;
grant execute on function public.diego_customer_table_receipt(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
