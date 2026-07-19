-- =============================================================================
-- Diego — Suppression des données mock (catégories, produits, tables)
-- À coller dans le SQL Editor Supabase.
-- =============================================================================
-- Retire uniquement les données de démonstration livrées par le seed initial,
-- afin de ne conserver que les catégories/produits/tables créés par
-- l'utilisateur. La table diego-users et les comptes ne sont pas touchés.
--
-- Les produits sont supprimés avant les catégories (clé étrangère
-- category -> diego-menu-categories.slug). Les lignes de commande qui
-- référencent ces produits gardent leur libellé (product_id passe à null).

-- 1. Produits mock (SKU 'DIE-XXX' du seed).
delete from public."diego-products"
where sku like 'DIE-%';

-- 2. Catégories mock du seed initial.
delete from public."diego-menu-categories"
where slug in (
  'entrees', 'plats', 'grillades', 'accompagnements', 'desserts', 'boissons'
);

-- 3. Tables de salle mock du seed initial (T1 à T10).
delete from public."diego-restaurant-tables"
where label in ('T1','T2','T3','T4','T5','T6','T7','T8','T9','T10');

-- 4. Contrôle : il ne doit rester que vos propres données.
select 'categories' as type, count(*) from public."diego-menu-categories"
union all
select 'produits', count(*) from public."diego-products"
union all
select 'tables', count(*) from public."diego-restaurant-tables";
