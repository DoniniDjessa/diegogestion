-- =============================================================================
-- MENU CHEZ DIEGO — PRODUITS & PRIX
-- À exécuter dans le SQL Editor de Supabase.
-- Idempotent : réexécutable sans risque (upsert sur le slug produit).
-- Prérequis : les catégories fixes (seed-categories.sql) — réaffirmées ci-dessous.
--
-- Correspondance des catégories :
--   Cocktails (+ Mocktail)     → cocktails
--   Bières + Spiritueux        → spiritueux-bieres
--   Vins                       → vins
--   Softs & Jus + Eaux         → softs-jus
--   Boissons chaudes           → boissons-chaudes
--   Cuisine Africaine          → cuisine-africaine
--   Cuisine Américaine         → cuisine-americaine
--   Cuisine Européenne         → cuisine-europeenne
--   Accompagnements            → accompagnements
-- =============================================================================

-- 1. Catégories fixes (au cas où seed-categories.sql n'a pas encore été exécuté)
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

-- 2. Produits
insert into public."diego-products"
  (slug, name, category, price, emoji, sort_order, active, in_stock)
values
  -- 🍹 Cocktails
  ('mojito',                'Mojito',                    'cocktails', 5000, '🍹', 10, true, true),
  ('caipirinha',            'Caïpirinha',                'cocktails', 5000, '🍹', 20, true, true),
  ('pina-colada',           'Piña Colada',               'cocktails', 5000, '🍹', 30, true, true),
  ('daiquiri-fraise',       'Daiquiri Fraise',           'cocktails', 5000, '🍓', 40, true, true),
  ('margarita',             'Margarita',                 'cocktails', 6000, '🍸', 50, true, true),
  ('cosmopolitan',          'Cosmopolitan',              'cocktails', 6000, '🍸', 60, true, true),
  ('sex-on-the-beach',      'Sex on the Beach',          'cocktails', 6000, '🍹', 70, true, true),
  ('cocktail-chez-diego',   'Cocktail « Chez Diego »',   'cocktails', 7000, '🍹', 80, true, true),
  ('mocktail',              'Mocktail',                  'cocktails', 4000, '🧃', 90, true, true),

  -- 🍺 Bières
  ('biere-castel',          'Castel',                    'spiritueux-bieres', 1500, '🍺', 10, true, true),
  ('biere-budweiser',       'Budweiser',                 'spiritueux-bieres', 1500, '🍺', 20, true, true),
  ('biere-beaufort',        'Beaufort',                  'spiritueux-bieres', 1500, '🍺', 30, true, true),
  ('biere-heineken',        'Heineken',                  'spiritueux-bieres', 1500, '🍺', 40, true, true),
  ('biere-bock',            'Bock',                      'spiritueux-bieres', 1500, '🍺', 50, true, true),
  ('biere-guinness',        'Guinness',                  'spiritueux-bieres', 1500, '🍺', 60, true, true),

  -- 🥃 Spiritueux
  ('whisky',                'Whisky',                    'spiritueux-bieres', 4000, '🥃', 70, true, true),
  ('whisky-premium',        'Whisky Premium',            'spiritueux-bieres', 6000, '🥃', 80, true, true),
  ('vodka-gin-rhum',        'Vodka · Gin · Rhum',        'spiritueux-bieres', 4000, '🥃', 90, true, true),

  -- 🍷 Vins
  ('vin-rouge',             'Vin Rouge',                 'vins', 15000, '🍷', 10, true, true),
  ('vin-blanc',             'Vin Blanc',                 'vins', 12000, '🥂', 20, true, true),

  -- 🥤 Softs & Jus
  ('sodas',                 'Sodas',                     'softs-jus', 1500, '🥤', 10, true, true),
  ('jus-naturels',          'Jus naturels',              'softs-jus', 2000, '🧃', 20, true, true),
  ('cocktail-de-fruits',    'Cocktail de fruits',        'softs-jus', 2500, '🍹', 30, true, true),

  -- 💧 Eaux (rangées dans Softs & Jus)
  ('eau-minerale-50cl',     'Eau minérale 50 cl',        'softs-jus', 1000, '💧', 40, true, true),
  ('eau-minerale-1-5l',     'Eau minérale 1,5 L',        'softs-jus', 1500, '💧', 50, true, true),
  ('perrier',               'Perrier',                   'softs-jus', 2500, '💧', 60, true, true),

  -- ☕ Boissons chaudes
  ('espresso-cafe',         'Espresso / Café',           'boissons-chaudes', 1500, '☕', 10, true, true),
  ('the',                   'Thé',                       'boissons-chaudes', 1500, '🍵', 20, true, true),
  ('cappuccino',            'Cappuccino',                'boissons-chaudes', 2000, '☕', 30, true, true),

  -- 🍛 Cuisine Africaine
  ('yassa-de-poulet',       'Yassa de Poulet',           'cuisine-africaine',  4500, '🍛', 10, true, true),
  ('oxtails-with-rice',     'Oxtails with Rice',         'cuisine-africaine', 10000, '🍛', 20, true, true),
  ('soupe-du-pecheur',      'Soupe du Pêcheur',          'cuisine-africaine',  6500, '🥣', 30, true, true),
  ('soupe-de-poulet',       'Soupe de Poulet',           'cuisine-africaine',  6000, '🥣', 40, true, true),
  ('tajine-de-boeuf',       'Tajine de Bœuf',            'cuisine-africaine',  7000, '🍲', 50, true, true),

  -- 🍔 Cuisine Américaine
  ('philly-cheesesteak',    'Philly Cheesesteak',        'cuisine-americaine', 6500, '🥪', 10, true, true),
  ('hamburger-poulet',      'Hamburger (version poulet)','cuisine-americaine', 5000, '🍔', 20, true, true),
  ('steak-frites',          'Steak-frites',              'cuisine-americaine', 8000, '🥩', 30, true, true),

  -- 🍝 Cuisine Européenne
  ('la-carbonara',          'La Carbonara',              'cuisine-europeenne', 10000, '🍝', 10, true, true),
  ('spaghetti-bolognaise',  'Spaghetti Bolognaise',      'cuisine-europeenne',  5000, '🍝', 20, true, true),
  ('tagliatelle-sauce-blanche', 'Tagliatelle à la sauce blanche', 'cuisine-europeenne', 7000, '🍝', 30, true, true),
  ('gratin-pomme-de-terre', 'Gratin de Pomme de Terre',  'cuisine-europeenne', 10000, '🥔', 40, true, true),
  ('boeuf-bourguignon',     'Bœuf Bourguignon',          'cuisine-europeenne', 10000, '🍲', 50, true, true),
  ('saumon-creme-forestiere', 'Saumon, crème forestière','cuisine-europeenne', 10000, '🐟', 60, true, true),
  ('filet-mignon-roti',     'Filet Mignon Rôti',         'cuisine-europeenne', 10000, '🥩', 70, true, true),

  -- 🍚 Accompagnements
  ('mousseline-pomme-de-terre', 'Mousseline de pomme de terre', 'accompagnements', 1000, '🥔', 10, true, true),
  ('pommes-de-terre-sautees',   'Pommes de terre sautées',      'accompagnements', 1000, '🥔', 20, true, true),
  ('legumes-sautes',        'Légumes sautés',            'accompagnements', 1500, '🥦', 30, true, true),
  ('fagots-haricot',        'Fagots d''haricot',         'accompagnements', 1500, '🫘', 40, true, true),
  ('riz-aux-legumes',       'Riz aux légumes',           'accompagnements', 1500, '🍚', 50, true, true),
  ('ratatouille-gratinee',  'Ratatouille gratinée',      'accompagnements', 1500, '🍆', 60, true, true),
  ('riz-pilaf',             'Riz Pilaf',                 'accompagnements', 1000, '🍚', 70, true, true)
on conflict (slug) do update
set name = excluded.name,
    category = excluded.category,
    price = excluded.price,
    emoji = excluded.emoji,
    sort_order = excluded.sort_order,
    active = true;

-- 3. Vérification
select c.label as categorie, p.name as produit, p.price as prix
from public."diego-products" p
join public."diego-menu-categories" c on c.slug = p.category
where p.active
order by c.sort_order, p.sort_order;
