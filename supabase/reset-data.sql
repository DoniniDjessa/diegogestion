-- =============================================================================
-- Diego — Purge des données (conserve la table diego-users)
-- À coller dans le SQL Editor Supabase.
-- =============================================================================
-- Vide toutes les tables métier : commandes, lignes et historique de commande,
-- produits, catégories de menu et tables de salle. Les comptes et rôles de
-- l'application (diego-users) ainsi que les comptes auth ne sont pas touchés.
--
-- « restart identity » remet à zéro les numéros de commande.
-- « cascade » gère les clés étrangères entre les tables purgées.
-- Les fichiers du bucket de stockage (images produits) ne sont pas supprimés.

truncate table
  public."diego-order-events",
  public."diego-order-items",
  public."diego-orders",
  public."diego-products",
  public."diego-menu-categories",
  public."diego-restaurant-tables"
restart identity cascade;
