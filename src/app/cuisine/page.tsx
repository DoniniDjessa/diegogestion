"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCheck, ChevronRight, Clock } from "lucide-react";
import { CHANNEL_META } from "@/lib/data";
import type { Order, OrderStatus } from "@/lib/types";
import {
  fetchOrders,
  removeRealtimeChannel,
  setOrderStatus,
  subscribeToRestaurantChanges,
} from "@/lib/supabase/repository";

const COLUMNS: { id: OrderStatus; label: string; accent: string }[] = [
  { id: "en_attente", label: "En attente", accent: "border-t-amber-400" },
  { id: "preparation", label: "En préparation", accent: "border-t-blue-400" },
  { id: "pret", label: "Prêt", accent: "border-t-emerald-400" },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  en_attente: "preparation",
  preparation: "pret",
  pret: "servi",
};

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
      className={`flex items-center gap-1 text-2xs font-semibold tabular-nums ${
        urgent ? "text-red-600" : "text-ink-faint"
      }`}
    >
      <Clock size={11} /> {minutes} min
    </span>
  );
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

  async function advance(id: string) {
    const current = orders.find((order) => order.id === id);
    if (!current) return;
    if (current.status === "pret" && current.channel === "livraison") return;
    const next = NEXT_STATUS[current.status];
    if (!next) return;

    setOrders((prev) =>
      prev
        .map((order) =>
          order.id === id ? { ...order, status: next } : order
        )
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

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
        <h1 className="text-sm font-semibold">Cuisine — Flux des commandes</h1>
        <span className="text-2xs text-ink-faint">
          {orders.length} commande{orders.length > 1 ? "s" : ""} active
          {orders.length > 1 ? "s" : ""}
        </span>
      </header>

      {error && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-2xs text-amber-800">
          {error}
        </p>
      )}

      <div className="grid flex-1 grid-cols-1 gap-2.5 overflow-y-auto p-2.5 md:grid-cols-3 md:overflow-hidden">
        {COLUMNS.map((col) => {
          const items = orders.filter((o) => o.status === col.id);
          return (
            <div
              key={col.id}
              className={`flex min-h-40 flex-col rounded-card border border-line border-t-4 bg-surface shadow-card ${col.accent} md:min-h-0`}
            >
              <div className="flex items-center justify-between px-3 py-2">
                <h2 className="text-xs font-semibold">{col.label}</h2>
                <span className="rounded-full bg-surface-soft px-2 py-0.5 text-2xs font-semibold text-ink-soft tabular-nums">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto px-2.5 pb-2.5">
                {items.map((o) => {
                  const meta = CHANNEL_META[o.channel];
                  return (
                    <article
                      key={o.id}
                      className="rounded-card border border-line bg-surface p-2.5 shadow-card"
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold tabular-nums">
                            #{o.number}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-2xs font-medium ${meta.color}`}
                          >
                            {meta.label}
                            {o.table ? ` · ${o.table}` : ""}
                          </span>
                        </div>
                        <ElapsedTime since={o.createdAt} />
                      </div>
                      <ul className="mb-2 space-y-0.5">
                        {o.lines.map((l, i) => (
                          <li key={i} className="text-xs leading-4">
                            <span className="font-semibold tabular-nums">
                              {l.qty}×
                            </span>{" "}
                            {l.product.name}
                            {l.note && (
                              <span className="ml-1 text-2xs italic text-brand-600">
                                — {l.note}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {o.note && (
                        <p className="mb-2 rounded-card bg-brand-50 px-2 py-1.5 text-2xs text-brand-700">
                          {o.note}
                        </p>
                      )}
                      {o.status === "pret" && o.channel === "livraison" ? (
                        <p className="rounded-full bg-emerald-50 py-1.5 text-center text-2xs text-emerald-700">
                          Prête pour livraison
                        </p>
                      ) : (
                        <button
                          onClick={() => void advance(o.id)}
                          className={`flex w-full items-center justify-center gap-1 rounded-full py-1.5 text-ink transition-colors ${
                            o.status === "pret"
                              ? "bg-emerald-500 hover:bg-emerald-600"
                              : "bg-brand-500 hover:bg-brand-600"
                          }`}
                        >
                          {o.status === "pret" ? (
                            <>
                              <CheckCheck size={13} /> Servi / Remis
                            </>
                          ) : (
                            <>
                              Étape suivante <ChevronRight size={13} />
                            </>
                          )}
                        </button>
                      )}
                    </article>
                  );
                })}
                {items.length === 0 && (
                  <p className="py-6 text-center text-2xs text-ink-faint">
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
