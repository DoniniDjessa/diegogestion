"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  Clock3,
  History,
  MapPin,
  Minus,
  Phone,
  Plus,
  Printer,
  ShoppingBasket,
  Smartphone,
  Trash2,
} from "lucide-react";
import { CHANNEL_META, formatFCFA } from "@/lib/data";
import { cartChange, cartTotal, useCart } from "@/lib/store";
import type { Order, OrderChannel, PaymentMethod, RestaurantTable } from "@/lib/types";
import {
  createPosOrder,
  fetchAllOrders,
  fetchRestaurantTables,
  setOrderPaymentStatus,
} from "@/lib/supabase/repository";
import { printOrderReceipt } from "@/lib/receipt";
import { orderCode } from "@/lib/order-code";

const CHANNELS: OrderChannel[] = ["table", "livraison"];

const PAYMENTS: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: "especes", label: "Espèces", icon: Banknote },
  { id: "mobile_money", label: "Mobile Money", icon: Smartphone },
];

type CartTab = "commander" | "attente" | "historique";

const TABS: { id: CartTab; label: string; icon: typeof ShoppingBasket }[] = [
  { id: "commander", label: "Commander", icon: ShoppingBasket },
  { id: "attente", label: "En attente", icon: Clock3 },
  { id: "historique", label: "Historique", icon: History },
];

export function TicketPanel({ onCheckout }: { onCheckout?: () => void }) {
  const {
    lines,
    channel,
    payment,
    restaurantTableId,
    amountReceived,
    setQty,
    remove,
    setChannel,
    setPayment,
    setRestaurantTableId,
    setAmountReceived,
    clear,
  } = useCart();
  const total = cartTotal(lines);
  const change = cartChange(amountReceived, total);
  const [tab, setTab] = useState<CartTab>("commander");
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");

  useEffect(() => {
    void fetchRestaurantTables()
      .then(setTables)
      .catch(() => setTables([]));
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const all = await fetchAllOrders();
      setOrders(all);
      setError(null);
    } catch (cause) {
      setOrders([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible de charger les commandes."
      );
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (tab === "attente" || tab === "historique") void loadOrders();
  }, [loadOrders, tab]);

  const pendingOrders = orders.filter(
    (order) =>
      order.paymentStatus === "en_attente" && order.status !== "annule"
  );
  const paidOrders = orders
    .filter(
      (order) => order.paymentStatus === "paye" && order.status !== "annule"
    )
    .slice(0, 40);

  function selectChannel(next: OrderChannel) {
    setChannel(next);
    setError(null);
    if (next !== "livraison") {
      setDeliveryPhone("");
      setDeliveryLocation("");
    }
  }

  async function handleCheckout() {
    if (lines.length === 0 || submitting) return;

    if (channel === "livraison") {
      if (!deliveryPhone.trim()) {
        setError("Indiquez le numéro de téléphone pour la livraison.");
        setTab("commander");
        return;
      }
      if (!deliveryLocation.trim()) {
        setError("Indiquez le lieu de livraison.");
        setTab("commander");
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const deliveryNote =
        channel === "livraison"
          ? `Livraison — Tél: ${deliveryPhone.trim()} — Lieu: ${deliveryLocation.trim()}`
          : undefined;
      const tableLabel = tables.find((t) => t.id === restaurantTableId)?.label;
      const order = await createPosOrder({
        channel,
        payment,
        restaurantTableId: restaurantTableId ?? undefined,
        note: deliveryNote,
        items: lines.map(({ product, qty }) => ({
          productId: product.id,
          quantity: qty,
        })),
      });

      setCreatedOrder({
        id: order.id,
        number: order.orderNumber,
        channel,
        status: "en_attente",
        lines: lines.map(({ product, qty }) => ({ product, qty })),
        createdAt: new Date().toISOString(),
        table: tableLabel,
        restaurantTableId: restaurantTableId ?? undefined,
        note: deliveryNote,
        paymentMethod: payment,
        paymentStatus: "en_attente",
        total: order.total,
      });
      clear();
      setDeliveryPhone("");
      setDeliveryLocation("");
      setTab("attente");
      void loadOrders();
      onCheckout?.();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : typeof cause === "object" &&
              cause !== null &&
              "message" in cause &&
              typeof (cause as { message: unknown }).message === "string"
            ? (cause as { message: string }).message
            : "Commande refusée. Connectez-vous avec un compte staff.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function printOrder(order: Order) {
    try {
      printOrderReceipt(order);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Impression impossible."
      );
    }
  }

  async function markPaid(order: Order) {
    if (payingId) return;
    setPayingId(order.id);
    setError(null);
    try {
      await setOrderPaymentStatus(order.id, "paye");
      setCreatedOrder(null);
      await loadOrders();
      setTab("historique");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Paiement non enregistré."
      );
    } finally {
      setPayingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Tabs haut — flux UI comme le modèle */}
      <div className="grid grid-cols-3 gap-1 border-b border-line bg-white p-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          const badge =
            id === "attente"
              ? pendingOrders.length
              : id === "historique"
                ? paidOrders.length
                : 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setCreatedOrder(null);
              }}
              className={`relative flex flex-col items-center gap-1 rounded-2xl px-0.5 py-2 transition-all ${
                active
                  ? "diego-gradient text-white shadow-card"
                  : "text-ink-soft hover:bg-surface-soft hover:text-ink"
              }`}
            >
              <Icon size={14} />
              <span className="font-sans text-[8px] font-semibold normal-case leading-tight tracking-normal sm:text-[9px]">
                {label}
              </span>
              {badge > 0 && (
                <span
                  className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-amount text-[9px] font-bold ${
                    active
                      ? "bg-white text-brand-700"
                      : "bg-amber-500 text-white"
                  }`}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {createdOrder && tab !== "historique" && tab !== "attente" && (
        <div className="mx-3 mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center">
          <p className="text-2xs text-emerald-800">
            Commande #{createdOrder.number} en attente de paiement
            {createdOrder.table ? ` · ${createdOrder.table}` : ""}.
          </p>
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => printOrder(createdOrder)}
              className="flex flex-1 items-center justify-center gap-1 rounded-full border border-emerald-300 py-1.5 text-emerald-700"
            >
              <Printer size={12} /> Ticket
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatedOrder(null);
                setTab("attente");
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-full diego-gradient py-1.5 text-white"
            >
              <Clock3 size={12} /> En attente
            </button>
          </div>
        </div>
      )}

      {tab === "commander" && (
        <>
          <div className="diego-gradient mx-3 mt-3 rounded-2xl px-4 py-3 text-white shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-white">
                  Nouvelle commande
                </h2>
                <p className="mt-0.5 text-2xs text-white/80">
                  {new Date().toLocaleDateString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
              {lines.length > 0 && (
                <button
                  onClick={clear}
                  className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-white hover:bg-white/25"
                >
                  <Trash2 size={11} /> Vider
                </button>
              )}
            </div>
            <div className="mt-2.5 flex gap-1 rounded-full bg-black/10 p-1">
              {CHANNELS.map((c) => (
                <button
                  key={c}
                  onClick={() => selectChannel(c)}
                  className={`flex-1 rounded-full px-1 py-1.5 transition-colors ${
                    channel === c
                      ? "bg-white text-brand-700 shadow-card"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  {CHANNEL_META[c].label}
                </button>
              ))}
            </div>

            <div className="mt-2.5 flex gap-1 rounded-full bg-black/10 p-1">
              {PAYMENTS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPayment(id)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-full px-1 py-1.5 transition-colors ${
                    payment === id
                      ? "bg-white text-brand-700 shadow-card"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <Icon size={12} />
                  <span className="text-[10px] font-semibold normal-case tracking-normal">
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {channel === "table" && (
              <label className="mt-2.5 block">
                <span className="mb-1 block text-2xs text-white/80">Table</span>
                <select
                  value={restaurantTableId ?? ""}
                  onChange={(event) =>
                    setRestaurantTableId(event.target.value || null)
                  }
                  className="w-full rounded-card border-0 bg-white/95 px-2.5 py-2 text-xs text-ink outline-none"
                >
                  <option value="">Sans table</option>
                  {tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.label}
                      {table.status !== "libre" ? ` (${table.status})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {channel === "livraison" && (
              <div className="mt-2.5 space-y-2">
                <label className="block">
                  <span className="mb-1 flex items-center gap-1 text-2xs text-white/80">
                    <Phone size={11} /> Numéro à appeler
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={deliveryPhone}
                    onChange={(event) => setDeliveryPhone(event.target.value)}
                    placeholder="Ex. 07 00 00 00 00"
                    className="w-full rounded-card border-0 bg-white/95 px-2.5 py-2 text-xs text-ink outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 flex items-center gap-1 text-2xs text-white/80">
                    <MapPin size={11} /> Lieu de livraison
                  </span>
                  <input
                    type="text"
                    value={deliveryLocation}
                    onChange={(event) =>
                      setDeliveryLocation(event.target.value)
                    }
                    placeholder="Quartier, repère…"
                    className="w-full rounded-card border-0 bg-white/95 px-2.5 py-2 text-xs text-ink outline-none"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2.5">
            {lines.length === 0 ? (
              <p className="mt-8 text-center text-2xs text-ink-faint">
                Touchez un produit pour l&apos;ajouter au ticket.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {lines.map(({ product, qty }) => (
                  <li
                    key={product.id}
                    className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-2 py-1.5 shadow-card"
                  >
                    <button
                      onClick={() => remove(product.id)}
                      className="text-red-500 hover:text-red-600"
                      aria-label="Retirer"
                    >
                      <Trash2 size={12} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans text-[10px] font-medium normal-case leading-tight tracking-normal">
                        {product.name}
                      </p>
                      <p className="text-[9px] text-ink-faint tabular-nums">
                        {formatFCFA(product.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => setQty(product.id, qty - 1)}
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-surface-soft"
                        aria-label="Diminuer"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="w-4 text-center text-[10px] font-semibold tabular-nums">
                        {qty}
                      </span>
                      <button
                        onClick={() => setQty(product.id, qty + 1)}
                        className="flex h-5 w-5 items-center justify-center rounded-full diego-gradient text-white"
                        aria-label="Augmenter"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                    <span className="w-14 text-right text-[10px] font-semibold tabular-nums text-brand-700">
                      {formatFCFA(product.price * qty)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-line px-3 py-3">
            {error && (
              <p className="mb-2 rounded-card border border-red-200 bg-red-50 px-2 py-1.5 text-2xs text-red-700">
                {error}
              </p>
            )}
            <div className="mb-2 space-y-1.5 rounded-2xl border border-line bg-white p-2.5">
              <label className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-ink-soft">Remis</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  inputMode="numeric"
                  value={amountReceived || ""}
                  onChange={(event) =>
                    setAmountReceived(Number(event.target.value) || 0)
                  }
                  placeholder="0"
                  className="w-28 rounded-lg border border-line bg-surface-muted px-2 py-1 text-right font-amount text-xs font-semibold tabular-nums outline-none focus:border-brand-400"
                />
              </label>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-ink-soft">Monnaie</span>
                <span className="font-amount text-xs font-bold tabular-nums text-emerald-700">
                  {formatFCFA(change)}
                </span>
              </div>
            </div>
            <div className="mb-2.5 flex items-center justify-between rounded-2xl bg-surface-soft px-3 py-2">
              <span className="text-2xs text-ink-soft">Total</span>
              <span className="font-amount text-lg font-bold tabular-nums text-brand-700">
                {formatFCFA(total)}
              </span>
            </div>
            <button
              disabled={lines.length === 0 || submitting}
              onClick={() => void handleCheckout()}
              className="w-full rounded-full bg-emerald-500 py-3 text-white shadow-card transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-ink-faint/30"
            >
              {submitting
                ? "Envoi…"
                : `Commander ${total > 0 ? formatFCFA(total) : ""}`}
            </button>
          </div>
        </>
      )}

      {tab === "attente" && (
        <>
          <div className="diego-gradient mx-3 mt-3 rounded-2xl px-4 py-3 text-white shadow-card">
            <h2 className="font-display text-base font-bold text-white">
              En attente
            </h2>
            <p className="mt-0.5 text-2xs text-white/80">
              Ventes à encaisser — avec ou sans table
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {error && (
              <p className="mb-2 rounded-card border border-red-200 bg-red-50 px-2 py-1.5 text-2xs text-red-700">
                {error}
              </p>
            )}
            {ordersLoading ? (
              <p className="mt-8 text-center text-2xs text-ink-faint">
                Chargement…
              </p>
            ) : pendingOrders.length === 0 ? (
              <p className="mt-8 text-center text-2xs text-ink-faint">
                Aucune vente en attente de paiement.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {pendingOrders.map((order) => (
                  <li
                    key={order.id}
                    className="rounded-xl border border-amber-200 bg-amber-50/40 px-2.5 py-2 shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-sans text-[11px] font-semibold normal-case tracking-normal">
                          #{orderCode(order.number, order.createdAt)}
                        </p>
                        <p className="truncate text-[9px] text-ink-faint">
                          {order.table ??
                            CHANNEL_META[order.channel]?.label ??
                            "Sans table"}{" "}
                          ·{" "}
                          {new Date(order.createdAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="mt-0.5 text-[9px] text-ink-soft">
                          {order.lines
                            .slice(0, 2)
                            .map((line) => `${line.qty}× ${line.product.name}`)
                            .join(", ")}
                          {order.lines.length > 2 ? "…" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[10px] font-semibold tabular-nums text-brand-700">
                          {formatFCFA(order.total)}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => printOrder(order)}
                            className="flex items-center gap-1 rounded-full border border-line bg-white px-2 py-1 text-ink-soft hover:bg-surface-soft"
                          >
                            <Printer size={11} />
                          </button>
                          <button
                            type="button"
                            disabled={payingId === order.id}
                            onClick={() => void markPaid(order)}
                            className="rounded-full bg-emerald-500 px-2.5 py-1 text-[9px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                          >
                            {payingId === order.id ? "…" : "Payé"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {tab === "historique" && (
        <>
          <div className="diego-gradient mx-3 mt-3 rounded-2xl px-4 py-3 text-white shadow-card">
            <h2 className="font-display text-base font-bold text-white">
              Historique
            </h2>
            <p className="mt-0.5 text-2xs text-white/80">
              Ventes encaissées
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {error && (
              <p className="mb-2 rounded-card border border-red-200 bg-red-50 px-2 py-1.5 text-2xs text-red-700">
                {error}
              </p>
            )}
            {ordersLoading ? (
              <p className="mt-8 text-center text-2xs text-ink-faint">
                Chargement…
              </p>
            ) : paidOrders.length === 0 ? (
              <p className="mt-8 text-center text-2xs text-ink-faint">
                Aucune vente payée récente.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {paidOrders.map((order) => (
                  <li
                    key={order.id}
                    className="rounded-xl border border-line bg-white px-2.5 py-2 shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-sans text-[11px] font-semibold normal-case tracking-normal">
                          #{orderCode(order.number, order.createdAt)}
                        </p>
                        <p className="truncate text-[9px] text-ink-faint">
                          {order.table ?? CHANNEL_META[order.channel]?.label} ·{" "}
                          {new Date(order.createdAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="mt-0.5 text-[9px] text-ink-soft">
                          {order.lines
                            .slice(0, 2)
                            .map((line) => `${line.qty}× ${line.product.name}`)
                            .join(", ")}
                          {order.lines.length > 2 ? "…" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[10px] font-semibold tabular-nums text-brand-700">
                          {formatFCFA(order.total)}
                        </span>
                        <button
                          type="button"
                          onClick={() => printOrder(order)}
                          className="flex items-center gap-1 rounded-full border border-line px-2 py-1 text-ink-soft hover:bg-surface-soft"
                        >
                          <Printer size={11} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
