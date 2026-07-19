-- Diego application users registry.
-- The Supabase project is shared by several apps: an email present in
-- auth.users does not necessarily belong to Diego. Membership and role are
-- now driven by public."diego-users", which becomes the source of truth for
-- diego_role() and therefore for every RLS policy.

create table if not exists public."diego-users" (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('superAdmin', 'admin', 'caissier', 'utilisateur')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists "diego-users-updated-at" on public."diego-users";
create trigger "diego-users-updated-at"
before update on public."diego-users"
for each row execute function public.diego_set_updated_at();

-- diego_role() now reads the Diego users table instead of the JWT metadata.
-- SECURITY DEFINER bypasses RLS on "diego-users", so policies that call the
-- role helpers do not recurse.
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

-- Backfill: import accounts already tagged with a Diego role in app_metadata.
insert into public."diego-users" (id, email, role)
select u.id, lower(u.email), u.raw_app_meta_data ->> 'role'
from auth.users u
where u.email is not null
  and u.raw_app_meta_data ->> 'role'
    in ('superAdmin', 'admin', 'caissier', 'utilisateur')
on conflict (id) do nothing;

-- Register doninidjessa@gmail.com (already present in auth) as superAdmin.
insert into public."diego-users" (id, email, role)
select u.id, lower(u.email), 'superAdmin'
from auth.users u
where lower(u.email) = 'doninidjessa@gmail.com'
on conflict (id) do update set role = 'superAdmin', active = true;

-- Keep the JWT metadata aligned for observability (not used by RLS anymore).
update auth.users
set raw_app_meta_data = jsonb_set(
  coalesce(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"superAdmin"'
)
where lower(email) = 'doninidjessa@gmail.com';
