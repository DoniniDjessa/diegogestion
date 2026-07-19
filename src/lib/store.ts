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
  add: (product: Product) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  setChannel: (channel: OrderChannel) => void;
  setPayment: (payment: PaymentMethod) => void;
  setRestaurantTableId: (tableId: string | null) => void;
  clear: () => void;
}

export const useCart = create<CartState>((set) => ({
  lines: [],
  channel: "table",
  payment: "especes",
  restaurantTableId: null,
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
  clear: () => set({ lines: [], restaurantTableId: null }),
}));

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
}
