-- Statuts de livraison et suivi public temps réel sans exposer les coordonnées.

alter table public."diego-orders"
  drop constraint if exists "diego-orders_status_check";
alter table public."diego-orders"
  add constraint "diego-orders_status_check"
  check (
    status in (
      'en_attente', 'preparation', 'pret', 'servi',
      'en_livraison', 'livre', 'annule'
    )
  );

alter table public."diego-order-events"
  drop constraint if exists "diego-order-events_status_check";
alter table public."diego-order-events"
  add constraint "diego-order-events_status_check"
  check (
    status in (
      'en_attente', 'preparation', 'pret', 'servi',
      'en_livraison', 'livre', 'annule'
    )
  );

create table if not exists public."diego-public-order-tracking" (
  order_id uuid primary key references public."diego-orders"(id) on delete cascade,
  order_number bigint not null unique,
  status text not null,
  channel text not null,
  total integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

insert into public."diego-public-order-tracking" (
  order_id, order_number, status, channel, total, created_at, updated_at
)
select id, order_number, status, channel, total, created_at, now()
from public."diego-orders"
on conflict (order_id) do update set
  order_number = excluded.order_number,
  status = excluded.status,
  channel = excluded.channel,
  total = excluded.total,
  created_at = excluded.created_at,
  updated_at = now();

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
    select 1
    from pg_publication_tables
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

notify pgrst, 'reload schema';
