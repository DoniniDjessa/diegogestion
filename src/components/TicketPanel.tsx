"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  ClipboardList,
  CreditCard,
  MapPin,
  Minus,
  Phone,
  Plus,
  Printer,
  Smartphone,
  Trash2,
} from "lucide-react";
import { CHANNEL_META, formatFCFA } from "@/lib/data";
import { cartTotal, useCart } from "@/lib/store";
import type { Order, OrderChannel, PaymentMethod, RestaurantTable } from "@/lib/types";
import {
  createPosOrder,
  fetchRestaurantTables,
} from "@/lib/supabase/repository";
import { printOrderReceipt } from "@/lib/receipt";
import { FoodImage } from "@/components/FoodImage";

const CHANNELS: OrderChannel[] = ["table", "livraison"];

const PAYMENTS: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: "especes", label: "Espèces", icon: Banknote },
  { id: "mobile_money", label: "Mobile Money", icon: Smartphone },
  { id: "carte", label: "Carte", icon: CreditCard },
];

export function TicketPanel({ onCheckout }: { onCheckout?: () => void }) {
  const {
    lines,
    channel,
    payment,
    restaurantTableId,
    setQty,
    remove,
    setChannel,
    setPayment,
    setRestaurantTableId,
    clear,
  } = useCart();
  const total = cartTotal(lines);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
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
        return;
      }
      if (!deliveryLocation.trim()) {
        setError("Indiquez le lieu de livraison.");
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
      onCheckout?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Commande refusée. Connectez-vous avec un compte staff."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function printCreated() {
    if (!createdOrder) return;
    try {
      printOrderReceipt(createdOrder);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Impression impossible."
      );
    }
  }

  if (createdOrder) {
    return (
      <div className="flex h-full flex-col bg-surface">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
          <p className="rounded-card border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Commande #{createdOrder.number} envoyée en cuisine
            {createdOrder.table ? ` · ${createdOrder.table}` : ""}.
          </p>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              onClick={printCreated}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-3 text-ink hover:bg-brand-600"
            >
              <Printer size={14} /> Imprimer le ticket
            </button>
            <Link
              href="/commandes"
              className="flex w-full items-center justify-center gap-2 rounded-full border border-line py-3 text-ink-soft hover:bg-surface-soft"
            >
              <ClipboardList size={14} /> Voir les commandes
            </Link>
            <button
              type="button"
              onClick={() => setCreatedOrder(null)}
              className="w-full rounded-full py-2 text-ink-faint hover:text-ink"
            >
              Nouvelle commande
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="border-b border-line px-3 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold">Ticket en cours</h2>
          {lines.length > 0 && (
            <button
              onClick={clear}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-ink-faint hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={12} /> Vider
            </button>
          )}
        </div>
        <div className="mt-2.5 flex gap-1 rounded-full bg-surface-soft p-1">
          {CHANNELS.map((c) => (
            <button
              key={c}
              onClick={() => selectChannel(c)}
              className={`flex-1 rounded-full px-1 py-1.5 transition-colors ${
                channel === c
                  ? "bg-brand-500 text-ink shadow-card"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {CHANNEL_META[c].label}
            </button>
          ))}
        </div>

        {channel === "table" && (
          <label className="mt-3 block">
            <span className="mb-1 block text-2xs text-ink-soft">Table</span>
            <select
              value={restaurantTableId ?? ""}
              onChange={(event) =>
                setRestaurantTableId(event.target.value || null)
              }
              className="w-full rounded-card border border-line bg-surface-muted px-2.5 py-2 text-xs outline-none focus:border-brand-400"
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
          <div className="mt-3 space-y-2">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-2xs text-ink-soft">
                <Phone size={11} /> Numéro à appeler
              </span>
              <input
                type="tel"
                inputMode="tel"
                value={deliveryPhone}
                onChange={(event) => setDeliveryPhone(event.target.value)}
                placeholder="Ex. 07 00 00 00 00"
                className="w-full rounded-card border border-line bg-surface-muted px-2.5 py-2 text-xs outline-none focus:border-brand-400"
              />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-2xs text-ink-soft">
                <MapPin size={11} /> Lieu de livraison
              </span>
              <input
                type="text"
                value={deliveryLocation}
                onChange={(event) => setDeliveryLocation(event.target.value)}
                placeholder="Quartier, repère…"
                className="w-full rounded-card border border-line bg-surface-muted px-2.5 py-2 text-xs outline-none focus:border-brand-400"
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {lines.length === 0 ? (
          <p className="mt-8 text-center text-xs text-ink-faint">
            Touchez un produit pour l&apos;ajouter au ticket.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {lines.map(({ product, qty }) => (
              <li
                key={product.id}
                className="flex items-center gap-2 rounded-card border border-line bg-surface px-2 py-1.5 shadow-card"
              >
                <FoodImage
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-9 w-9 shrink-0 rounded-card object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{product.name}</p>
                  <p className="text-2xs text-ink-faint">
                    {formatFCFA(product.price)} × {qty}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQty(product.id, qty - 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-surface-soft"
                    aria-label="Diminuer"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-5 text-center text-xs font-semibold tabular-nums">
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty(product.id, qty + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-ink hover:bg-brand-600"
                    aria-label="Augmenter"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <button
                  onClick={() => remove(product.id)}
                  className="text-ink-faint hover:text-red-500"
                  aria-label="Retirer"
                >
                  <Trash2 size={13} />
                </button>
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
        <div className="mb-2.5 grid grid-cols-3 gap-1.5">
          {PAYMENTS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPayment(id)}
              className={`flex flex-col items-center gap-1 rounded-card border px-1 py-2 transition-colors ${
                payment === id
                  ? "border-brand-500 bg-brand-50 text-brand-600"
                  : "border-line text-ink-soft hover:bg-surface-soft"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        <div className="mb-2.5 flex items-center justify-between rounded-card bg-surface-soft px-3 py-2 text-sm">
          <span className="text-ink-soft">Total</span>
          <span className="text-lg font-bold tabular-nums">{formatFCFA(total)}</span>
        </div>
        <button
          disabled={lines.length === 0 || submitting}
          onClick={() => void handleCheckout()}
          className="w-full rounded-full bg-brand-500 py-3 text-ink shadow-card transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-ink-faint/30"
        >
          {submitting
            ? "Envoi…"
            : `Commander ${total > 0 ? formatFCFA(total) : ""}`}
        </button>
      </div>
    </div>
  );
}
