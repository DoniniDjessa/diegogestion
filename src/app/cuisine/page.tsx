"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCheck, Clock, X } from "lucide-react";
import { CHANNEL_META } from "@/lib/data";
import { isFoodCategory } from "@/lib/categories";
import type { Order, OrderLine, OrderStatus } from "@/lib/types";
import {
  fetchOrders,
  removeRealtimeChannel,
  setOrderStatus,
  subscribeToRestaurantChanges,
} from "@/lib/supabase/repository";

const COLUMNS: { id: "en_attente" | "pret"; label: string; accent: string }[] =
  [
    { id: "en_attente", label: "En attente", accent: "border-t-amber-400" },
    { id: "pret", label: "Prêt", accent: "border-t-emerald-400" },
  ];

function foodLines(order: Order): OrderLine[] {
  return order.lines.filter((line) => isFoodCategory(line.product.category));
}

function hasKitchenFood(order: Order): boolean {
  return foodLines(order).length > 0;
}

function ElapsedTime({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const minutes = Math.max(
    0,
    Math.round((now - new Date(since).getTime()) / 60_000)
  );
  const urgent = minutes >= 15;
  return (
    <span
      className={`flex items-center gap-1 font-amount text-xs font-semibold tabular-nums ${
        urgent ? "text-red-600" : "text-ink-faint"
      }`}
    >
      <Clock size={12} /> {minutes} min
    </span>
  );
}

/** Anciennes commandes « préparation » restent visibles dans En attente. */
function columnOrders(orders: Order[], columnId: "en_attente" | "pret") {
  if (columnId === "en_attente") {
    return orders.filter(
      (o) => o.status === "en_attente" || o.status === "preparation"
    );
  }
  return orders.filter((o) => o.status === "pret");
}

export default function CuisinePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await fetchOrders());
      setError(null);
    } catch {
      setOrders([]);
      setError("Impossible de charger les commandes depuis Supabase.");
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    const channel = subscribeToRestaurantChanges(() => void loadOrders());
    return () => {
      void removeRealtimeChannel(channel);
    };
  }, [loadOrders]);

  const kitchenOrders = useMemo(
    () => orders.filter(hasKitchenFood),
    [orders]
  );

  async function setStatus(id: string, next: OrderStatus) {
    setOrders((prev) =>
      prev
        .map((order) => (order.id === id ? { ...order, status: next } : order))
        .filter((order) => order.status !== "servi")
    );

    try {
      await setOrderStatus(id, next);
      setError(null);
    } catch {
      void loadOrders();
      setError(
        "Mise à jour refusée. Connectez-vous avec un compte cuisine/staff."
      );
    }
  }

  const activeCount = kitchenOrders.filter((o) =>
    ["en_attente", "preparation", "pret"].includes(o.status)
  ).length;

  return (
    <div className="ops-readable flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-ink">
            Cuisine
          </h1>
          <p className="text-2xs text-ink-faint">
            Plats uniquement — boissons exclues
          </p>
        </div>
        <span className="font-amount text-sm font-medium tabular-nums text-ink-soft">
          {activeCount} commande{activeCount > 1 ? "s" : ""} active
          {activeCount > 1 ? "s" : ""}
        </span>
      </header>

      {error && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {error}
        </p>
      )}

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 md:grid-cols-2 md:overflow-hidden">
        {COLUMNS.map((col) => {
          const items = columnOrders(kitchenOrders, col.id);
          return (
            <div
              key={col.id}
              className={`flex min-h-40 flex-col rounded-card border border-line border-t-4 bg-surface shadow-card ${col.accent} md:min-h-0`}
            >
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <h2 className="font-display text-base font-bold text-ink">
                  {col.label}
                </h2>
                <span className="rounded-full bg-surface-soft px-2.5 py-0.5 font-amount text-xs font-semibold tabular-nums text-ink-soft">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 space-y-2.5 overflow-y-auto px-2.5 pb-2.5">
                {items.map((o) => {
                  const meta = CHANNEL_META[o.channel];
                  const lines = foodLines(o);
                  return (
                    <article
                      key={o.id}
                      className="rounded-card border border-line bg-surface p-3 shadow-card"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="font-amount text-base font-bold tabular-nums text-ink">
                            #{o.number}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.color}`}
                          >
                            {meta.label}
                            {o.table ? ` · ${o.table}` : ""}
                          </span>
                        </div>
                        <ElapsedTime since={o.createdAt} />
                      </div>
                      <ul className="mb-2.5 space-y-1.5">
                        {lines.map((l, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-[15px] leading-snug text-ink"
                          >
                            <span className="shrink-0 font-amount text-[15px] font-bold tabular-nums text-brand-700">
                              {l.qty}×
                            </span>
                            <span className="min-w-0 font-medium">
                              {l.product.name}
                              {l.note && (
                                <span className="mt-0.5 block text-xs font-normal italic text-brand-600">
                                  — {l.note}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {o.note && (
                        <p className="mb-2.5 rounded-card bg-brand-50 px-2.5 py-2 text-xs font-medium text-brand-700">
                          {o.note}
                        </p>
                      )}
                      {col.id === "en_attente" ? (
                        <button
                          onClick={() => void setStatus(o.id, "pret")}
                          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-500 py-2.5 text-ink transition-colors hover:bg-brand-600"
                        >
                          <CheckCheck size={14} /> Prêt
                        </button>
                      ) : (
                        <button
                          onClick={() => void setStatus(o.id, "servi")}
                          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-500 py-2.5 text-ink transition-colors hover:bg-emerald-600"
                        >
                          <X size={14} /> Fermer
                        </button>
                      )}
                    </article>
                  );
                })}
                {items.length === 0 && (
                  <p className="py-8 text-center text-sm text-ink-faint">
                    Aucune commande
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
