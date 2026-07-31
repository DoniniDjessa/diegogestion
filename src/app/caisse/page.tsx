"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Beer,
  Check,
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
import { FIXED_CATEGORIES, categoryLabel } from "@/lib/categories";
import {
  fetchProducts,
  removeRealtimeChannel,
  subscribeToRestaurantChanges,
} from "@/lib/supabase/repository";
import { useCustomerDisplayBroadcaster } from "@/lib/customer-display";
import { usePosKeyboardReceiver } from "@/lib/pos-keyboard";
import { TicketPanel } from "@/components/TicketPanel";
import { FoodImage } from "@/components/FoodImage";
import { PwaInstallButton } from "@/components/PwaInstallButton";

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
  const { lines, channel, payment, restaurantTableId, amountReceived, add, setAmountReceived } =
    useCart();
  const total = cartTotal(lines);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  useCustomerDisplayBroadcaster(lines, channel, payment, amountReceived);
  usePosKeyboardReceiver({
    route: "caisse",
    onQuery: setQuery,
    onAmount: setAmountReceived,
    getQuery: () => query,
    getAmount: () => amountReceived,
  });

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

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === "all" || p.category === category) &&
          p.name.toLowerCase().includes(query.toLowerCase())
      ),
    [category, products, query]
  );

  const selectedIds = useMemo(
    () => new Set(lines.map((line) => line.product.id)),
    [lines]
  );

  const activeCategoryLabel =
    category === "all" ? "Caisse" : categoryLabel(category);

  return (
    <div className="flex h-full bg-transparent">
      {/* Barre catégories — style tablette comme l'image */}
      <aside className="flex w-[5.5rem] shrink-0 flex-col overflow-hidden rounded-r-[1.6rem] diego-gradient text-white shadow-panel sm:w-24">
        <div className="flex-1 space-y-1.5 overflow-y-auto px-1.5 py-3 sm:px-2">
          {[
            { id: "all", slug: "all", label: "Tout" },
            ...FIXED_CATEGORIES,
          ].map((c) => {
            const active = category === c.slug;
            const Icon = CATEGORY_ICONS[c.slug] ?? LayoutGrid;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.slug)}
                className={`flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-2.5 transition-all ${
                  active
                    ? "bg-white/25 text-white shadow-card ring-1 ring-white/40"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={17} strokeWidth={active ? 2.4 : 2} />
                <span className="w-full whitespace-normal break-words text-center font-sans text-[9px] font-semibold normal-case leading-[1.15] tracking-normal">
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">
              {activeCategoryLabel}
            </h1>
            <p className="text-2xs text-ink-faint">Chez Diego · Caisse tablette</p>
          </div>
          <div className="relative min-w-[12rem] flex-1 sm:max-w-md">
            <Search
              size={15}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un produit…"
              className="w-full rounded-full border border-line bg-white py-2.5 pl-10 pr-4 text-xs shadow-card outline-none focus:border-brand-400"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/clavier"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-soft hover:border-brand-400 hover:text-brand-700"
            >
              Clavier
            </a>
            <a
              href="/affichage"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-soft hover:border-brand-400 hover:text-brand-700"
            >
              Affichage
            </a>
            <PwaInstallButton label="Installer" />
          </div>
        </header>

        {error && (
          <p className="mx-4 mb-2 rounded-card border border-amber-200 bg-amber-50 px-3 py-2 text-2xs text-amber-800">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-3 pb-4 sm:px-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-3">
            {filtered.map((p) => {
              const selected = selectedIds.has(p.id);
              return (
                <button
                  key={p.id}
                  disabled={!p.inStock}
                  onClick={() => add(p)}
                  className={`group relative overflow-hidden rounded-2xl bg-white text-left shadow-card transition-all ${
                    selected
                      ? "ring-2 ring-brand-500 shadow-panel"
                      : "hover:-translate-y-0.5 hover:shadow-panel"
                  } ${!p.inStock ? "opacity-45" : ""}`}
                >
                  <div className="relative aspect-square overflow-hidden">
                    <FoodImage
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <span className="absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 font-sans text-[9px] font-bold normal-case tracking-normal text-white shadow-card diego-gradient tabular-nums">
                      {formatFCFA(p.price)}
                    </span>
                    {!p.inStock && (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-red-100 px-1.5 py-0.5 font-sans text-[9px] font-semibold normal-case tracking-normal text-red-600">
                        Rupture
                      </span>
                    )}
                    <div className="absolute inset-x-1.5 bottom-1.5 flex items-end gap-1 rounded-xl bg-white/95 px-2 py-1.5 shadow-card">
                      <span className="line-clamp-2 min-w-0 flex-1 font-script text-sm normal-case leading-4 tracking-normal text-ink">
                        {p.name}
                      </span>
                      {selected && (
                        <span className="mb-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full diego-gradient text-white">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="mt-10 text-center text-xs text-ink-faint">
              Aucun produit ne correspond à la recherche.
            </p>
          )}
        </div>
      </section>

      <aside className="hidden w-[17rem] shrink-0 border-l border-line bg-surface md:block lg:w-[18.5rem] xl:w-[20rem]">
        <TicketPanel />
      </aside>

      {!drawerOpen && count > 0 && (
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full diego-gradient px-5 py-3 text-white shadow-panel md:hidden"
        >
          <ShoppingBasket size={15} />
          {count} · {formatFCFA(total)}
        </button>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col overflow-hidden bg-surface shadow-panel">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-ink-soft hover:bg-white"
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
