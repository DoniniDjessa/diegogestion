-- Marque comme servies et payees les commandes encore actives creees
-- jusqu'au 8 octobre 2026 a 18:00, heure d'Abidjan (UTC).
-- Les commandes annulees, deja servies ou deja livrees sont exclues.
-- Le moyen de paiement n'est pas modifie : il n'est pas deduit par ce script.
--
-- Verifier le nombre de commandes ciblees avant execution :
-- select count(*)
-- from public."diego-orders"
-- where created_at <= timestamptz '2026-10-08 18:00:00+00'
--   and status in (
--     'a_valider', 'en_attente', 'preparation', 'pret', 'en_livraison'
--   );
--
-- La mise a jour du paiement declenche le decrement de stock des boissons
-- configure dans le projet. Les commandes deja payees ne sont pas debitees
-- une seconde fois par ce trigger.

begin;

do $$
declare
  updated_count integer;
begin
  update public."diego-orders"
  set
    status = 'servi',
    payment_status = 'paye'
  where created_at <= timestamptz '2026-10-08 18:00:00+00'
    and status in (
      'a_valider', 'en_attente', 'preparation', 'pret', 'en_livraison'
    );

  get diagnostics updated_count = row_count;
  raise notice 'Commandes marquees servies et payees : %', updated_count;
end;
$$;

commit;
