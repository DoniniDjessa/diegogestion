"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Trash2,
  Truck,
} from "lucide-react";
import { BrandLoader } from "@/components/BrandLoader";
import { ListPagination } from "@/components/ListPagination";
import { CHANNEL_META, formatFCFA } from "@/lib/data";
import type { Order, OrderStatus, Product, RestaurantTable } from "@/lib/types";
import {
  assignOrderTable,
  cancelOrder as cancelOrderRemote,
  fetchAllOrders,
  fetchProducts,
  fetchRestaurantTables,
  removeRealtimeChannel,
  replacePendingOrderItems,
  setOrderPaymentStatus,
  setOrderStatus,
  setRestaurantTableStatus,
  subscribeToRestaurantChanges,
  validateCustomerOrder,
} from "@/lib/supabase/repository";
import { printOrderReceipt } from "@/lib/receipt";
import { orderCode } from "@/lib/order-code";
import { usePosKeyboardReceiver } from "@/lib/pos-keyboard";

const LIVE_ORDER_WINDOW_MS = 2 * 60 * 60 * 1000;

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

type Filter = "toutes" | "actives" | "payees" | "annulees";
type OrderScope = "a_valider" | "commandes" | "en_ligne" | "a_livrer" | "historique";
type DateFilter = "today" | "week" | "month" | "range";

type DraftLine = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
};

const LIST_PAGE_SIZE = 10;

function isDirectWebOrder(order: Order): boolean {
  // Les commandes web (anonymes) n'ont pas de moyen de paiement choisi en caisse.
  return (
    !order.restaurantTableId &&
    (Boolean(order.customerId) || !order.paymentMethod)
  );
}

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function matchesDateFilter(
  order: Order,
  filter: DateFilter,
  rangeStart: string,
  rangeEnd: string
): boolean {
  const date = new Date(order.createdAt);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let end = new Date(start);

  if (filter === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (filter === "month") {
    start.setDate(1);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  } else if (filter === "range") {
    if (!rangeStart || !rangeEnd) return true;
    const rangeStartDate = new Date(`${rangeStart}T00:00:00`);
    const rangeEndDate = new Date(`${rangeEnd}T23:59:59.999`);
    return date >= rangeStartDate && date <= rangeEndDate;
  } else {
    end.setDate(end.getDate() + 1);
  }

  return date >= start && date < end;
}

function orderLocation(order: Order): string {
  if (order.channel === "livraison") return "Livraison";
  if (order.table) return order.table;
  return "Au resto";
}

function isRecentOrder(order: Order, nowMs: number): boolean {
  return nowMs - new Date(order.createdAt).getTime() <= LIVE_ORDER_WINDOW_MS;
}

export default function CommandesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [scope, setScope] = useState<OrderScope>("a_valider");
  const [filter, setFilter] = useState<Filter>("toutes");
  const [historyQuery, setHistoryQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [rangeStart, setRangeStart] = useState(localDateValue(new Date()));
  const [rangeEnd, setRangeEnd] = useState(localDateValue(new Date()));
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [draftNote, setDraftNote] = useState("");
  const [addProductId, setAddProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  usePosKeyboardReceiver({
    route: "commandes",
    onQuery: setHistoryQuery,
    getQuery: () => historyQuery,
  });
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadOrders = useCallback(async () => {
    try {
      const [nextOrders, nextTables, nextProducts] = await Promise.all([
        fetchAllOrders(),
        fetchRestaurantTables(),
        fetchProducts(),
      ]);
      setOrders(nextOrders);
      setTables(nextTables);
      setProducts(nextProducts.filter((p) => p.inStock));
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible de charger les commandes."
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

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const list = orders.filter((order) => {
      const online = isDirectWebOrder(order);
      if (scope === "a_valider") return order.status === "a_valider";
      if (order.status === "a_valider") return false;
      if (scope === "en_ligne" && !online) return false;
      if (scope === "commandes" && online) return false;
      if (scope === "commandes" && order.channel === "livraison") return false;
      if (
        scope === "en_ligne" &&
        ["pret", "en_livraison", "livre"].includes(order.status)
      ) {
        return false;
      }
      if (
        scope === "a_livrer" &&
        (!online || !["pret", "en_livraison"].includes(order.status))
      ) {
        return false;
      }
      if (
        (scope === "commandes" || scope === "en_ligne") &&
        !isRecentOrder(order, nowMs)
      ) {
        return false;
      }
      if (
        scope === "historique" &&
        !matchesDateFilter(order, dateFilter, rangeStart, rangeEnd)
      ) {
        return false;
      }
      if (scope === "historique" && historyQuery.trim()) {
        const query = historyQuery.trim().toLocaleLowerCase("fr");
        const numericQuery = query.replace(/[^\d]/g, "");
        const code = orderCode(order.number, order.createdAt);
        const matchesCode =
          code.toLowerCase().includes(query.replace(/^#/, "")) ||
          String(order.number).includes(numericQuery);
        const matchesPrice =
          numericQuery.length > 0 &&
          (String(order.total).includes(numericQuery) ||
            order.lines.some(({ product }) =>
              String(product.price).includes(numericQuery)
            ));
        const matchesProduct = order.lines.some(({ product }) =>
          product.name.toLocaleLowerCase("fr").includes(query)
        );
        if (!matchesCode && !matchesPrice && !matchesProduct) return false;
      }
      if (filter === "actives") {
        return !["servi", "livre", "annule"].includes(order.status);
      }
      if (filter === "payees") return order.paymentStatus === "paye";
      if (filter === "annulees") return order.status === "annule";
      return true;
    });

    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [
    dateFilter,
    filter,
    historyQuery,
    nowMs,
    orders,
    rangeEnd,
    rangeStart,
    scope,
  ]);

  const pendingCount = useMemo(
    () => orders.filter((o) => o.status === "a_valider").length,
    [orders]
  );

  const listPageCount = Math.max(
    1,
    Math.ceil(filtered.length / LIST_PAGE_SIZE)
  );
  const displayedOrders = filtered.slice(
    (historyPage - 1) * LIST_PAGE_SIZE,
    historyPage * LIST_PAGE_SIZE
  );

  useEffect(() => {
    if (historyPage > listPageCount) setHistoryPage(listPageCount);
  }, [historyPage, listPageCount]);

  useEffect(() => {
    setHistoryPage(1);
    setExpandedOrderId(null);
    setDraftLines([]);
    setDraftNote("");
    setAddProductId("");
  }, [dateFilter, filter, historyQuery, rangeEnd, rangeStart, scope]);

  function openScope(nextScope: OrderScope) {
    setScope(nextScope);
    setFilter("toutes");
  }

  function openOrder(order: Order) {
    setExpandedOrderId((current) => {
      if (current === order.id) {
        setDraftLines([]);
        setDraftNote("");
        setAddProductId("");
        return null;
      }
      if (order.status === "a_valider") {
        setDraftLines(
          order.lines.map((line) => ({
            productId: line.product.id,
            name: line.product.name,
            price: line.product.price,
            qty: line.qty,
            note: line.note,
          }))
        );
        setDraftNote(order.note ?? "");
        setAddProductId("");
      } else {
        setDraftLines([]);
        setDraftNote("");
      }
      return order.id;
    });
  }

  const draftTotal = draftLines.reduce(
    (sum, line) => sum + line.price * line.qty,
    0
  );

  async function savePendingEdits(orderId: string) {
    if (draftLines.length === 0) {
      throw new Error("La commande doit contenir au moins un article.");
    }
    await replacePendingOrderItems(
      orderId,
      draftLines.map((line) => ({
        productId: line.productId,
        quantity: line.qty,
        note: line.note,
      })),
      draftNote
    );
  }

  async function validatePending(order: Order) {
    setWorkingId(order.id);
    try {
      await savePendingEdits(order.id);
      await validateCustomerOrder(order.id);
      setExpandedOrderId(null);
      setDraftLines([]);
      await loadOrders();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Validation impossible."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function savePendingOnly(order: Order) {
    setWorkingId(order.id);
    try {
      await savePendingEdits(order.id);
      await loadOrders();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Enregistrement impossible."
      );
    } finally {
      setWorkingId(null);
    }
  }

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
      !window.confirm(
        `Annuler définitivement la commande #${order.number} ?`
      )
    ) {
      return;
    }
    setWorkingId(order.id);
    try {
      await cancelOrderRemote(order.id);
      await loadOrders();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Annulation non enregistrée."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function changeTable(order: Order, tableId: string) {
    setWorkingId(order.id);
    try {
      await assignOrderTable(order.id, tableId || null);
      await loadOrders();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Assignation de table impossible."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function clearTable(order: Order) {
    if (!order.restaurantTableId) return;
    setWorkingId(order.id);
    try {
      await setRestaurantTableStatus(order.restaurantTableId, "libre");
      await loadOrders();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible de vider la table."
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
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <ClipboardList size={17} />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-ink">
                Commandes
              </h1>
              <p className="text-sm font-medium text-ink-faint">
                Suivi, paiement et impression des factures
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
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-surface-soft p-1 sm:max-w-lg">
          <button
            type="button"
            onClick={() => openScope("a_valider")}
            className={`relative flex items-center justify-center gap-1.5 rounded-full px-2 py-2 ${
              scope === "a_valider"
                ? "bg-brand-500 text-ink shadow-card"
                : "text-ink-soft"
            }`}
          >
            <Clock3 size={13} /> En attente
            {pendingCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 font-amount text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => openScope("commandes")}
            className={`flex items-center justify-center gap-1.5 rounded-full px-2 py-2 ${
              scope === "commandes"
                ? "bg-brand-500 text-ink shadow-card"
                : "text-ink-soft"
            }`}
          >
            <ClipboardList size={13} /> Commandes
          </button>
          <button
            type="button"
            onClick={() => openScope("historique")}
            className={`flex items-center justify-center gap-1.5 rounded-full px-2 py-2 ${
              scope === "historique"
                ? "bg-brand-500 text-ink shadow-card"
                : "text-ink-soft"
            }`}
          >
            <CalendarDays size={13} /> Historique
          </button>
        </div>
        {scope === "historique" && (
          <div className="mt-3 space-y-2">
            <label className="relative block">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                type="search"
                value={historyQuery}
                onChange={(event) => setHistoryQuery(event.target.value)}
                placeholder="Produit, prix ou code (ex. a513)"
                className="w-full rounded-full border border-line bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-brand-400"
              />
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">
                  Période
                </span>
                <select
                  value={dateFilter}
                  onChange={(event) =>
                    setDateFilter(event.target.value as DateFilter)
                  }
                  className="w-full rounded-card border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                >
                  <option value="today">Aujourd’hui</option>
                  <option value="week">Cette semaine</option>
                  <option value="month">Ce mois</option>
                  <option value="range">Période personnalisée</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">
                  Statut
                </span>
                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as Filter)
                  }
                  className="w-full rounded-card border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                >
                  <option value="toutes">Toutes</option>
                  <option value="actives">Actives</option>
                  <option value="payees">Payées</option>
                  <option value="annulees">Annulées</option>
                </select>
              </label>
            </div>
            {dateFilter === "range" && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  aria-label="Date de début"
                  value={rangeStart}
                  max={rangeEnd || undefined}
                  onChange={(event) => setRangeStart(event.target.value)}
                  className="rounded-card border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
                <input
                  type="date"
                  aria-label="Date de fin"
                  value={rangeEnd}
                  min={rangeStart || undefined}
                  onChange={(event) => setRangeEnd(event.target.value)}
                  className="rounded-card border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </div>
            )}
          </div>
        )}
        {scope !== "a_valider" && scope !== "historique" && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto">
          {(
            [
              ["toutes", "Toutes"],
              ["actives", "Actives"],
              ["payees", "Payées"],
              ["annulees", "Annulées"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 ${
                filter === id
                  ? "border-brand-500 bg-brand-500 text-ink"
                  : "border-line bg-white text-ink-soft"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        )}
      </header>

      {error && (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {loading ? (
          <BrandLoader />
        ) : filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">
            Aucune commande dans cette section.
          </div>
        ) : (
          <>
            <div className="mx-auto grid max-w-6xl gap-3 lg:grid-cols-2">
            {displayedOrders.map((order) => {
              const status = STATUS_META[order.status];
              const busy = workingId === order.id;
              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
                >
                  <button
                    type="button"
                    onClick={() => openOrder(order)}
                    className="flex w-full items-center justify-between gap-3 p-3.5 text-left hover:bg-surface-soft sm:p-4"
                    aria-expanded={expandedOrderId === order.id}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-amount text-xl font-bold tabular-nums tracking-tight text-ink">
                          #
                          {scope === "historique"
                            ? orderCode(order.number, order.createdAt)
                            : order.number}
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
                      <p className="mt-1.5 text-sm font-medium text-ink-soft">
                        {orderLocation(order)} ·{" "}
                        {CHANNEL_META[order.channel]?.label ?? order.channel}
                      </p>
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
                          expandedOrderId === order.id ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {expandedOrderId === order.id && (
                  <div className="border-t border-line p-3.5 sm:p-4">
                  {order.status === "a_valider" ? (
                    <>
                      {order.note && draftNote === order.note && (
                        <p className="mb-2 text-xs text-ink-faint">
                          Précisions client — modifiables ci-dessous
                        </p>
                      )}
                      <ul className="space-y-2">
                        {draftLines.map((line, index) => (
                          <li
                            key={`${line.productId}-${index}`}
                            className="rounded-card border border-line bg-surface-muted p-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="min-w-0 flex-1 truncate text-sm font-medium">
                                {line.name}
                              </p>
                              <p className="shrink-0 font-amount text-sm font-semibold tabular-nums text-brand-700">
                                {formatFCFA(line.price * line.qty)}
                              </p>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  setDraftLines((prev) =>
                                    prev
                                      .map((l, i) =>
                                        i === index
                                          ? { ...l, qty: l.qty - 1 }
                                          : l
                                      )
                                      .filter((l) => l.qty > 0)
                                  )
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white"
                                aria-label="Diminuer"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="w-6 text-center font-amount text-sm font-bold">
                                {line.qty}
                              </span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  setDraftLines((prev) =>
                                    prev.map((l, i) =>
                                      i === index
                                        ? { ...l, qty: Math.min(99, l.qty + 1) }
                                        : l
                                    )
                                  )
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white"
                                aria-label="Augmenter"
                              >
                                <Plus size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  setDraftLines((prev) =>
                                    prev.filter((_, i) => i !== index)
                                  )
                                }
                                className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border border-red-200 text-red-600"
                                aria-label="Retirer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-3 flex gap-2">
                        <select
                          value={addProductId}
                          onChange={(e) => setAddProductId(e.target.value)}
                          className="min-w-0 flex-1 rounded-card border border-line bg-white px-2.5 py-2 text-sm outline-none focus:border-brand-400"
                        >
                          <option value="">Ajouter un plat…</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} — {formatFCFA(product.price)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!addProductId || busy}
                          onClick={() => {
                            const product = products.find(
                              (p) => p.id === addProductId
                            );
                            if (!product) return;
                            setDraftLines((prev) => {
                              const existing = prev.find(
                                (l) => l.productId === product.id
                              );
                              if (existing) {
                                return prev.map((l) =>
                                  l.productId === product.id
                                    ? { ...l, qty: Math.min(99, l.qty + 1) }
                                    : l
                                );
                              }
                              return [
                                ...prev,
                                {
                                  productId: product.id,
                                  name: product.name,
                                  price: product.price,
                                  qty: 1,
                                },
                              ];
                            });
                            setAddProductId("");
                          }}
                          className="shrink-0 rounded-full bg-brand-500 px-3 py-2 text-ink disabled:opacity-50"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <label className="mt-3 block">
                        <span className="mb-1 block text-xs font-medium text-ink-soft">
                          Précisions
                        </span>
                        <textarea
                          value={draftNote}
                          onChange={(e) => setDraftNote(e.target.value)}
                          rows={2}
                          placeholder="Moins de sel, beaucoup de piment…"
                          className="w-full rounded-card border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                        />
                      </label>

                      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                        <span className="text-sm text-ink-soft">Total</span>
                        <span className="font-amount text-lg font-bold tabular-nums text-brand-700">
                          {formatFCFA(draftTotal)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void savePendingOnly(order)}
                          className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-ink-soft hover:bg-surface-soft disabled:opacity-50"
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          disabled={busy || draftLines.length === 0}
                          onClick={() => void validatePending(order)}
                          className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-2 text-ink hover:bg-emerald-600 disabled:opacity-50"
                        >
                          <Send size={13} /> Valider → cuisine
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void cancelOrder(order)}
                          className="flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Ban size={13} /> Refuser
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                  <ul className="my-3 space-y-2 border-y border-line py-3">
                    {order.lines.map(({ product, qty }) => (
                      <li
                        key={product.id}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium text-ink">
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
                    <p className="mb-3 rounded-card bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
                      {order.note}
                    </p>
                  )}

                  {(order.customerPhone || order.deliveryAddress) && (
                    <div className="mb-3 rounded-card border border-line bg-surface-muted px-3 py-2 text-sm text-ink-soft">
                      {order.customerPhone && (
                        <p>Tél. : {order.customerPhone}</p>
                      )}
                      {order.deliveryAddress && (
                        <p>Livraison : {order.deliveryAddress}</p>
                      )}
                    </div>
                  )}

                  {order.channel !== "livraison" &&
                    order.status !== "annule" && (
                      <div className="mb-3 space-y-2">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-ink-soft">
                            Table
                          </span>
                          <select
                            disabled={busy}
                            value={order.restaurantTableId ?? ""}
                            onChange={(event) =>
                              void changeTable(order, event.target.value)
                            }
                            className="w-full rounded-card border border-line bg-surface-muted px-2.5 py-2 text-sm outline-none focus:border-brand-400 disabled:opacity-50"
                          >
                            <option value="">Sans table</option>
                            {tables.map((table) => (
                              <option key={table.id} value={table.id}>
                                {table.label}
                                {table.status !== "libre"
                                  ? ` (${table.status})`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        {order.restaurantTableId &&
                          tables.find((t) => t.id === order.restaurantTableId)
                            ?.status !== "libre" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void clearTable(order)}
                              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-emerald-200 px-3 py-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <RotateCcw size={13} /> Vider la table
                            </button>
                          )}
                      </div>
                    )}

                  <div className="flex flex-wrap justify-end gap-2">
                    {scope === "a_livrer" && order.status === "pret" && (
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
                    {scope === "a_livrer" &&
                      order.status === "en_livraison" && (
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
                    </>
                  )}
                  </div>
                  )}
                </article>
              );
            })}
            </div>
            <ListPagination
              page={historyPage}
              pageCount={listPageCount}
              totalItems={filtered.length}
              itemLabel="commande"
              onPageChange={setHistoryPage}
              className="mx-auto mt-4 max-w-6xl"
              ariaLabel="Pagination des commandes"
            />
          </>
        )}
      </div>
    </div>
  );
}
