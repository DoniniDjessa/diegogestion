"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

const CHANNEL_NAME = "diego-pos-keyboard";
const INPUT_EVENT = "keyboard-input";
const FOCUS_EVENT = "keyboard-focus";

export type KeyboardRoute =
  | "caisse"
  | "stock"
  | "finances"
  | "commandes"
  | "menu"
  | "salle"
  | "connexion"
  | "inscription"
  | "parametres"
  | "cuisine"
  | "livraisons"
  | "other";

export const KEYBOARD_ROUTE_LABELS: Record<KeyboardRoute, string> = {
  caisse: "Caisse",
  stock: "Stock",
  finances: "Finances",
  commandes: "Commandes",
  menu: "Menu",
  salle: "Salle",
  connexion: "Connexion",
  inscription: "Inscription",
  parametres: "Paramètres",
  cuisine: "Cuisine",
  livraisons: "Livraisons",
  other: "App",
};

export type KeyboardTarget = "query" | "amount";

export type KeyboardInputPayload =
  | {
      target: "query";
      action: "set" | "append" | "backspace" | "clear" | "space";
      value?: string;
    }
  | {
      target: "amount";
      action: "set" | "digit" | "backspace" | "clear" | "quick";
      value?: string | number;
    };

type FocusPayload = { route: KeyboardRoute };

type FallbackHandlers = {
  route: KeyboardRoute;
  onQuery?: (next: string) => void;
  onAmount?: (next: number) => void;
  getQuery?: () => string;
  getAmount?: () => number;
};

type BusListener = (event: string, payload: unknown) => void;

const fallbackHandlers = new Map<string, FallbackHandlers>();
const busListeners = new Set<BusListener>();
const seenMessageIds = new Map<string, number>();
let realtimeChannel: RealtimeChannel | null = null;
let browserChannel: BroadcastChannel | null = null;
let busRefCount = 0;

function pruneSeenIds(now: number) {
  if (seenMessageIds.size < 80) return;
  Array.from(seenMessageIds.entries()).forEach(([id, at]) => {
    if (now - at > 4000) seenMessageIds.delete(id);
  });
}

function emitLocal(event: string, raw: unknown) {
  let payload = raw;
  let id: string | null = null;
  if (
    raw &&
    typeof raw === "object" &&
    "id" in raw &&
    "payload" in raw &&
    typeof (raw as { id: unknown }).id === "string"
  ) {
    id = (raw as { id: string }).id;
    payload = (raw as { payload: unknown }).payload;
  }

  if (id) {
    const now = Date.now();
    if (seenMessageIds.has(id)) return;
    seenMessageIds.set(id, now);
    pruneSeenIds(now);
  }

  Array.from(busListeners).forEach((listener) => listener(event, payload));
}

function ensureBus() {
  if (busRefCount === 0) {
    const supabase = getSupabase();
    if (supabase) {
      realtimeChannel = supabase
        .channel(CHANNEL_NAME)
        .on("broadcast", { event: INPUT_EVENT }, ({ payload }) => {
          emitLocal(INPUT_EVENT, payload);
        })
        .on("broadcast", { event: FOCUS_EVENT }, ({ payload }) => {
          emitLocal(FOCUS_EVENT, payload);
        })
        .subscribe();
    }
    if (typeof BroadcastChannel !== "undefined") {
      browserChannel = new BroadcastChannel(CHANNEL_NAME);
      browserChannel.onmessage = (event) => {
        if (event.data?.event) emitLocal(event.data.event, event.data.payload);
      };
    }
  }
  busRefCount += 1;
}

function releaseBus() {
  busRefCount = Math.max(0, busRefCount - 1);
  if (busRefCount > 0) return;
  browserChannel?.close();
  browserChannel = null;
  const supabase = getSupabase();
  if (supabase && realtimeChannel) {
    void supabase.removeChannel(realtimeChannel);
  }
  realtimeChannel = null;
}

function publish(event: string, payload: unknown) {
  const envelope = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    payload,
  };
  void realtimeChannel?.send({ type: "broadcast", event, payload: envelope });
  browserChannel?.postMessage({ event, payload: envelope });
}

function subscribeBus(listener: BusListener) {
  ensureBus();
  busListeners.add(listener);
  return () => {
    busListeners.delete(listener);
    releaseBus();
  };
}

export function routeFromPathname(pathname: string): KeyboardRoute {
  if (pathname.startsWith("/caisse")) return "caisse";
  if (pathname.startsWith("/stock")) return "stock";
  if (pathname.startsWith("/finances")) return "finances";
  if (pathname.startsWith("/commandes")) return "commandes";
  if (pathname.startsWith("/parametres/menu") || pathname.startsWith("/menu"))
    return "menu";
  if (pathname.startsWith("/salle")) return "salle";
  if (pathname.startsWith("/connexion")) return "connexion";
  if (
    pathname.startsWith("/inscription") ||
    pathname.startsWith("/parametres/utilisateurs") ||
    pathname.startsWith("/utilisateurs")
  )
    return "inscription";
  if (pathname.startsWith("/cuisine")) return "cuisine";
  if (pathname.startsWith("/livraisons")) return "livraisons";
  if (pathname.startsWith("/parametres")) return "parametres";
  return "other";
}

function isEditableField(
  el: Element | null
): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) {
    return !el.disabled && !el.readOnly;
  }
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.disabled || el.readOnly) return false;
  const type = (el.type || "text").toLowerCase();
  return ![
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ].includes(type);
}

function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  const prototype =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function nextTextValue(
  current: string,
  payload: KeyboardInputPayload,
  maxLength: number
): string {
  if (payload.target === "query") {
    switch (payload.action) {
      case "clear":
        return "";
      case "set":
        return (payload.value ?? "").slice(0, maxLength);
      case "space":
        return `${current} `.slice(0, maxLength);
      case "backspace":
        return current.slice(0, -1);
      case "append": {
        const ch = payload.value ?? "";
        if (!ch) return current;
        return (current + ch).slice(0, maxLength);
      }
      default:
        return current;
    }
  }

  const digitsOnly = current.replace(/\D/g, "");
  switch (payload.action) {
    case "clear":
      return "";
    case "set":
    case "quick":
      return String(Math.max(0, Math.floor(Number(payload.value) || 0))).slice(
        0,
        maxLength
      );
    case "backspace":
      return digitsOnly.slice(0, -1);
    case "digit": {
      const d = String(payload.value ?? "");
      if (!/^\d{1,2}$/.test(d)) return current;
      const next = `${digitsOnly === "0" ? "" : digitsOnly}${d}`;
      return next.slice(0, Math.min(9, maxLength)) || "0";
    }
    default:
      return current;
  }
}

/** Types into the currently focused form field (React-controlled safe). */
export function applyKeyboardToFocusedField(
  payload: KeyboardInputPayload
): boolean {
  const el = document.activeElement;
  if (!isEditableField(el)) return false;

  const maxLength = el.maxLength && el.maxLength > 0 ? el.maxLength : 120;
  const next = nextTextValue(el.value, payload, maxLength);
  const preferNumber =
    el.type === "number" ||
    el.inputMode === "numeric" ||
    el.inputMode === "decimal";
  const valueToSet =
    preferNumber && payload.target === "amount"
      ? String(Number(next.replace(/\D/g, "")) || 0)
      : next;

  setNativeValue(el, valueToSet);
  try {
    const pos = valueToSet.length;
    el.setSelectionRange(pos, pos);
  } catch {
    /* number inputs may not support selection */
  }
  return true;
}

function applyAmountAction(
  current: number,
  payload: Extract<KeyboardInputPayload, { target: "amount" }>
): number {
  const asDigits = String(Math.max(0, Math.floor(current) || 0));
  switch (payload.action) {
    case "clear":
      return 0;
    case "set":
    case "quick":
      return Math.max(0, Math.floor(Number(payload.value) || 0));
    case "backspace":
      return Number(asDigits.slice(0, -1) || 0);
    case "digit": {
      const d = String(payload.value ?? "");
      if (!/^\d{1,2}$/.test(d)) return current;
      const next = `${asDigits === "0" ? "" : asDigits}${d}`;
      if (next.length > 9) return current;
      return Number(next);
    }
    default:
      return current;
  }
}

function applyQueryAction(
  current: string,
  payload: Extract<KeyboardInputPayload, { target: "query" }>
): string {
  switch (payload.action) {
    case "clear":
      return "";
    case "set":
      return payload.value ?? "";
    case "space":
      return `${current} `;
    case "backspace":
      return current.slice(0, -1);
    case "append": {
      const ch = payload.value ?? "";
      if (!ch || current.length >= 64) return current;
      return current + ch;
    }
    default:
      return current;
  }
}

/** Clavier : affiche quelle page écoute actuellement. */
export function useKeyboardFocusTarget() {
  const [route, setRoute] = useState<KeyboardRoute | null>("caisse");

  useEffect(() => {
    return subscribeBus((event, payload) => {
      if (event !== FOCUS_EVENT) return;
      const next = payload as FocusPayload;
      if (next?.route && next.route in KEYBOARD_ROUTE_LABELS) {
        setRoute(next.route);
      }
    });
  }, []);

  return route;
}

/** Clavier distant : envoie frappe / montants. */
export function usePosKeyboardSender() {
  useEffect(() => subscribeBus(() => {}), []);

  return (payload: KeyboardInputPayload) => {
    publish(INPUT_EVENT, payload);
  };
}

/**
 * Global bridge on the main app:
 * 1) always type into the focused form field
 * 2) otherwise update this page's search / amount fallbacks
 */
export function usePosKeyboardDomBridge() {
  const pathname = usePathname();
  const route = routeFromPathname(pathname);
  const routeRef = useRef(route);
  routeRef.current = route;

  useEffect(() => {
    if (
      pathname.startsWith("/clavier") ||
      pathname.startsWith("/affichage")
    ) {
      return;
    }

    const unsubscribe = subscribeBus((event, payload) => {
      if (event === FOCUS_EVENT) return;
      if (event !== INPUT_EVENT) return;

      const input = payload as KeyboardInputPayload;

      // 1) Focused input / textarea on this page (kept even if tab is backgrounded)
      if (applyKeyboardToFocusedField(input)) return;

      // 2) Page fallbacks only when this tab is the visible one
      if (document.visibilityState !== "visible") return;

      const handlers = Array.from(fallbackHandlers.values()).find(
        (h) => h.route === routeRef.current
      );
      if (!handlers) return;
      if (input.target === "query" && handlers.onQuery) {
        handlers.onQuery(applyQueryAction(handlers.getQuery?.() ?? "", input));
      }
      if (input.target === "amount" && handlers.onAmount) {
        handlers.onAmount(
          applyAmountAction(handlers.getAmount?.() ?? 0, input)
        );
      }
    });

    const claim = () => {
      publish(FOCUS_EVENT, {
        route: routeRef.current,
      } satisfies FocusPayload);
    };
    claim();
    const onVis = () => {
      if (document.visibilityState === "visible") claim();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", claim);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", claim);
      unsubscribe();
    };
  }, [pathname]);
}

/** Optional fallback when no input is focused (search bars, cart amount). */
export function usePosKeyboardReceiver(handlers: FallbackHandlers) {
  const keyRef = useRef(`kb-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const key = keyRef.current;
    fallbackHandlers.set(key, handlers);
    return () => {
      fallbackHandlers.delete(key);
    };
  });
}
