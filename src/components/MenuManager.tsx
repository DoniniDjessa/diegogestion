"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { formatFCFA } from "@/lib/data";
import type { Category, Product } from "@/lib/types";
import { FIXED_CATEGORIES, categoryLabel } from "@/lib/categories";
import { FoodImage } from "@/components/FoodImage";
import { ListPagination } from "@/components/ListPagination";
import {
  createProduct,
  deleteProduct,
  deleteProductImage,
  fetchProducts,
  removeRealtimeChannel,
  setProductStock,
  subscribeToRestaurantChanges,
  updateProduct,
  uploadProductImage,
} from "@/lib/supabase/repository";
import { usePosKeyboardReceiver } from "@/lib/pos-keyboard";

type ProductForm = {
  name: string;
  description: string;
  category: Category;
  price: string;
  inStock: boolean;
  signature: boolean;
  imagePath: string | null;
};

const EMPTY_FORM: ProductForm = {
  name: "",
  description: "",
  category: FIXED_CATEGORIES[0].slug,
  price: "",
  inStock: true,
  signature: false,
  imagePath: null,
};

const MENU_PAGE_SIZE = 12;

export default function MenuManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePosKeyboardReceiver({
    route: "menu",
    onQuery: setQuery,
    getQuery: () => query,
  });

  const loadData = useCallback(async () => {
    try {
      setProducts(await fetchProducts());
      setError(null);
    } catch {
      setProducts([]);
      setError("Impossible de charger le menu depuis Supabase.");
    }
  }, []);

  useEffect(() => {
    void loadData();
    const channel = subscribeToRestaurantChanges(() => void loadData());
    return () => {
      void removeRealtimeChannel(channel);
    };
  }, [loadData]);

  const filtered = useMemo(
    () =>
      products.filter(
        (product) =>
          (category === "all" || product.category === category) &&
          product.name.toLowerCase().includes(query.toLowerCase())
      ),
    [products, category, query]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / MENU_PAGE_SIZE));

  const displayed = useMemo(() => {
    const start = (page - 1) * MENU_PAGE_SIZE;
    return filtered.slice(start, start + MENU_PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [category, query]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setFormOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description ?? "",
      category: product.category,
      price: String(product.price),
      inStock: product.inStock,
      signature: product.signature ?? false,
      imagePath: product.imagePath ?? null,
    });
    setImageFile(null);
    setFormOpen(true);
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    const price = Number(form.price);
    if (!form.name.trim() || !Number.isInteger(price) || price < 0) {
      setError("Renseignez un nom et un prix valide.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const previousPath = editing?.imagePath ?? null;
      const imagePath = imageFile
        ? await uploadProductImage(imageFile)
        : form.imagePath;
      const input = {
        name: form.name,
        description: form.description,
        category: form.category,
        price,
        imagePath,
        inStock: form.inStock,
        signature: form.signature,
      };
      if (editing) await updateProduct(editing.id, input);
      else await createProduct(input);
      // L'image remplacée est retirée du storage (best-effort).
      if (imageFile && previousPath && previousPath !== imagePath) {
        await deleteProductImage(previousPath).catch(() => undefined);
      }
      setFormOpen(false);
      await loadData();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible d'enregistrer le produit."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(product: Product) {
    if (!window.confirm(`Retirer « ${product.name} » du menu ?`)) return;
    try {
      await deleteProduct(product.id);
      await loadData();
    } catch {
      setError("Suppression refusée. Vérifiez votre session staff.");
    }
  }

  async function toggleStock(product: Product) {
    const nextStock = !product.inStock;
    setProducts((previous) =>
      previous.map((item) =>
        item.id === product.id ? { ...item, inStock: nextStock } : item
      )
    );
    try {
      await setProductStock(product.id, nextStock);
    } catch {
      await loadData();
      setError("Modification refusée. Vérifiez votre session staff.");
    }
  }

  const outOfStock = products.filter((product) => !product.inStock).length;

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <header className="px-3 pt-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 font-display text-base font-bold">
            Menu & stocks
          </h1>
          <div className="relative min-w-40 flex-1 sm:max-w-xs">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher…"
              className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-3 text-xs shadow-card outline-none focus:border-brand-400"
            />
          </div>
          {outOfStock > 0 && (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-2xs font-semibold text-red-600">
              {outOfStock} rupture{outOfStock > 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={openCreate}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-ink shadow-card hover:bg-brand-600"
          >
            <Plus size={13} /> Nouveau produit
          </button>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {[
            { id: "all", slug: "all", label: "Tout", sortOrder: -1 },
            ...FIXED_CATEGORIES,
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setCategory(item.slug)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 transition-colors ${
                category === item.slug
                  ? "border-brand-500 bg-brand-500 text-ink"
                  : "border-line bg-surface text-ink-soft hover:bg-surface-soft"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {error && (
          <p className="mb-3 rounded-card border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {error}
          </p>
        )}
        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-surface-soft text-2xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">Produit</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">
                  Catégorie
                </th>
                <th className="px-3 py-2 text-right font-medium">Prix</th>
                <th className="px-3 py-2 text-right font-medium">
                  Disponibilité
                </th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {displayed.map((product) => (
                <tr
                  key={product.id}
                  className={product.inStock ? "" : "bg-red-50/40"}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FoodImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-9 w-9 shrink-0 rounded-card object-cover"
                      />
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 text-ink-soft sm:table-cell">
                    {categoryLabel(product.category)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatFCFA(product.price)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => void toggleStock(product)}
                      role="switch"
                      aria-checked={product.inStock}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        product.inStock ? "bg-emerald-500" : "bg-red-400"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          product.inStock ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(product)}
                        className="rounded-full p-1.5 text-ink-soft hover:bg-brand-50 hover:text-brand-600"
                        aria-label={`Modifier ${product.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => void removeProduct(product)}
                        className="rounded-full p-1.5 text-ink-soft hover:bg-red-50 hover:text-red-600"
                        aria-label={`Supprimer ${product.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="py-8 text-center text-xs text-ink-faint">
              Aucun produit trouvé.
            </p>
          )}
        </div>
        {filtered.length > 0 && (
          <ListPagination
            page={page}
            pageCount={pageCount}
            totalItems={filtered.length}
            itemLabel="produit"
            onPageChange={setPage}
            className="mt-3"
            ariaLabel="Pagination du menu"
          />
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
          <button
            className="absolute inset-0 bg-ink/40"
            onClick={() => setFormOpen(false)}
            aria-label="Fermer"
          />
          <form
            onSubmit={saveProduct}
            className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-card bg-white shadow-panel"
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-display text-xl font-bold">
                {editing ? "Modifier le produit" : "Nouveau produit"}
              </h2>
              <button type="button" onClick={() => setFormOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold">Nom</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  className="w-full rounded-card border border-line px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold">
                  Catégorie
                </span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      category: event.target.value as Category,
                    })
                  }
                  className="w-full rounded-card border border-line px-3 py-2 text-sm"
                >
                  {FIXED_CATEGORIES.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold">
                  Prix FCFA
                </span>
                <input
                  required
                  min="0"
                  step="1"
                  type="number"
                  value={form.price}
                  onChange={(event) =>
                    setForm({ ...form, price: event.target.value })
                  }
                  className="w-full rounded-card border border-line px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold">
                  Description
                </span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  className="w-full resize-none rounded-card border border-line px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                  <ImagePlus size={14} /> Image
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setImageFile(event.target.files?.[0] ?? null)
                  }
                  className="w-full rounded-card border border-line p-2 text-xs"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={form.inStock}
                  onChange={(event) =>
                    setForm({ ...form, inStock: event.target.checked })
                  }
                />
                Disponible
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={form.signature}
                  onChange={(event) =>
                    setForm({ ...form, signature: event.target.checked })
                  }
                />
                Plat signature
              </label>
            </div>
            <footer className="flex justify-end gap-2 border-t border-line p-4">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-full border border-line px-5 py-2"
              >
                Annuler
              </button>
              <button
                disabled={saving}
                className="rounded-full bg-brand-500 px-5 py-2 text-ink disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
