-- Stock quantité boissons + décrément auto à l'encaissement.

alter table public."diego-products"
  add column if not exists stock_qty integer not null default 0
  check (stock_qty >= 0);

-- Initialise le stock des boissons déjà marquées disponibles.
update public."diego-products"
set stock_qty = 50
where category in (
  'cocktails',
  'vins',
  'spiritueux-bieres',
  'softs-jus',
  'boissons-chaudes'
)
and in_stock = true
and stock_qty = 0;

update public."diego-products"
set stock_qty = 0,
    in_stock = false
where category in (
  'cocktails',
  'vins',
  'spiritueux-bieres',
  'softs-jus',
  'boissons-chaudes'
)
and in_stock = false;

create or replace function public.diego_is_drink_category(p_category text)
returns boolean
language sql
immutable
as $$
  select p_category in (
    'cocktails',
    'vins',
    'spiritueux-bieres',
    'softs-jus',
    'boissons-chaudes'
  );
$$;

-- Admin : fixe la quantité boisson (+ sync in_stock).
create or replace function public.diego_set_drink_stock_qty(
  p_product_id uuid,
  p_qty integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
begin
  if auth.uid() is null or not public.diego_is_admin() then
    raise exception 'Admin only';
  end if;

  if p_qty is null or p_qty < 0 then
    raise exception 'Invalid stock quantity';
  end if;

  select category into v_category
  from public."diego-products"
  where id = p_product_id and active;

  if v_category is null then
    raise exception 'Product not found';
  end if;

  if not public.diego_is_drink_category(v_category) then
    raise exception 'Stock quantity is only for drinks';
  end if;

  update public."diego-products"
  set
    stock_qty = p_qty,
    in_stock = (p_qty > 0),
    updated_at = now()
  where id = p_product_id;
end;
$$;

revoke all on function public.diego_set_drink_stock_qty(uuid, integer) from public;
grant execute on function public.diego_set_drink_stock_qty(uuid, integer) to authenticated;

-- Décrémente le stock boissons quand une commande passe à payé.
create or replace function public.diego_decrement_drink_stock_on_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paye'
     and coalesce(old.payment_status, '') is distinct from 'paye'
  then
    update public."diego-products" p
    set
      stock_qty = greatest(0, p.stock_qty - oi.qty),
      in_stock = greatest(0, p.stock_qty - oi.qty) > 0,
      updated_at = now()
    from (
      select product_id, sum(quantity)::integer as qty
      from public."diego-order-items"
      where order_id = new.id
        and product_id is not null
      group by product_id
    ) oi
    where p.id = oi.product_id
      and public.diego_is_drink_category(p.category);
  end if;

  return new;
end;
$$;

drop trigger if exists "diego-orders-decrement-drink-stock"
  on public."diego-orders";
create trigger "diego-orders-decrement-drink-stock"
after update of payment_status on public."diego-orders"
for each row
execute function public.diego_decrement_drink_stock_on_paid();

notify pgrst, 'reload schema';
