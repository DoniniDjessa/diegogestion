"use client";

import { useEffect, useRef, useState } from "react";
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
  | "salle";

export const KEYBOARD_ROUTE_LABELS: Record<KeyboardRoute, string> = {
  caisse: "Caisse",
  stock: "Stock",
  finances: "Finances",
  commandes: "Commandes",
  menu: "Menu",
  salle: "Salle",
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

function publish(
  realtime: RealtimeChannel | null,
  browser: BroadcastChannel | null,
  event: string,
  payload: unknown
) {
  void realtime?.send({ type: "broadcast", event, payload });
  browser?.postMessage({ event, payload });
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

function joinKeyboardChannel(
  onEvent: (event: string, payload: unknown) => void
) {
  const supabase = getSupabase();
  const realtime =
    supabase
      ?.channel(CHANNEL_NAME)
      .on("broadcast", { event: INPUT_EVENT }, ({ payload }) => {
        onEvent(INPUT_EVENT, payload);
      })
      .on("broadcast", { event: FOCUS_EVENT }, ({ payload }) => {
        onEvent(FOCUS_EVENT, payload);
      })
      .subscribe() ?? null;

  let browser: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    browser = new BroadcastChannel(CHANNEL_NAME);
    browser.onmessage = (event) => {
      if (event.data?.event) onEvent(event.data.event, event.data.payload);
    };
  }

  return {
    realtime,
    browser,
    publish: (event: string, payload: unknown) =>
      publish(realtime, browser, event, payload),
    dispose: () => {
      browser?.close();
      if (supabase && realtime) void supabase.removeChannel(realtime);
    },
  };
}

/** Clavier : affiche quelle page écoute actuellement. */
export function useKeyboardFocusTarget() {
  const [route, setRoute] = useState<KeyboardRoute | null>("caisse");

  useEffect(() => {
    const session = joinKeyboardChannel((event, payload) => {
      if (event !== FOCUS_EVENT) return;
      const next = payload as FocusPayload;
      if (next?.route && next.route in KEYBOARD_ROUTE_LABELS) {
        setRoute(next.route);
      }
    });
    return () => session.dispose();
  }, []);

  return route;
}

/** Clavier distant : envoie frappe / montants. */
export function usePosKeyboardSender() {
  const publishRef = useRef<((event: string, payload: unknown) => void) | null>(
    null
  );

  useEffect(() => {
    const session = joinKeyboardChannel(() => {
      /* sender only */
    });
    publishRef.current = session.publish;
    return () => {
      publishRef.current = null;
      session.dispose();
    };
  }, []);

  return (payload: KeyboardInputPayload) => {
    publishRef.current?.(INPUT_EVENT, payload);
  };
}

/**
 * Applique les événements du clavier distant uniquement si cette page
 * a le focus clavier (dernière page ouverte / active).
 */
export function usePosKeyboardReceiver(handlers: {
  route: KeyboardRoute;
  onQuery?: (next: string) => void;
  onAmount?: (next: number) => void;
  getQuery?: () => string;
  getAmount?: () => number;
}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const focusRef = useRef<KeyboardRoute | null>(
    handlers.route === "caisse" ? "caisse" : null
  );

  useEffect(() => {
    const session = joinKeyboardChannel((event, payload) => {
      if (event === FOCUS_EVENT) {
        const next = payload as FocusPayload;
        if (next?.route && next.route in KEYBOARD_ROUTE_LABELS) {
          focusRef.current = next.route;
        }
        return;
      }
      if (event !== INPUT_EVENT) return;

      const h = handlersRef.current;
      const focused = focusRef.current ?? "caisse";
      if (focused !== h.route) return;

      const input = payload as KeyboardInputPayload;
      if (input.target === "query" && h.onQuery) {
        h.onQuery(applyQueryAction(h.getQuery?.() ?? "", input));
      }
      if (input.target === "amount" && h.onAmount) {
        h.onAmount(applyAmountAction(h.getAmount?.() ?? 0, input));
      }
    });

    const claim = () => {
      session.publish(FOCUS_EVENT, {
        route: handlers.route,
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
      session.dispose();
    };
  }, [handlers.route]);
}
