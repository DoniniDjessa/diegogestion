"use client";

import { X } from "lucide-react";
import { CHANNEL_META, formatFCFA } from "@/lib/data";
import { orderCode } from "@/lib/order-code";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  a_valider: "À valider",
  en_attente: "Cuisine",
  preparation: "Préparation",
  pret: "Prête",
  servi: "Servie",
  en_livraison: "En livraison",
  livre: "Livrée",
  annule: "Annulée",
};

const PAYMENT_LABELS: Record<string, string> = {
  especes: "Espèces",
  mobile_money: "Mobile Money",
  carte: "Carte",
};

type SaleDetailSidebarProps = {
  order: Order;
  onClose: () => void;
};

export function SaleDetailSidebar({ order, onClose }: SaleDetailSidebarProps) {
  const code = orderCode(order.number, order.createdAt);
  const payment =
    order.paymentMethod != null
      ? (PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod)
      : order.customerId
        ? "En ligne"
        : "—";

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-line bg-surface shadow-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            Détail vente
          </p>
          <p className="font-mono text-sm font-bold">{code}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-surface-soft"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
        <dl className="space-y-3 text-xs">
          <div>
            <dt className="text-ink-faint">Date</dt>
            <dd className="font-medium">
              {new Date(order.createdAt).toLocaleString("fr-FR")}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">Canal</dt>
            <dd>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  CHANNEL_META[order.channel]?.color ?? "border-line"
                }`}
              >
                {CHANNEL_META[order.channel]?.label ?? order.channel}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">Statut</dt>
            <dd className="font-medium">
              {STATUS_LABELS[order.status] ?? order.status}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">Paiement</dt>
            <dd className="font-medium">{payment}</dd>
          </div>
          {order.table && (
            <div>
              <dt className="text-ink-faint">Table</dt>
              <dd className="font-medium">{order.table}</dd>
            </div>
          )}
          {order.customerPhone && (
            <div>
              <dt className="text-ink-faint">Téléphone</dt>
              <dd className="font-medium">{order.customerPhone}</dd>
            </div>
          )}
          {order.deliveryAddress && (
            <div>
              <dt className="text-ink-faint">Adresse</dt>
              <dd className="font-medium">{order.deliveryAddress}</dd>
            </div>
          )}
          {order.note && (
            <div>
              <dt className="text-ink-faint">Note</dt>
              <dd className="text-ink-soft">{order.note}</dd>
            </div>
          )}
        </dl>

        <h3 className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          Articles
        </h3>
        <ul className="divide-y divide-line rounded-card border border-line">
          {order.lines.map(({ product, qty, note }) => (
            <li
              key={`${order.id}-${product.id}-${note ?? ""}`}
              className="flex items-start justify-between gap-2 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="font-medium leading-snug">
                  {qty}× {product.name}
                </p>
                {note && (
                  <p className="text-[11px] text-ink-faint">{note}</p>
                )}
              </div>
              <span className="shrink-0 font-semibold">
                {formatFCFA(product.price * qty)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between rounded-card border border-line bg-surface-soft px-3 py-2.5">
          <span className="text-xs font-semibold text-ink-soft">Total</span>
          <span className="font-display text-base font-bold">
            {formatFCFA(order.total)}
          </span>
        </div>
      </div>
    </aside>
  );
}
