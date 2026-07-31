"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Delete } from "lucide-react";
import { formatFCFA } from "@/lib/data";
import { cartChange, cartTotal } from "@/lib/store";
import { useCustomerDisplayReceiver } from "@/lib/customer-display";
import {
  KEYBOARD_ROUTE_LABELS,
  useKeyboardFocusTarget,
  usePosKeyboardSender,
  type KeyboardTarget,
} from "@/lib/pos-keyboard";
import { PwaInstallButton } from "@/components/PwaInstallButton";

const LETTER_ROWS = [
  ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
  ["W", "X", "C", "V", "B", "N", "'", "-", "."],
];

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

function KeyButton({
  label,
  onPress,
  className = "",
}: {
  label: React.ReactNode;
  onPress: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`flex min-h-[3.1rem] items-center justify-center rounded-2xl border border-[#c2a24c]/25 bg-white/90 font-amount text-lg font-semibold text-ink shadow-card transition active:scale-[0.97] active:bg-brand-50 touch-manipulation sm:min-h-[3.4rem] sm:text-xl ${className}`}
    >
      {label}
    </button>
  );
}

export default function ClavierPage() {
  const send = usePosKeyboardSender();
  const focusRoute = useKeyboardFocusTarget();
  const { snapshot, connected } = useCustomerDisplayReceiver();
  const [target, setTarget] = useState<KeyboardTarget>("amount");
  const [localQuery, setLocalQuery] = useState("");
  const [localAmountDigits, setLocalAmountDigits] = useState("0");

  const total = cartTotal(snapshot.lines);
  const amount = snapshot.amountReceived;
  const change = cartChange(amount, total);

  useEffect(() => {
    setLocalAmountDigits(String(Math.max(0, Math.floor(amount) || 0)));
  }, [amount]);

  const pressLetter = useCallback(
    (ch: string) => {
      setTarget("query");
      setLocalQuery((q) => {
        const next = (q + ch).slice(0, 64);
        send({ target: "query", action: "set", value: next });
        return next;
      });
    },
    [send]
  );

  const pressSpace = useCallback(() => {
    setTarget("query");
    setLocalQuery((q) => {
      const next = `${q} `;
      send({ target: "query", action: "set", value: next });
      return next;
    });
  }, [send]);

  const backspaceQuery = useCallback(() => {
    setTarget("query");
    setLocalQuery((q) => {
      const next = q.slice(0, -1);
      send({ target: "query", action: "set", value: next });
      return next;
    });
  }, [send]);

  const clearQuery = useCallback(() => {
    setTarget("query");
    setLocalQuery("");
    send({ target: "query", action: "clear" });
  }, [send]);

  const pressDigit = useCallback(
    (digit: string) => {
      setTarget("amount");
      setLocalAmountDigits((prev) => {
        const base = prev === "0" ? "" : prev;
        const next = `${base}${digit}`.slice(0, 9) || "0";
        send({ target: "amount", action: "set", value: Number(next) });
        return next;
      });
    },
    [send]
  );

  const backspaceAmount = useCallback(() => {
    setTarget("amount");
    setLocalAmountDigits((prev) => {
      const next = prev.slice(0, -1) || "0";
      send({ target: "amount", action: "set", value: Number(next) });
      return next;
    });
  }, [send]);

  const clearAmount = useCallback(() => {
    setTarget("amount");
    setLocalAmountDigits("0");
    send({ target: "amount", action: "clear" });
  }, [send]);

  const quickAmount = useCallback(
    (value: number) => {
      setTarget("amount");
      setLocalAmountDigits(String(value));
      send({ target: "amount", action: "quick", value });
    },
    [send]
  );

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-transparent text-ink">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 0% 0%, rgba(194,162,76,0.22) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(166,136,59,0.18) 0%, transparent 50%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Image
            src="/diego.png"
            alt="Chez Diego"
            width={88}
            height={44}
            priority
            className="h-8 w-auto object-contain"
          />
          <div>
            <p className="font-button text-[10px] uppercase tracking-[0.2em] text-brand-600">
              Clavier caisse
            </p>
            <p className="text-[11px] text-ink-soft">
              {connected ? "Synchronisé" : "En attente de la caisse…"}
              {" · "}
              Saisie →{" "}
              <span className="font-semibold text-ink">
                {focusRoute
                  ? KEYBOARD_ROUTE_LABELS[focusRoute]
                  : "Caisse"}
              </span>
            </p>
          </div>
        </div>
        <PwaInstallButton label="Installer" />
      </header>

      <div className="relative z-10 grid shrink-0 grid-cols-2 gap-3 px-4 pb-3 sm:px-6">
        <button
          type="button"
          onClick={() => setTarget("query")}
          className={`rounded-2xl border px-4 py-3 text-left transition ${
            target === "query"
              ? "border-brand-500 bg-brand-50 shadow-card"
              : "border-[#c2a24c]/20 bg-white/70"
          }`}
        >
          <p className="font-button text-[10px] uppercase tracking-[0.16em] text-brand-600">
            Recherche
          </p>
          <p className="mt-1 min-h-[1.5rem] truncate font-amount text-lg font-semibold">
            {localQuery || (
              <span className="font-sans text-sm font-normal text-ink-faint">
                Tapez un produit…
              </span>
            )}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setTarget("amount")}
          className={`rounded-2xl border px-4 py-3 text-left transition ${
            target === "amount"
              ? "border-brand-500 bg-brand-50 shadow-card"
              : "border-[#c2a24c]/20 bg-white/70"
          }`}
        >
          <p className="font-button text-[10px] uppercase tracking-[0.16em] text-brand-600">
            Montant remis
          </p>
          <p className="mt-1 font-amount text-lg font-semibold tabular-nums">
            {formatFCFA(Number(localAmountDigits) || 0)}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-soft">
            Total {formatFCFA(total)}
            {change > 0 ? ` · Monnaie ${formatFCFA(change)}` : ""}
          </p>
        </button>
      </div>

      <main className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.75fr)] sm:gap-4 sm:px-6 sm:pb-6">
        {/* AZERTY */}
        <section className="flex min-h-0 flex-col rounded-[1.75rem] border border-[#c2a24c]/25 bg-white/70 p-3 shadow-panel backdrop-blur-sm sm:p-4">
          <p className="mb-2 font-button text-[10px] uppercase tracking-[0.18em] text-brand-600">
            Clavier
          </p>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 sm:gap-2">
            {LETTER_ROWS.map((row) => (
              <div
                key={row.join("")}
                className="grid gap-1.5 sm:gap-2"
                style={{
                  gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                }}
              >
                {row.map((key) => (
                  <KeyButton
                    key={key}
                    label={key}
                    onPress={() => pressLetter(key === "." || key === "-" || key === "'" ? key : key.toLowerCase())}
                  />
                ))}
              </div>
            ))}
            <div className="grid grid-cols-[1fr_2.4fr_1fr_1fr] gap-1.5 sm:gap-2">
              <KeyButton
                label={<Delete size={18} />}
                onPress={backspaceQuery}
                className="bg-surface-soft"
              />
              <KeyButton
                label={
                  <span className="text-sm font-semibold normal-case tracking-normal">
                    Espace
                  </span>
                }
                onPress={pressSpace}
              />
              <KeyButton
                label="Effacer"
                onPress={clearQuery}
                className="bg-red-50 text-sm text-red-700"
              />
              <KeyButton
                label="123"
                onPress={() => setTarget("amount")}
                className="bg-brand-50 text-sm text-brand-700"
              />
            </div>
          </div>
        </section>

        {/* Keypad */}
        <section className="flex min-h-0 flex-col rounded-[1.75rem] border border-[#c2a24c]/25 bg-white/70 p-3 shadow-panel backdrop-blur-sm sm:p-4">
          <p className="mb-2 font-button text-[10px] uppercase tracking-[0.18em] text-brand-600">
            Pavé numérique
          </p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => quickAmount(v)}
                className="rounded-full border border-brand-300 bg-brand-50 px-2.5 py-1 font-amount text-xs font-semibold text-brand-700 touch-manipulation"
              >
                {formatFCFA(v)}
              </button>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-3 gap-1.5 sm:gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <KeyButton key={d} label={d} onPress={() => pressDigit(d)} />
            ))}
            <KeyButton
              label="C"
              onPress={clearAmount}
              className="bg-red-50 text-red-700"
            />
            <KeyButton label="0" onPress={() => pressDigit("0")} />
            <KeyButton label="00" onPress={() => pressDigit("00")} />
            <KeyButton
              label={<Delete size={18} />}
              onPress={backspaceAmount}
              className="col-span-3 bg-surface-soft"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
