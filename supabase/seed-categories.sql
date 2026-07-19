-- =============================================================================
-- CATÉGORIES FIXES DU MENU DIEGO
-- À exécuter dans le SQL Editor de Supabase.
-- Idempotent : réexécutable sans risque (upsert sur le slug).
-- =============================================================================

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
