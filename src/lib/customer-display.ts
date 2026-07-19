"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { CartLine } from "@/lib/store";
import type { OrderChannel } from "@/lib/types";

const CHANNEL_NAME = "diego-customer-display";
const CART_EVENT = "cart-updated";
const REQUEST_EVENT = "request-cart";

export type CustomerDisplaySnapshot = {
  lines: CartLine[];
  channel: OrderChannel;
  updatedAt: string;
};

const EMPTY_SNAPSHOT: CustomerDisplaySnapshot = {
  lines: [],
  channel: "table",
  updatedAt: new Date(0).toISOString(),
};

function sendRealtime(
  channel: RealtimeChannel | null,
  snapshot: CustomerDisplaySnapshot
) {
  if (!channel) return;
  void channel.send({
    type: "broadcast",
    event: CART_EVENT,
    payload: snapshot,
  });
}

export function useCustomerDisplayBroadcaster(
  lines: CartLine[],
  channelType: OrderChannel
) {
  const realtimeRef = useRef<RealtimeChannel | null>(null);
  const browserRef = useRef<BroadcastChannel | null>(null);
  const snapshotRef = useRef<CustomerDisplaySnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    const supabase = getSupabase();
    const realtime =
      supabase
        ?.channel(CHANNEL_NAME)
        .on("broadcast", { event: REQUEST_EVENT }, () => {
          sendRealtime(realtimeRef.current, snapshotRef.current);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            sendRealtime(realtime, snapshotRef.current);
          }
        }) ?? null;
    realtimeRef.current = realtime;

    if (typeof BroadcastChannel !== "undefined") {
      const browser = new BroadcastChannel(CHANNEL_NAME);
      browser.onmessage = (event) => {
        if (event.data?.event === REQUEST_EVENT) {
          browser.postMessage({
            event: CART_EVENT,
            payload: snapshotRef.current,
          });
        }
      };
      browserRef.current = browser;
    }

    return () => {
      browserRef.current?.close();
      browserRef.current = null;
      if (supabase && realtime) void supabase.removeChannel(realtime);
      realtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const snapshot: CustomerDisplaySnapshot = {
      lines,
      channel: channelType,
      updatedAt: new Date().toISOString(),
    };
    snapshotRef.current = snapshot;
    sendRealtime(realtimeRef.current, snapshot);
    browserRef.current?.postMessage({ event: CART_EVENT, payload: snapshot });
  }, [channelType, lines]);
}

export function useCustomerDisplayReceiver() {
  const [snapshot, setSnapshot] =
    useState<CustomerDisplaySnapshot>(EMPTY_SNAPSHOT);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const acceptSnapshot = (payload: unknown) => {
      const next = payload as CustomerDisplaySnapshot;
      if (!next || !Array.isArray(next.lines)) return;
      setSnapshot(next);
    };

    const supabase = getSupabase();
    const realtime =
      supabase
        ?.channel(CHANNEL_NAME)
        .on("broadcast", { event: CART_EVENT }, ({ payload }) => {
          acceptSnapshot(payload);
        })
        .subscribe((status) => {
          setConnected(status === "SUBSCRIBED");
          if (status === "SUBSCRIBED") {
            void realtime?.send({
              type: "broadcast",
              event: REQUEST_EVENT,
              payload: {},
            });
          }
        }) ?? null;

    let browser: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      browser = new BroadcastChannel(CHANNEL_NAME);
      browser.onmessage = (event) => {
        if (event.data?.event === CART_EVENT) {
          acceptSnapshot(event.data.payload);
        }
      };
      browser.postMessage({ event: REQUEST_EVENT });
    }

    return () => {
      browser?.close();
      if (supabase && realtime) void supabase.removeChannel(realtime);
    };
  }, []);

  return { snapshot, connected };
}
