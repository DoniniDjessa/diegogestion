"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  ChevronRight,
  Printer,
  RefreshCw,
  Truck,
} from "lucide-react";
import { BrandLoader } from "@/components/BrandLoader";
import { ListPagination } from "@/components/ListPagination";
import { formatFCFA } from "@/lib/data";
import type { Order, OrderStatus } from "@/lib/types";
import {
  cancelOrder as cancelOrderRemote,
  fetchAllOrders,
  removeRealtimeChannel,
  setOrderPaymentStatus,
  setOrderStatus,
  subscribeToRestaurantChanges,
} from "@/lib/supabase/repository";
import { printOrderReceipt } from "@/lib/receipt";

const STATUS_META: Record<
  OrderStatus,
  { label: string; className: string }
> = {
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

type DeliveryFilter = "actives" | "pret" | "en_livraison" | "toutes";

const DELIVERY_PAGE_SIZE = 10;

export default function LivraisonsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<DeliveryFilter>("actives");
  const [page, setPage] = useState(1);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await fetchAllOrders());
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible de charger les livraisons."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    const channel = subscribeToRestaurantChanges(() => void loadOrders());
    return () => {
      void removeRealtimeChannel(channel);
    };
  }, [loadOrders]);

  const deliveryOrders = useMemo(() => {
    return orders
      .filter((order) => order.channel === "livraison")
      .filter((order) => {
        if (filter === "pret") return order.status === "pret";
        if (filter === "en_livraison") return order.status === "en_livraison";
        if (filter === "actives") {
          return !["livre", "annule", "servi"].includes(order.status);
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [filter, orders]);

  const pageCount = Math.max(
    1,
    Math.ceil(deliveryOrders.length / DELIVERY_PAGE_SIZE)
  );
  const displayedOrders = deliveryOrders.slice(
    (page - 1) * DELIVERY_PAGE_SIZE,
    page * DELIVERY_PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const readyCount = useMemo(
    () =>
      orders.filter(
        (o) => o.channel === "livraison" && o.status === "pret"
      ).length,
    [orders]
  );

  async function markAsPaid(order: Order) {
    setWorkingId(order.id);
    try {
      await setOrderPaymentStatus(order.id, "paye");
      await loadOrders();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Paiement non enregistré."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function cancelOrder(order: Order) {
    if (
      !window.confirm(`Annuler la livraison #${order.number} ?`)
    ) {
      return;
    }
    setWorkingId(order.id);
    try {
      await cancelOrderRemote(order.id);
      await loadOrders();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Annulation impossible."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function updateDeliveryStatus(
    order: Order,
    status: "en_livraison" | "livre"
  ) {
    setWorkingId(order.id);
    try {
      await setOrderStatus(order.id, status);
      await loadOrders();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Statut de livraison non enregistré."
      );
    } finally {
      setWorkingId(null);
    }
  }

  function printReceipt(order: Order) {
    try {
      printOrderReceipt(order);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Impression impossible."
      );
    }
  }

  return (
    <div className="ops-readable flex h-full flex-col bg-surface-muted">
      <header className="border-b border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <Truck size={17} />
              {readyCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 font-amount text-[10px] font-bold text-white">
                  {readyCount}
                </span>
              )}
            </span>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-ink">
                Livraisons
              </h1>
              <p className="text-sm font-medium text-ink-faint">
                Commandes à livrer et en cours de route
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-ink-soft hover:bg-surface-soft"
          >
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>
        <label className="mt-3 block max-w-xs">
          <span className="mb-1 block text-xs font-medium text-ink-soft">
            Afficher
          </span>
          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as DeliveryFilter)
            }
            className="w-full rounded-card border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
          >
            <option value="actives">En cours (non livrées)</option>
            <option value="pret">Prêtes à partir</option>
            <option value="en_livraison">En livraison</option>
            <option value="toutes">Toutes les livraisons</option>
          </select>
        </label>
      </header>

      {error && (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {loading ? (
          <BrandLoader />
        ) : deliveryOrders.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">
            Aucune livraison dans cette section.
          </div>
        ) : (
          <>
          <div className="mx-auto grid max-w-6xl gap-3 lg:grid-cols-2">
            {displayedOrders.map((order) => {
              const status = STATUS_META[order.status];
              const busy = workingId === order.id;
              const expanded = expandedOrderId === order.id;
              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedOrderId((current) =>
                        current === order.id ? null : order.id
                      )
                    }
                    className="flex w-full items-center justify-between gap-3 p-3.5 text-left hover:bg-surface-soft sm:p-4"
                    aria-expanded={expanded}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-amount text-xl font-bold tabular-nums text-ink">
                          #{order.number}
                        </h2>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                            order.paymentStatus === "paye"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {order.paymentStatus === "paye"
                            ? "Payée"
                            : "À payer"}
                        </span>
                      </div>
                      <p className="mt-1.5 truncate text-sm font-medium text-ink-soft">
                        {order.deliveryAddress || "Adresse non renseignée"}
                      </p>
                      {order.customerPhone && (
                        <p className="text-xs text-ink-faint">
                          Tél. {order.customerPhone}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {new Date(order.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <p className="font-amount text-lg font-bold tabular-nums text-brand-700">
                        {formatFCFA(order.total)}
                      </p>
                      <ChevronRight
                        size={16}
                        className={`text-ink-faint transition-transform ${
                          expanded ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-line p-3.5 sm:p-4">
                      <ul className="space-y-2 border-b border-line pb-3">
                        {order.lines.map(({ product, qty }) => (
                          <li
                            key={product.id}
                            className="flex justify-between gap-3 text-sm"
                          >
                            <span className="min-w-0 truncate font-medium">
                              <span className="font-amount font-bold tabular-nums text-brand-700">
                                {qty}×
                              </span>{" "}
                              {product.name}
                            </span>
                            <span className="shrink-0 font-amount text-sm font-semibold tabular-nums text-ink-soft">
                              {formatFCFA(product.price * qty)}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {order.note && (
                        <p className="mt-3 rounded-card bg-brand-50 px-3 py-2 text-sm text-brand-700">
                          {order.note}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        {order.status === "pret" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void updateDeliveryStatus(order, "en_livraison")
                            }
                            className="flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-2 text-white hover:bg-violet-700 disabled:opacity-50"
                          >
                            <Truck size={13} /> Démarrer la livraison
                          </button>
                        )}
                        {order.status === "en_livraison" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void updateDeliveryStatus(order, "livre")
                            }
                            className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <CheckCircle2 size={13} /> Marquer livrée
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => printReceipt(order)}
                          className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-ink-soft hover:bg-surface-soft"
                        >
                          <Printer size={13} /> Facture
                        </button>
                        {order.status !== "annule" &&
                          order.paymentStatus !== "paye" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void markAsPaid(order)}
                              className="flex items-center gap-1.5 rounded-full border border-emerald-200 px-3 py-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <CheckCircle2 size={13} /> Marquer payée
                            </button>
                          )}
                        {order.status !== "annule" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void cancelOrder(order)}
                            className="flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Ban size={13} /> Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <ListPagination
            page={page}
            pageCount={pageCount}
            totalItems={deliveryOrders.length}
            itemLabel="livraison"
            onPageChange={setPage}
            className="mx-auto mt-4 max-w-6xl"
            ariaLabel="Pagination des livraisons"
          />
          </>
        )}
      </div>
    </div>
  );
}
