-- Secure role model for Diego authentication.
-- Roles are stored in auth.users.raw_app_meta_data and exposed in JWT app_metadata.

create or replace function public.diego_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select auth.jwt() -> 'app_metadata' ->> 'role';
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

-- Preserve existing accounts while normalizing the old English role names.
update auth.users
set raw_app_meta_data = jsonb_set(
  coalesce(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  to_jsonb(
    case raw_app_meta_data ->> 'role'
      when 'manager' then 'admin'
      when 'cashier' then 'caissier'
      when 'kitchen' then 'caissier'
      else raw_app_meta_data ->> 'role'
    end
  )
)
where raw_app_meta_data ->> 'role' in ('manager', 'cashier', 'kitchen');

drop policy if exists "Staff manage Diego products"
  on public."diego-products";
create policy "Staff manage Diego products"
on public."diego-products"
for all
to authenticated
using (public.diego_is_admin())
with check (public.diego_is_admin());

drop policy if exists "Staff manage Diego tables"
  on public."diego-restaurant-tables";
create policy "Staff manage Diego tables"
on public."diego-restaurant-tables"
for all
to authenticated
using (public.diego_is_admin())
with check (public.diego_is_admin());

drop policy if exists "diego-menu-categories-staff-manage"
  on public."diego-menu-categories";
create policy "diego-menu-categories-staff-manage"
on public."diego-menu-categories"
for all
to authenticated
using (public.diego_is_admin())
with check (public.diego_is_admin());

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
