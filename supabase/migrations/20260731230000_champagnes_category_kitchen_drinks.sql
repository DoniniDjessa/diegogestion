-- Champagnes category + treat as drink (kitchen / stock).

insert into public."diego-menu-categories" (slug, label, sort_order, active)
values ('champagnes', 'Champagnes', 65, true)
on conflict (slug) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    active = true;

create or replace function public.diego_is_drink_category(p_category text)
returns boolean
language sql
immutable
as $$
  select p_category in (
    'cocktails',
    'vins',
    'champagnes',
    'spiritueux-bieres',
    'softs-jus',
    'boissons-chaudes'
  );
$$;
