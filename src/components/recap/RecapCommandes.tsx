"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { BrandLoader } from "@/components/BrandLoader";
import { ListPagination } from "@/components/ListPagination";
import { CHANNEL_META, formatFCFA } from "@/lib/data";
import { orderCode } from "@/lib/order-code";
import type { Order, OrderStatus } from "@/lib/types";
import {
  fetchAllOrders,
  removeRealtimeChannel,
  subscribeToRestaurantChanges,
} from "@/lib/supabase/repository";

type OrderTab = "attente" | "terminees";

const PAGE_SIZE = 12;

const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  a_valider: {
    label: "À valider",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  en_attente: {
    label: "Cuisine",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  preparation: {
    label: "Préparation",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  pret: {
    label: "Prête",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  servi: {
    label: "Servie",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  en_livraison: {
    label: "En livraison",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  livre: {
    label: "Livrée",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  annule: {
    label: "Annulée",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

const DONE_STATUSES: OrderStatus[] = ["servi", "livre"];

function isPending(order: Order): boolean {
  return !DONE_STATUSES.includes(order.status) && order.status !== "annule";
}

function isDone(order: Order): boolean {
  return DONE_STATUSES.includes(order.status);
}

function orderLocation(order: Order): string {
  if (order.channel === "livraison") return order.deliveryAddress?.slice(0, 36) ?? "Livraison";
  if (order.table) return order.table;
  return CHANNEL_META[order.channel]?.label ?? order.channel;
}

export function RecapCommandes() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<OrderTab>("attente");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrders(await fetchAllOrders());
      setError(null);
    } catch {
      setError("Impossible de charger les commandes.");
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

  const pending = useMemo(
    () =>
      orders
        .filter(isPending)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [orders]
  );

  const done = useMemo(
    () =>
      orders
        .filter(isDone)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [orders]
  );

  const list = tab === "attente" ? pending : done;
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const displayed = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [tab]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  if (loading) return <BrandLoader />;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-muted">
      <header className="border-b border-line bg-surface px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-brand-600" />
            <h1 className="font-display text-base font-bold">Commandes</h1>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-ink-soft"
            aria-label="Actualiser"
          >
            <RefreshCw size={13} />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-surface-soft p-1">
          <button
            type="button"
            onClick={() => setTab("attente")}
            className={`relative flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-semibold ${
              tab === "attente"
                ? "bg-brand-500 text-ink shadow-card"
                : "text-ink-soft"
            }`}
          >
            <Clock3 size={13} />
            En attente
            {pending.length > 0 && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 font-amount text-[10px] font-bold text-white">
                {pending.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("terminees")}
            className={`flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-semibold ${
              tab === "terminees"
                ? "bg-brand-500 text-ink shadow-card"
                : "text-ink-soft"
            }`}
          >
            <CheckCircle2 size={13} />
            Terminées
          </button>
        </div>
      </header>

      {error && (
        <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {list.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-faint">
            {tab === "attente"
              ? "Aucune commande en attente."
              : "Aucune commande terminée."}
          </p>
        ) : (
          <ul className="space-y-2">
            {displayed.map((order) => {
              const open = expandedId === order.id;
              const status = STATUS_META[order.status];
              return (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId((id) => (id === order.id ? null : order.id))
                    }
                    className="w-full rounded-card border border-line bg-surface p-3 text-left shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold">
                          {orderCode(order.number, order.createdAt)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-ink-soft">
                          {orderLocation(order)}
                        </p>
                      </div>
                      <p className="shrink-0 font-amount text-sm font-bold tabular-nums">
                        {formatFCFA(order.total)}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          CHANNEL_META[order.channel]?.color ??
                          "border-line bg-white"
                        }`}
                      >
                        {CHANNEL_META[order.channel]?.label ?? order.channel}
                      </span>
                      <span className="text-[10px] text-ink-faint">
                        {new Date(order.createdAt).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {open && (
                      <ul className="mt-2 space-y-1 border-t border-line pt-2">
                        {order.lines.map((line, index) => (
                          <li
                            key={`${line.product.id}-${index}`}
                            className="flex justify-between gap-2 text-xs"
                          >
                            <span className="text-ink-soft">
                              {line.qty}× {line.product.name}
                            </span>
                            <span className="font-amount tabular-nums">
                              {formatFCFA(line.qty * line.product.price)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <ListPagination
          page={page}
          pageCount={pageCount}
          totalItems={list.length}
          itemLabel="commande"
          onPageChange={setPage}
          className="mt-3"
          ariaLabel="Pagination des commandes"
        />
      </div>
    </div>
  );
}
