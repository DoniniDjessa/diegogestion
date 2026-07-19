-- =============================================================================
-- Réparation / vérification de la table diego-users
-- À coller tel quel dans le SQL Editor Supabase.
-- =============================================================================

-- 1. Force PostgREST à recharger son cache de schéma. Sans cela, une table
--    créée récemment reste invisible pour l'API REST utilisée par les apps
--    (erreur « relation not found in schema cache »).
notify pgrst, 'reload schema';

-- 2. Ré-affirme les politiques RLS de diego-users (sans effet si déjà en place).
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

-- 3. Vérifications — exécutez ces SELECT et comparez :

-- a) Les lignes de diego-users doivent pointer vers le bon compte auth :
--    id et email doivent correspondre exactement à auth.users.
select
  d.id,
  d.email,
  d.role,
  d.active,
  (a.id is not null) as "id present dans auth.users",
  a.email as "email dans auth.users"
from public."diego-users" d
left join auth.users a on a.id = d.id;

-- b) diego_role() doit lire la table (et non le JWT). La définition doit
--    contenir « from public."diego-users" » :
select pg_get_functiondef('public.diego_role()'::regprocedure);

-- c) Les politiques attendues sur diego-users :
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'diego-users';
