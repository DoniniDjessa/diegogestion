-- Dépenses (finances) — revenus = commandes payées côté app.

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

notify pgrst, 'reload schema';
