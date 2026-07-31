import type { MenuCategory } from "@/lib/types";

/**
 * Catégories fixes du menu Diego.
 * Les slugs doivent correspondre aux lignes de `diego-menu-categories`
 * (voir supabase/seed-categories.sql) pour satisfaire la clé étrangère
 * des produits et l'affichage côté site client.
 */
export const FIXED_CATEGORIES: MenuCategory[] = [
  { id: "cuisine-africaine", slug: "cuisine-africaine", label: "Cuisine Africaine", sortOrder: 10 },
  { id: "cuisine-europeenne", slug: "cuisine-europeenne", label: "Cuisine Européenne", sortOrder: 20 },
  { id: "cuisine-americaine", slug: "cuisine-americaine", label: "Cuisine Américaine", sortOrder: 30 },
  { id: "accompagnements", slug: "accompagnements", label: "Accompagnements", sortOrder: 40 },
  { id: "cocktails", slug: "cocktails", label: "Cocktails", sortOrder: 50 },
  { id: "vins", slug: "vins", label: "Vins", sortOrder: 60 },
  { id: "champagnes", slug: "champagnes", label: "Champagnes", sortOrder: 65 },
  { id: "spiritueux-bieres", slug: "spiritueux-bieres", label: "Spiritueux & Bières", sortOrder: 70 },
  { id: "softs-jus", slug: "softs-jus", label: "Softs & Jus", sortOrder: 80 },
  { id: "boissons-chaudes", slug: "boissons-chaudes", label: "Boissons Chaudes", sortOrder: 90 },
];

/** Catégories boissons — exclues du flux cuisine. */
export const DRINK_CATEGORY_SLUGS = [
  "cocktails",
  "vins",
  "champagnes",
  "spiritueux-bieres",
  "softs-jus",
  "boissons-chaudes",
] as const;

export type DrinkCategorySlug = (typeof DRINK_CATEGORY_SLUGS)[number];

export const DRINK_CATEGORIES: MenuCategory[] = FIXED_CATEGORIES.filter((item) =>
  (DRINK_CATEGORY_SLUGS as readonly string[]).includes(item.slug)
);

export function isDrinkCategory(slug: string): boolean {
  return (DRINK_CATEGORY_SLUGS as readonly string[]).includes(slug);
}

/** Plats / accompagnements — tout ce qui n'est pas une boisson. */
export function isFoodCategory(slug: string): boolean {
  return !isDrinkCategory(slug);
}

export function categoryLabel(slug: string): string {
  return FIXED_CATEGORIES.find((item) => item.slug === slug)?.label ?? slug;
}
