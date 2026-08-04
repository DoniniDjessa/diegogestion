"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Package, Plus, Search } from "lucide-react";
import { BrandLoader } from "@/components/BrandLoader";
import { FoodImage } from "@/components/FoodImage";
import { ListPagination } from "@/components/ListPagination";
import {
  DRINK_CATEGORIES,
  categoryLabel,
  isDrinkCategory,
} from "@/lib/categories";
import { fetchCurrentRole, isAdminRole, type UserRole } from "@/lib/auth";
import { formatFCFA } from "@/lib/data";
import { getSupabase } from "@/lib/supabase";
import type { Product } from "@/lib/types";
import {
  fetchProducts,
  removeRealtimeChannel,
  setDrinkStockQty,
  subscribeToRestaurantChanges,
} from "@/lib/supabase/repository";
import { usePosKeyboardReceiver } from "@/lib/pos-keyboard";

const STOCK_PAGE_SIZE = 14;

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "out">("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState<Record<string, string>>({});

  usePosKeyboardReceiver({
    route: "stock",
    onQuery: setQuery,
    getQuery: () => query,
  });

  const canEdit = isAdminRole(role);

  const load = useCallback(async () => {
    try {
      const all = await fetchProducts();
      setProducts(all.filter((p) => isDrinkCategory(p.category)));
      setError(null);
    } catch {
      setError(
        "Impossible de charger le stock. Exécutez la migration stock boissons si besoin."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const channel = subscribeToRestaurantChanges(() => void load());
    return () => {
      void removeRealtimeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void fetchCurrentRole().then(setRole);
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setRole(null);
      else void fetchCurrentRole().then(setRole);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr");
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      const qty = p.stockQty ?? 0;
      if (stockFilter === "in" && qty <= 0) return false;
      if (stockFilter === "out" && qty > 0) return false;
      if (!q) return true;
      return p.name.toLocaleLowerCase("fr").includes(q);
    });
  }, [category, products, query, stockFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / STOCK_PAGE_SIZE));
  const displayed = filtered.slice(
    (page - 1) * STOCK_PAGE_SIZE,
    page * STOCK_PAGE_SIZE
  );

  const outCount = products.filter((p) => (p.stockQty ?? 0) <= 0).length;
  const inCount = products.length - outCount;

  useEffect(() => {
    setPage(1);
  }, [category, query, stockFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  async function commitQty(product: Product, nextQty: number) {
    if (!canEdit) return;
    const qty = Math.max(0, Math.floor(nextQty));
    if (qty === (product.stockQty ?? 0)) {
      setDraftQty((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      return;
    }
    setWorkingId(product.id);
    setError(null);
    try {
      await setDrinkStockQty(product.id, qty);
      setProducts((prev) =>
        prev.map((item) =>
          item.id === product.id
            ? { ...item, stockQty: qty, inStock: qty > 0 }
            : item
        )
      );
      setDraftQty((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Mise à jour du stock refusée (admin requis)."
      );
    } finally {
      setWorkingId(null);
    }
  }

  function displayQty(product: Product): string {
    if (draftQty[product.id] !== undefined) return draftQty[product.id];
    return String(product.stockQty ?? 0);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Package size={18} className="text-brand-600" />
          <h1 className="font-display text-base font-bold">Stock boissons</h1>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Quantités décrémentées automatiquement à chaque vente payée.
          {canEdit
            ? " Vous pouvez ajuster le stock manuellement."
            : " Seuls les admins peuvent modifier le stock."}
        </p>
      </header>

      <div className="border-b border-line bg-surface-soft/60 px-4 py-3 sm:px-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
            aria-label="Catégorie"
          >
            <option value="all">Toutes les catégories</option>
            {DRINK_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="relative block">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une boisson…"
              className="w-full rounded-full border border-line bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-brand-400"
            />
          </label>
          <select
            value={stockFilter}
            onChange={(e) =>
              setStockFilter(e.target.value as typeof stockFilter)
            }
            className="rounded-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
            aria-label="Filtrer par disponibilité"
          >
            <option value="all">Tous les statuts</option>
            <option value="in">En stock</option>
            <option value="out">Rupture</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {loading ? (
          <BrandLoader />
        ) : (
          <div className="mx-auto max-w-5xl space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-card">
                <p className="text-[10px] font-semibold uppercase text-ink-faint">
                  Références
                </p>
                <p className="font-amount text-sm font-bold tabular-nums">
                  {products.length}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-card">
                <p className="text-[10px] font-semibold uppercase text-ink-faint">
                  En stock
                </p>
                <p className="font-amount text-sm font-bold tabular-nums text-emerald-700">
                  {inCount}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-card">
                <p className="text-[10px] font-semibold uppercase text-ink-faint">
                  Rupture
                </p>
                <p className="font-amount text-sm font-bold tabular-nums text-red-600">
                  {outCount}
                </p>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-faint">
                Aucune boisson dans cette sélection.
              </p>
            ) : (
              <>
                <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-line bg-surface-soft text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                      <tr>
                        <th className="px-3 py-2.5 sm:px-4">Produit</th>
                        <th className="hidden px-3 py-2.5 sm:table-cell sm:px-4">
                          Catégorie
                        </th>
                        <th className="px-3 py-2.5 sm:px-4">Prix</th>
                        <th className="px-3 py-2.5 text-center sm:px-4">
                          Quantité
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {displayed.map((product) => {
                        const busy = workingId === product.id;
                        const qty = product.stockQty ?? 0;
                        return (
                          <tr
                            key={product.id}
                            className={qty > 0 ? "" : "bg-red-50/40"}
                          >
                            <td className="px-3 py-2.5 sm:px-4">
                              <div className="flex items-center gap-2.5">
                                <FoodImage
                                  src={product.imageUrl}
                                  alt=""
                                  className="h-9 w-9 shrink-0 rounded-lg object-cover"
                                />
                                <div>
                                  <span className="font-medium">
                                    {product.name}
                                  </span>
                                  <p className="text-[10px] font-semibold uppercase text-ink-faint">
                                    {qty > 0 ? "En stock" : "Rupture"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="hidden px-3 py-2.5 text-xs text-ink-soft sm:table-cell sm:px-4">
                              {categoryLabel(product.category)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 font-amount text-xs font-semibold tabular-nums sm:px-4">
                              {formatFCFA(product.price)}
                            </td>
                            <td className="px-3 py-2.5 sm:px-4">
                              {canEdit ? (
                                <div className="mx-auto flex w-fit items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={busy || qty <= 0}
                                    onClick={() =>
                                      void commitQty(product, qty - 1)
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-surface-soft disabled:opacity-40"
                                    aria-label="Diminuer"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    inputMode="numeric"
                                    disabled={busy}
                                    value={displayQty(product)}
                                    onChange={(e) =>
                                      setDraftQty((prev) => ({
                                        ...prev,
                                        [product.id]: e.target.value,
                                      }))
                                    }
                                    onBlur={() => {
                                      const raw = draftQty[product.id];
                                      if (raw === undefined) return;
                                      const parsed = Number.parseInt(raw, 10);
                                      void commitQty(
                                        product,
                                        Number.isFinite(parsed) ? parsed : qty
                                      );
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    className="h-8 w-14 rounded-lg border border-line bg-white text-center font-amount text-sm font-bold tabular-nums outline-none focus:border-brand-400 disabled:opacity-50"
                                  />
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      void commitQty(product, qty + 1)
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-surface-soft disabled:opacity-40"
                                    aria-label="Augmenter"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              ) : (
                                <p className="text-center font-amount text-sm font-bold tabular-nums">
                                  {qty}
                                </p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ListPagination
                  page={page}
                  pageCount={pageCount}
                  totalItems={filtered.length}
                  itemLabel="produit"
                  onPageChange={setPage}
                  ariaLabel="Pagination stock"
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
