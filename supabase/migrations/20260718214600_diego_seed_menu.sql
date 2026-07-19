insert into public."diego-products" (
  sku, slug, name, description, category, price, emoji, signature, sort_order
)
values
  ('DIE-001', 'salade-avocat-crevettes', 'Salade avocat-crevettes', 'Avocat frais, crevettes sautées, vinaigrette agrumes-gingembre.', 'entrees', 3500, '🥑', false, 10),
  ('DIE-002', 'nems-maison', 'Nems maison x6', 'Farcis au poulet fermier et légumes croquants, sauce aigre-douce.', 'entrees', 3000, '🥟', false, 20),
  ('DIE-003', 'veloute-igname', 'Velouté d''igname', 'Velouté onctueux d''igname et épices douces.', 'entrees', 2500, '🍜', false, 30),
  ('DIE-004', 'kedjenou-poulet', 'Kedjenou de poulet', 'Poulet fermier mijoté en canari, légumes du marché, riz parfumé.', 'plats', 6500, '🍲', true, 10),
  ('DIE-005', 'attieke-poisson', 'Attiéké poisson', 'Machoiron frais grillé, attiéké artisanal, tomates et oignons confits.', 'plats', 5000, '🐟', true, 20),
  ('DIE-006', 'sauce-graine-riz', 'Sauce graine + riz', 'Sauce graine onctueuse, viande de bœuf fondante, riz long grain.', 'plats', 5500, '🍛', false, 30),
  ('DIE-007', 'garba-premium', 'Garba premium', 'Thon frais doré, attiéké fin, condiments relevés — version élevée du classique.', 'plats', 3500, '🥘', false, 40),
  ('DIE-008', 'aloko-poulet', 'Aloko poulet', 'Poulet braisé et bananes plantain dorées.', 'plats', 4500, '🍗', false, 50),
  ('DIE-009', 'foutou-sauce-claire', 'Foutou banane sauce claire', 'Foutou pilé et sauce claire traditionnelle.', 'plats', 5500, '🍌', false, 60),
  ('DIE-010', 'poulet-braise-entier', 'Poulet braisé entier', 'Mariné 24h aux épices maison, braisé au feu de bois.', 'grillades', 9000, '🔥', true, 10),
  ('DIE-011', 'poisson-braise-machoiron', 'Poisson braisé (machoiron)', 'Braisé entier, accompagné d''alloco et de sauce claire pimentée.', 'grillades', 8500, '🐠', false, 20),
  ('DIE-012', 'brochettes-boeuf', 'Brochettes de bœuf x4', 'Bœuf mariné, oignons et poivrons grillés.', 'grillades', 4000, '🍢', false, 30),
  ('DIE-013', 'cotes-porc-grillees', 'Côtes de porc grillées', 'Côtes marinées et grillées à la flamme.', 'grillades', 7000, '🥩', false, 40),
  ('DIE-014', 'alloco-portion', 'Alloco portion', 'Bananes plantain dorées.', 'accompagnements', 1500, '🍟', false, 10),
  ('DIE-015', 'attieke-portion', 'Attiéké portion', 'Semoule de manioc artisanale.', 'accompagnements', 1000, '🍚', false, 20),
  ('DIE-016', 'frites-patate-douce', 'Frites de patate douce', 'Frites croustillantes de patate douce.', 'accompagnements', 1800, '🍠', false, 30),
  ('DIE-017', 'riz-parfume', 'Riz parfumé', 'Riz long grain parfumé.', 'accompagnements', 1200, '🍙', false, 40),
  ('DIE-018', 'degue-vanille', 'Dègue vanille', 'Mil et lait caillé onctueux, vanille bourbon.', 'desserts', 2000, '🍨', false, 10),
  ('DIE-019', 'salade-fruits-frais', 'Salade de fruits frais', 'Mangue, ananas, papaye et pastèque de saison.', 'desserts', 2500, '🍉', false, 20),
  ('DIE-020', 'fondant-chocolat', 'Fondant chocolat', 'Cœur coulant, servi tiède.', 'desserts', 3000, '🍫', false, 30),
  ('DIE-021', 'bissap-glace', 'Bissap glacé 50cl', 'Hibiscus infusé maison, touche de menthe.', 'boissons', 1500, '🧃', false, 10),
  ('DIE-022', 'gnamankoudji', 'Gnamankoudji 50cl', 'Jus de gingembre frais pressé, citron vert.', 'boissons', 1500, '🥤', false, 20),
  ('DIE-023', 'eau-minerale', 'Eau minérale 1L', 'Eau minérale fraîche.', 'boissons', 1000, '💧', false, 30),
  ('DIE-024', 'jus-orange-presse', 'Jus d''orange pressé', '100% oranges fraîches pressées minute.', 'boissons', 2000, '🍊', false, 40),
  ('DIE-025', 'soda', 'Soda 33cl', 'Soda au choix.', 'boissons', 1000, '🥫', false, 50),
  ('DIE-026', 'cafe-expresso', 'Café expresso', 'Café fraîchement moulu.', 'boissons', 1200, '☕', false, 60)
on conflict (slug) do update set
  sku = excluded.sku,
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  price = excluded.price,
  emoji = excluded.emoji,
  signature = excluded.signature,
  sort_order = excluded.sort_order;

insert into public."diego-restaurant-tables" (
  label, seats, status, position_x, position_y
)
values
  ('T1', 2, 'libre', 12, 15),
  ('T2', 4, 'occupee', 38, 15),
  ('T3', 4, 'libre', 64, 15),
  ('T4', 6, 'occupee', 86, 18),
  ('T5', 2, 'reservee', 12, 48),
  ('T6', 4, 'libre', 38, 48),
  ('T7', 8, 'occupee', 66, 52),
  ('T8', 2, 'libre', 14, 80),
  ('T9', 4, 'reservee', 40, 80),
  ('T10', 4, 'libre', 68, 84)
on conflict (label) do update set
  seats = excluded.seats,
  status = excluded.status,
  position_x = excluded.position_x,
  position_y = excluded.position_y;
