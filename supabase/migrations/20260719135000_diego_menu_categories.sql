-- User-managed menu categories shared by Diego Gestion and Diego Web.
create table if not exists public."diego-menu-categories" (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public."diego-menu-categories" (slug, label, sort_order)
values
  ('entrees', 'Entrées', 10),
  ('plats', 'Plats', 20),
  ('grillades', 'Grillades', 30),
  ('accompagnements', 'Accompagnements', 40),
  ('desserts', 'Desserts', 50),
  ('boissons', 'Boissons', 60)
on conflict (slug) do nothing;

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
using (public.diego_is_staff())
with check (public.diego_is_staff());

alter publication supabase_realtime
  add table public."diego-menu-categories";
