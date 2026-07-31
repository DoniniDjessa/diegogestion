"use client";

import { useEffect } from "react";

/** Registers the app service worker (shared origin, distinct manifests). */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* ignore */
    });
  }, []);

  return null;
}
