# Diego Gestion — POS & Back-Office

Web app de gestion du restaurant (Next.js 14 App Router + Tailwind + Supabase), pensée pour tablette.

## Modules

| Route | Module |
| --- | --- |
| `/caisse` | Caisse tactile : grille dense de produits, filtres, ticket latéral, encaissement multi-moyens (Espèces, Mobile Money, Carte) |
| `/cuisine` | KDS : Kanban En attente → Préparation → Prêt, chrono par commande, codes couleurs par canal |
| `/salle` | Liste des tables, statuts, détails et téléchargement des QR codes |
| `/menu` | Gestion du menu et des ruptures de stock |
| `/affichage` | Customer Facing Display : ticket et total synchronisés avec la caisse |

## Démarrage

```bash
npm install
npm run dev
```

L'app tourne sur [http://localhost:3001](http://localhost:3001).

## Supabase

Renseigner dans `.env.local` l'URL et la clé anon du projet Supabase
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
L'application ne contient aucune donnée métier de secours : Supabase doit être
configuré pour afficher produits, commandes et tables.

Pour générer des QR codes pointant vers le site client, définir aussi :

```env
NEXT_PUBLIC_DIEGO_WEB_URL=https://votre-domaine.ci
```

### Initialiser la base

Pour une nouvelle installation, exécuter directement
`supabase/setup.sql` dans le SQL Editor Supabase.

Pour une installation déjà existante, exécuter les migrations dans cet ordre :

1. `supabase/migrations/20260718214500_diego_restaurant_core.sql`
2. `supabase/migrations/20260718215000_diego_pos_order.sql`
3. `supabase/migrations/20260719135000_diego_menu_categories.sql`
4. `supabase/migrations/20260719150000_diego_auth_roles.sql`
5. `supabase/migrations/20260719160000_diego_users.sql`

> La migration `20260718214600_diego_seed_menu.sql` ne contient que des données
> de démonstration : ne pas l'exécuter. Catégories, produits et tables sont
> créés par l'utilisateur depuis l'application. Pour retirer d'anciennes données
> mock, exécuter `supabase/remove-mock-menu.sql`.

Le premier script crée les tables sécurisées par RLS, les fonctions de commande,
les publications Realtime et les règles du bucket public `diego bucket`. Toutes
les tables métier commencent par `diego-`. Comme ce préfixe contient un tiret,
leurs noms sont toujours entourés de guillemets doubles dans le SQL.

Dans **Authentication → Providers**, activer **Anonymous Sign-ins** pour les
commandes et le suivi des clients non connectés.

Les membres de l'application sont enregistrés dans la table `diego-users`
(le projet Supabase étant partagé entre plusieurs apps, un compte présent dans
`auth.users` n'appartient pas forcément à Diego). La connexion vérifie donc
l'appartenance à cette table en plus de l'authentification.

Le premier compte `superAdmin` est `doninidjessa@gmail.com` (inséré par la
migration `20260719160000_diego_users.sql`). Ce compte peut ensuite créer les
comptes depuis `/utilisateurs`. Un `admin` peut créer des comptes `admin`,
`caissier` et `utilisateur`; seul un `superAdmin` peut créer un autre
`superAdmin`. Si un email
existe déjà dans `auth.users` (créé par une autre app), l'inscription le
rattache à Diego après vérification de son mot de passe actuel.

## Design system

- Thème lumineux, minimaliste : fonds clairs, bordures douces (`line`), accents orange vif (`brand-500`) pour les CTA.
- Densité tablette : textes `text-xs`/`text-2xs`, paddings réduits, mini-cartes produits.
- Layout caisse : rail d'icônes à gauche, zone centrale dense, ticket fixé à droite.
- Mobile : grille sur 2 colonnes, panier en drawer + bouton flottant (FAB), navigation en barre basse.
