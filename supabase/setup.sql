-- =============================================================================
-- Diego — Script d'installation complet (à coller dans Supabase SQL Editor)
-- =============================================================================
-- Regroupe, dans l'ordre, tout le schéma nécessaire aux deux applications :
--   1. Schéma cœur (tables, triggers, RPC client, RLS, bucket, Realtime)
--   2. Données initiales du menu (produits + tables)
--   3. RPC d'encaissement POS (staff)
--   4. Catégories de menu gérées par l'utilisateur
--
-- Le script est idempotent : vous pouvez le relancer sans erreur.
-- IMPORTANT : les noms de table contiennent un tiret et sont toujours
-- entourés de guillemets doubles.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. SCHÉMA CŒUR
-- -----------------------------------------------------------------------------

-- Registre des utilisateurs Diego. Le projet Supabase est partagé entre
-- plusieurs applications : un email présent dans auth.users n'appartient pas
-- forcément à Diego. Cette table est la source de vérité des rôles.
create table if not exists public."diego-users" (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('superAdmin', 'admin', 'caissier', 'utilisateur')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SECURITY DEFINER contourne la RLS sur "diego-users" : les politiques qui
-- appellent ces fonctions ne bouclent pas.
create or replace function public.diego_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public."diego-users" u
  where u.id = auth.uid() and u.active;
$$;

create or replace function public.diego_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.diego_role() in ('superAdmin', 'admin', 'caissier'),
    false
  );
$$;

create or replace function public.diego_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.diego_role() in ('superAdmin', 'admin'),
    false
  );
$$;

create or replace function public.diego_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.diego_role() = 'superAdmin', false);
$$;

alter table public."diego-users" enable row level security;

drop policy if exists "diego-users-self-read" on public."diego-users";
create policy "diego-users-self-read"
on public."diego-users"
for select
to authenticated
using (id = auth.uid());

drop policy if exists "diego-users-admin-read" on public."diego-users";
create policy "diego-users-admin-read"
on public."diego-users"
for select
to authenticated
using (public.diego_is_admin());

drop policy if exists "diego-users-superadmin-manage" on public."diego-users";
create policy "diego-users-superadmin-manage"
on public."diego-users"
for all
to authenticated
using (public.diego_is_super_admin())
with check (public.diego_is_super_admin());

-- Reprise : importe les comptes déjà marqués d'un rôle Diego dans app_metadata.
insert into public."diego-users" (id, email, role)
select u.id, lower(u.email), u.raw_app_meta_data ->> 'role'
from auth.users u
where u.email is not null
  and u.raw_app_meta_data ->> 'role'
    in ('superAdmin', 'admin', 'caissier', 'utilisateur')
on conflict (id) do nothing;

-- Compte superAdmin initial (déjà présent dans auth.users).
insert into public."diego-users" (id, email, role)
select u.id, lower(u.email), 'superAdmin'
from auth.users u
where lower(u.email) = 'doninidjessa@gmail.com'
on conflict (id) do update set role = 'superAdmin', active = true;

create table if not exists public."diego-products" (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  slug text not null unique,
  name text not null,
  description text,
  category text not null,
  price integer not null check (price >= 0),
  emoji text not null default '🍽️',
  image_path text,
  active boolean not null default true,
  in_stock boolean not null default true,
  signature boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public."diego-restaurant-tables" (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  seats integer not null check (seats > 0),
  status text not null default 'libre' check (status in ('libre', 'occupee', 'reservee')),
  position_x numeric(5, 2) not null default 50 check (position_x between 0 and 100),
  position_y numeric(5, 2) not null default 50 check (position_y between 0 and 100),
  qr_token uuid not null unique default gen_random_uuid(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public."diego-orders" (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated by default as identity unique,
  customer_id uuid references auth.users(id) on delete set null,
  channel text not null check (channel in ('comptoir', 'table', 'emporter', 'livraison')),
  status text not null default 'en_attente' check (
    status in (
      'a_valider', 'en_attente', 'preparation', 'pret', 'servi',
      'en_livraison', 'livre', 'annule'
    )
  ),
  restaurant_table_id uuid references public."diego-restaurant-tables"(id) on delete set null,
  payment_method text check (payment_method in ('especes', 'mobile_money', 'carte')),
  payment_status text not null default 'en_attente' check (
    payment_status in ('en_attente', 'paye', 'echoue', 'rembourse')
  ),
  customer_name text,
  customer_phone text,
  delivery_address text,
  scheduled_for timestamptz,
  note text,
  subtotal integer not null default 0 check (subtotal >= 0),
  total integer not null default 0 check (total >= 0),
  tracking_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public."diego-order-items" (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public."diego-orders"(id) on delete cascade,
  product_id uuid references public."diego-products"(id) on delete set null,
  product_name text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 99),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public."diego-order-events" (
  id bigint generated by default as identity primary key,
  order_id uuid not null references public."diego-orders"(id) on delete cascade,
  status text not null check (
    status in (
      'a_valider', 'en_attente', 'preparation', 'pret', 'servi',
      'en_livraison', 'livre', 'annule'
    )
  ),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists "diego-products-category-active-idx"
  on public."diego-products"(category, active, in_stock, sort_order);
create index if not exists "diego-orders-status-created-idx"
  on public."diego-orders"(status, created_at);
create index if not exists "diego-orders-customer-idx"
  on public."diego-orders"(customer_id, created_at desc);
create index if not exists "diego-order-items-order-idx"
  on public."diego-order-items"(order_id);
create index if not exists "diego-order-events-order-idx"
  on public."diego-order-events"(order_id, created_at);

create or replace function public.diego_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists "diego-users-updated-at" on public."diego-users";
create trigger "diego-users-updated-at"
before update on public."diego-users"
for each row execute function public.diego_set_updated_at();

drop trigger if exists "diego-products-updated-at" on public."diego-products";
create trigger "diego-products-updated-at"
before update on public."diego-products"
for each row execute function public.diego_set_updated_at();

drop trigger if exists "diego-tables-updated-at" on public."diego-restaurant-tables";
create trigger "diego-tables-updated-at"
before update on public."diego-restaurant-tables"
for each row execute function public.diego_set_updated_at();

drop trigger if exists "diego-orders-updated-at" on public."diego-orders";
create trigger "diego-orders-updated-at"
before update on public."diego-orders"
for each row execute function public.diego_set_updated_at();

create or replace function public.diego_log_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public."diego-order-events" (order_id, status, actor_id)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists "diego-orders-log-status" on public."diego-orders";
create trigger "diego-orders-log-status"
after insert or update of status on public."diego-orders"
for each row execute function public.diego_log_order_status();

-- Encaissement client atomique. Prix et noms proviennent toujours de la base.
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
    status,
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
    'a_valider',
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

-- Suivi de commande public par numéro : colonnes limitées, aucune donnée client.
create or replace function public.diego_track_order(p_order_number bigint)
returns table (
  id uuid,
  order_number bigint,
  status text,
  channel text,
  total integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select o.id, o.order_number, o.status, o.channel, o.total, o.created_at
  from public."diego-orders" o
  where o.order_number = p_order_number;
$$;

revoke all on function public.diego_track_order(bigint) from public;
grant execute on function public.diego_track_order(bigint) to anon, authenticated;

alter table public."diego-products" enable row level security;
alter table public."diego-restaurant-tables" enable row level security;
alter table public."diego-orders" enable row level security;
alter table public."diego-order-items" enable row level security;
alter table public."diego-order-events" enable row level security;

drop policy if exists "Public can view active Diego products" on public."diego-products";
create policy "Public can view active Diego products"
on public."diego-products" for select
to anon, authenticated
using (active);

drop policy if exists "Staff manage Diego products" on public."diego-products";
create policy "Staff manage Diego products"
on public."diego-products" for all
to authenticated
using (public.diego_is_admin())
with check (public.diego_is_admin());

drop policy if exists "Authenticated users view active Diego tables" on public."diego-restaurant-tables";
create policy "Authenticated users view active Diego tables"
on public."diego-restaurant-tables" for select
to authenticated
using (active);

-- Scan QR sans compte : les visiteurs anonymes lisent les tables actives.
drop policy if exists "Anyone can view active Diego tables" on public."diego-restaurant-tables";
create policy "Anyone can view active Diego tables"
on public."diego-restaurant-tables" for select
to anon
using (active);

drop policy if exists "Staff manage Diego tables" on public."diego-restaurant-tables";
create policy "Staff manage Diego tables"
on public."diego-restaurant-tables" for all
to authenticated
using (public.diego_is_admin())
with check (public.diego_is_admin());

drop policy if exists "Customers view their Diego orders" on public."diego-orders";
create policy "Customers view their Diego orders"
on public."diego-orders" for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "Staff manage Diego orders" on public."diego-orders";
create policy "Staff manage Diego orders"
on public."diego-orders" for all
to authenticated
using (public.diego_is_staff())
with check (public.diego_is_staff());

drop policy if exists "Customers view their Diego order items" on public."diego-order-items";
create policy "Customers view their Diego order items"
on public."diego-order-items" for select
to authenticated
using (
  exists (
    select 1
    from public."diego-orders" o
    where o.id = order_id and o.customer_id = auth.uid()
  )
);

drop policy if exists "Staff manage Diego order items" on public."diego-order-items";
create policy "Staff manage Diego order items"
on public."diego-order-items" for all
to authenticated
using (public.diego_is_staff())
with check (public.diego_is_staff());

drop policy if exists "Customers view their Diego order events" on public."diego-order-events";
create policy "Customers view their Diego order events"
on public."diego-order-events" for select
to authenticated
using (
  exists (
    select 1
    from public."diego-orders" o
    where o.id = order_id and o.customer_id = auth.uid()
  )
);

drop policy if exists "Staff view Diego order events" on public."diego-order-events";
create policy "Staff view Diego order events"
on public."diego-order-events" for select
to authenticated
using (public.diego_is_staff());

-- Bucket de stockage (nom fourni par le propriétaire du projet).
insert into storage.buckets (id, name, public)
values ('diego bucket', 'diego bucket', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can view Diego media" on storage.objects;
create policy "Public can view Diego media"
on storage.objects for select
to public
using (bucket_id = 'diego bucket');

drop policy if exists "Staff upload Diego media" on storage.objects;
create policy "Staff upload Diego media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'diego bucket' and public.diego_is_admin());

drop policy if exists "Staff update Diego media" on storage.objects;
create policy "Staff update Diego media"
on storage.objects for update
to authenticated
using (bucket_id = 'diego bucket' and public.diego_is_admin())
with check (bucket_id = 'diego bucket' and public.diego_is_admin());

drop policy if exists "Staff delete Diego media" on storage.objects;
create policy "Staff delete Diego media"
on storage.objects for delete
to authenticated
using (bucket_id = 'diego bucket' and public.diego_is_admin());

-- Publication Realtime (ajout idempotent).
do $$
declare
  t text;
begin
  foreach t in array array[
    'diego-products',
    'diego-restaurant-tables',
    'diego-orders',
    'diego-order-items',
    'diego-order-events',
    'diego-menu-categories'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = t
       )
    then
      execute format(
        'alter publication supabase_realtime add table public.%I', t
      );
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. CATÉGORIES DE MENU (créées avant le seed pour satisfaire la clé étrangère)
-- -----------------------------------------------------------------------------

create table if not exists public."diego-menu-categories" (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Catégories fixes du menu Diego (upsert idempotent).
insert into public."diego-menu-categories" (slug, label, sort_order, active)
values
  ('cuisine-africaine',  'Cuisine Africaine',   10, true),
  ('cuisine-europeenne', 'Cuisine Européenne',  20, true),
  ('cuisine-americaine', 'Cuisine Américaine',  30, true),
  ('accompagnements',    'Accompagnements',     40, true),
  ('cocktails',          'Cocktails',           50, true),
  ('vins',               'Vins',                60, true),
  ('spiritueux-bieres',  'Spiritueux & Bières', 70, true),
  ('softs-jus',          'Softs & Jus',         80, true),
  ('boissons-chaudes',   'Boissons Chaudes',    90, true)
on conflict (slug) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    active = true;

alter table public."diego-products"
  drop constraint if exists "diego-products_category_check";
alter table public."diego-products"
  drop constraint if exists "diego-products-category-fkey";
alter table public."diego-products"
  add constraint "diego-products-category-fkey"
  foreign key (category)
  references public."diego-menu-categories"(slug)
  on update cascade;

drop trigger if exists "diego-menu-categories-updated-at"
  on public."diego-menu-categories";
create trigger "diego-menu-categories-updated-at"
before update on public."diego-menu-categories"
for each row execute function public.diego_set_updated_at();

alter table public."diego-menu-categories" enable row level security;

drop policy if exists "diego-menu-categories-public-read"
  on public."diego-menu-categories";
create policy "diego-menu-categories-public-read"
on public."diego-menu-categories"
for select
to anon, authenticated
using (active = true or public.diego_is_staff());

drop policy if exists "diego-menu-categories-staff-manage"
  on public."diego-menu-categories";
create policy "diego-menu-categories-staff-manage"
on public."diego-menu-categories"
for all
to authenticated
using (public.diego_is_admin())
with check (public.diego_is_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'diego-menu-categories'
  ) then
    execute 'alter publication supabase_realtime add table public."diego-menu-categories"';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. AUCUNE DONNÉE MOCK
-- -----------------------------------------------------------------------------
-- Les catégories, produits et tables sont entièrement gérés par
-- l'utilisateur depuis Diego Gestion.

-- -----------------------------------------------------------------------------
-- 4. ENCAISSEMENT POS (staff)
-- -----------------------------------------------------------------------------

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

revoke all on function public.diego_create_pos_order(
  text, jsonb, text, uuid, text
) from public;
grant execute on function public.diego_create_pos_order(
  text, jsonb, text, uuid, text
) to authenticated;

-- Suivi public temps réel : aucune coordonnée client dans cette table.
create table if not exists public."diego-public-order-tracking" (
  order_id uuid primary key references public."diego-orders"(id) on delete cascade,
  order_number bigint not null unique,
  status text not null,
  channel text not null,
  total integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create or replace function public.diego_sync_public_order_tracking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public."diego-public-order-tracking" (
    order_id, order_number, status, channel, total, created_at, updated_at
  )
  values (
    new.id, new.order_number, new.status, new.channel,
    new.total, new.created_at, now()
  )
  on conflict (order_id) do update set
    order_number = excluded.order_number,
    status = excluded.status,
    channel = excluded.channel,
    total = excluded.total,
    created_at = excluded.created_at,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists "diego-sync-public-tracking" on public."diego-orders";
create trigger "diego-sync-public-tracking"
after insert or update of status, channel, total on public."diego-orders"
for each row execute function public.diego_sync_public_order_tracking();

insert into public."diego-public-order-tracking" (
  order_id, order_number, status, channel, total, created_at, updated_at
)
select id, order_number, status, channel, total, created_at, now()
from public."diego-orders"
on conflict (order_id) do update set
  status = excluded.status,
  channel = excluded.channel,
  total = excluded.total,
  updated_at = now();

alter table public."diego-public-order-tracking" enable row level security;
drop policy if exists "Public reads Diego order tracking"
  on public."diego-public-order-tracking";
create policy "Public reads Diego order tracking"
on public."diego-public-order-tracking" for select
to anon, authenticated
using (true);
grant select on public."diego-public-order-tracking" to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'diego-public-order-tracking'
  ) then
    alter publication supabase_realtime
      add table public."diego-public-order-tracking";
  end if;
end;
$$;

create or replace function public.diego_track_order(p_order_number bigint)
returns table (
  id uuid,
  order_number bigint,
  status text,
  channel text,
  total integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.order_id, t.order_number, t.status, t.channel, t.total, t.created_at
  from public."diego-public-order-tracking" t
  where t.order_number = p_order_number;
$$;

revoke all on function public.diego_track_order(bigint) from public;
grant execute on function public.diego_track_order(bigint) to anon, authenticated;

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

create or replace function public.diego_replace_pending_order_items(
  p_order_id uuid,
  p_items jsonb,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_expected integer;
  v_valid integer;
begin
  if not public.diego_is_staff() then
    raise exception 'Staff only';
  end if;

  select o.status into v_status
  from public."diego-orders" o
  where o.id = p_order_id;

  if v_status is null then
    raise exception 'Order not found';
  end if;

  if v_status <> 'a_valider' then
    raise exception 'Only pending web orders can be edited';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  v_expected := jsonb_array_length(p_items);

  select count(*) into v_valid
  from jsonb_to_recordset(p_items) as input(product_id uuid, quantity integer, note text)
  join public."diego-products" p on p.id = input.product_id
  where p.active and input.quantity between 1 and 99;

  if v_valid <> v_expected then
    raise exception 'One or more products are invalid';
  end if;

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

  update public."diego-orders" o
  set
    note = nullif(trim(p_note), ''),
    subtotal = totals.amount,
    total = totals.amount
  from (
    select sum(oi.unit_price * oi.quantity)::integer as amount
    from public."diego-order-items" oi
    where oi.order_id = p_order_id
  ) totals
  where o.id = p_order_id;
end;
$$;

revoke all on function public.diego_replace_pending_order_items(uuid, jsonb, text) from public;
grant execute on function public.diego_replace_pending_order_items(uuid, jsonb, text) to authenticated;

create or replace function public.diego_validate_customer_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.diego_is_staff() then
    raise exception 'Staff only';
  end if;

  select o.status into v_status
  from public."diego-orders" o
  where o.id = p_order_id;

  if v_status is null then
    raise exception 'Order not found';
  end if;

  if v_status <> 'a_valider' then
    raise exception 'Order is not pending validation';
  end if;

  update public."diego-orders"
  set status = 'en_attente'
  where id = p_order_id;
end;
$$;

revoke all on function public.diego_validate_customer_order(uuid) from public;
grant execute on function public.diego_validate_customer_order(uuid) to authenticated;

-- Table de démo pour tester le parcours client.
insert into public."diego-restaurant-tables" (
  label, seats, status, position_x, position_y, qr_token, active
)
values (
  'Table Test', 4, 'libre', 20, 20,
  'a0000000-0000-4000-8000-000000000001'::uuid, true
)
on conflict (label) do update set
  qr_token = excluded.qr_token,
  seats = excluded.seats,
  active = true,
  updated_at = now();

-- Dépenses (finances)
create table if not exists public."diego-expenses" (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  amount integer not null check (amount > 0),
  category text,
  note text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists "diego-expenses-date-idx"
  on public."diego-expenses"(expense_date desc, created_at desc);

alter table public."diego-expenses" enable row level security;

drop policy if exists "Staff view Diego expenses" on public."diego-expenses";
create policy "Staff view Diego expenses"
on public."diego-expenses" for select
to authenticated
using (public.diego_is_staff());

drop policy if exists "Admins manage Diego expenses" on public."diego-expenses";
create policy "Admins manage Diego expenses"
on public."diego-expenses" for all
to authenticated
using (public.diego_is_admin())
with check (public.diego_is_admin());

-- Stock quantité boissons
alter table public."diego-products"
  add column if not exists stock_qty integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'diego-products_stock_qty_check'
  ) then
    alter table public."diego-products"
      add constraint "diego-products_stock_qty_check" check (stock_qty >= 0);
  end if;
end $$;

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

-- =============================================================================
-- Fin du script. Rechargez les applications : le menu, les tables et les
-- catégories doivent maintenant s'afficher.
-- =============================================================================
