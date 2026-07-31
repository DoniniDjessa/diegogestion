-- Assure que diego_role() lit diego-users (pas le JWT),
-- pour que superAdmin / admin / caissier puissent encaisser en caisse.

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

-- Si le compte est dans auth mais pas encore dans diego-users, on ne le crée pas
-- automatiquement ici : il doit déjà y être. On réactive juste le superAdmin connu.
insert into public."diego-users" (id, email, role, active)
select u.id, lower(u.email), 'superAdmin', true
from auth.users u
where lower(u.email) = 'doninidjessa@gmail.com'
on conflict (id) do update set
  role = 'superAdmin',
  active = true,
  email = excluded.email;

notify pgrst, 'reload schema';
