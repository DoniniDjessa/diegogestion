"use client";

import { create } from "zustand";
import type { OrderChannel, PaymentMethod, Product } from "./types";

export interface CartLine {
  product: Product;
  qty: number;
}

interface CartState {
  lines: CartLine[];
  channel: OrderChannel;
  payment: PaymentMethod;
  restaurantTableId: string | null;
  /** Montant remis par le client (FCFA). */
  amountReceived: number;
  add: (product: Product) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  setChannel: (channel: OrderChannel) => void;
  setPayment: (payment: PaymentMethod) => void;
  setRestaurantTableId: (tableId: string | null) => void;
  setAmountReceived: (amount: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>((set) => ({
  lines: [],
  channel: "table",
  payment: "especes",
  restaurantTableId: null,
  amountReceived: 0,
  add: (product) =>
    set((s) => {
      const existing = s.lines.find((l) => l.product.id === product.id);
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l
          ),
        };
      }
      return { lines: [...s.lines, { product, qty: 1 }] };
    }),
  remove: (productId) =>
    set((s) => ({ lines: s.lines.filter((l) => l.product.id !== productId) })),
  setQty: (productId, qty) =>
    set((s) => ({
      lines:
        qty <= 0
          ? s.lines.filter((l) => l.product.id !== productId)
          : s.lines.map((l) =>
              l.product.id === productId ? { ...l, qty } : l
            ),
    })),
  setChannel: (channel) =>
    set((s) => ({
      channel,
      restaurantTableId: channel === "livraison" ? null : s.restaurantTableId,
    })),
  setPayment: (payment) => set({ payment }),
  setRestaurantTableId: (restaurantTableId) =>
    set(() =>
      restaurantTableId
        ? { restaurantTableId, channel: "table" as const }
        : { restaurantTableId: null }
    ),
  setAmountReceived: (amountReceived) =>
    set({ amountReceived: Math.max(0, Math.floor(amountReceived) || 0) }),
  clear: () => set({ lines: [], restaurantTableId: null, amountReceived: 0 }),
}));

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
}

export function cartChange(amountReceived: number, total: number): number {
  if (amountReceived <= 0 || total <= 0) return 0;
  return Math.max(0, amountReceived - total);
}
