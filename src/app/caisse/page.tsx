"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Beer,
  Coffee,
  CookingPot,
  CupSoda,
  LayoutGrid,
  Martini,
  Salad,
  Sandwich,
  Search,
  ShoppingBasket,
  UtensilsCrossed,
  Wine,
  X,
  type LucideIcon,
} from "lucide-react";
import { formatFCFA } from "@/lib/data";
import { cartTotal, useCart } from "@/lib/store";
import type { Product } from "@/lib/types";
import { FIXED_CATEGORIES } from "@/lib/categories";
import {
  fetchProducts,
  removeRealtimeChannel,
  subscribeToRestaurantChanges,
} from "@/lib/supabase/repository";
import { useCustomerDisplayBroadcaster } from "@/lib/customer-display";
import { TicketPanel } from "@/components/TicketPanel";
import { FoodImage } from "@/components/FoodImage";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  "cuisine-africaine": CookingPot,
  "cuisine-europeenne": UtensilsCrossed,
  "cuisine-americaine": Sandwich,
  accompagnements: Salad,
  cocktails: Martini,
  vins: Wine,
  "spiritueux-bieres": Beer,
  "softs-jus": CupSoda,
  "boissons-chaudes": Coffee,
};

export default function CaissePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { lines, channel, restaurantTableId, add } = useCart();
  const total = cartTotal(lines);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  useCustomerDisplayBroadcaster(lines, channel);

  useEffect(() => {
    if (restaurantTableId) setDrawerOpen(true);
  }, [restaurantTableId]);

  const loadProducts = useCallback(async () => {
    try {
      setProducts(await fetchProducts());
      setError(null);
    } catch {
      setProducts([]);
      setError("Impossible de charger le menu depuis Supabase.");
    }
  }, []);

  useEffect(() => {
    void loadProducts();
    const channel = subscribeToRestaurantChanges(() => void loadProducts());
    return () => {
      void removeRealtimeChannel(channel);
    };
  }, [loadProducts]);

  const countBySlug = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      map.set(product.category, (map.get(product.category) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === "all" || p.category === category) &&
          p.name.toLowerCase().includes(query.toLowerCase())
      ),
    [category, products, query]
  );

  return (
    <div className="flex h-full bg-surface-muted">
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="px-3 pt-3 sm:px-4">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un produit…"
              className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-xs shadow-card outline-none focus:border-brand-400"
            />
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {[
              { id: "all", slug: "all", label: "Tout", sortOrder: -1 },
              ...FIXED_CATEGORIES,
            ].map((c) => {
              const active = category === c.slug;
              const Icon = CATEGORY_ICONS[c.slug] ?? LayoutGrid;
              const items =
                c.slug === "all"
                  ? products.length
                  : countBySlug.get(c.slug) ?? 0;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.slug)}
                  className={`flex w-24 shrink-0 flex-col items-start gap-1.5 rounded-card border p-2.5 text-left transition-colors ${
                    active
                      ? "border-brand-500 bg-brand-50"
                      : "border-line bg-surface hover:border-brand-300"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${
                      active
                        ? "bg-brand-500 text-ink"
                        : "bg-surface-soft text-ink-soft"
                    }`}
                  >
                    <Icon size={13} />
                  </span>
                  <span className="w-full font-sans normal-case tracking-normal">
                    <span className="block truncate text-2xs font-semibold">
                      {c.label}
                    </span>
                    <span className="block text-2xs text-ink-faint">
                      {items} produit{items > 1 ? "s" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </header>

        {error && (
          <p className="mx-3 mt-2 rounded-card border border-amber-200 bg-amber-50 px-3 py-2 text-2xs text-amber-800 sm:mx-4">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
            {filtered.map((p) => (
              <button
                key={p.id}
                disabled={!p.inStock}
                onClick={() => add(p)}
                className={`relative flex flex-col rounded-card border border-line bg-surface p-1.5 text-left shadow-card transition-all ${
                  p.inStock
                    ? "hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-panel active:translate-y-0"
                    : "opacity-45"
                }`}
              >
                <FoodImage
                  src={p.imageUrl}
                  alt={p.name}
                  className="aspect-square w-full rounded-card object-cover"
                />
                <span className="mt-1.5 line-clamp-2 min-h-[2.25rem] font-script text-base normal-case leading-[1.125rem] tracking-normal">
                  {p.name}
                </span>
                <span className="mt-0.5 font-sans text-2xs font-bold normal-case tracking-normal text-brand-600 tabular-nums">
                  {formatFCFA(p.price)}
                </span>
                {!p.inStock && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-red-100 px-1.5 py-0.5 font-sans text-2xs font-semibold normal-case tracking-normal text-red-600">
                    Rupture
                  </span>
                )}
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="mt-10 text-center text-xs text-ink-faint">
              Aucun produit ne correspond à la recherche.
            </p>
          )}
        </div>
      </section>

      <aside className="hidden w-80 shrink-0 p-3 pl-0 lg:block xl:w-[22rem]">
        <div className="h-full overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <TicketPanel />
        </div>
      </aside>

      {!drawerOpen && count > 0 && (
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-16 right-4 z-40 flex items-center gap-2 rounded-full bg-brand-500 px-5 py-3 text-ink shadow-panel lg:hidden"
        >
          <ShoppingBasket size={15} />
          {count} · {formatFCFA(total)}
        </button>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[85%] max-w-sm flex-col bg-surface shadow-panel">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-2 z-10 rounded-full p-1.5 text-ink-soft hover:bg-surface-soft"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
            <TicketPanel onCheckout={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
