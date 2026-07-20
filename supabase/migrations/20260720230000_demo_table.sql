-- Table de démo pour tester le parcours client (scan QR → commande → admin).
-- Lien site : /table/a0000000-0000-4000-8000-000000000001

insert into public."diego-restaurant-tables" (
  label,
  seats,
  status,
  position_x,
  position_y,
  qr_token,
  active
)
values (
  'Table Test',
  4,
  'libre',
  20,
  20,
  'a0000000-0000-4000-8000-000000000001'::uuid,
  true
)
on conflict (label) do update set
  qr_token = excluded.qr_token,
  seats = excluded.seats,
  active = true,
  updated_at = now();

-- Si une autre ligne a déjà ce qr_token (rare), on force le label Table Test.
update public."diego-restaurant-tables"
set
  label = 'Table Test',
  seats = 4,
  active = true,
  updated_at = now()
where qr_token = 'a0000000-0000-4000-8000-000000000001'::uuid;
