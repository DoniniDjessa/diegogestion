"use client";

import Image from "next/image";
import { Receipt, Wifi, WifiOff } from "lucide-react";
import { CHANNEL_META, formatFCFA } from "@/lib/data";
import { cartTotal } from "@/lib/store";
import { useCustomerDisplayReceiver } from "@/lib/customer-display";
import { FoodImage } from "@/components/FoodImage";

export default function AffichagePage() {
  const { snapshot, connected } = useCustomerDisplayReceiver();
  const { lines, channel } = snapshot;
  const total = cartTotal(lines);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const channelMeta = CHANNEL_META[channel] ?? CHANNEL_META.table;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface-muted">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, #e7d8a8 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, #f3ead0 0%, transparent 50%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between gap-4 px-6 pb-2 pt-6 sm:px-10 sm:pt-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <Image
            src="/diego.png"
            alt="Chez Diego"
            width={220}
            height={110}
            priority
            className="h-auto w-32 object-contain sm:w-44"
          />
          <p className="hidden text-xs text-ink-soft sm:block sm:text-sm">
            Vérifiez votre commande
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-soft shadow-card sm:px-4 sm:py-2 sm:text-sm">
            {channelMeta.label}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm ${
              connected
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
            title={connected ? "Synchronisé avec la caisse" : "Connexion…"}
          >
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="hidden sm:inline">
              {connected ? "En direct" : "Hors ligne"}
            </span>
          </span>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col px-6 py-4 sm:px-10 sm:py-6">
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold sm:text-2xl">
                Votre ticket
              </h1>
              <p className="mt-0.5 text-xs text-ink-faint sm:text-sm">
                Mis à jour en temps réel depuis la caisse
              </p>
            </div>
            {itemCount > 0 && (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700 sm:text-sm">
                {itemCount} article{itemCount > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {lines.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface/80 px-6 text-center shadow-card backdrop-blur-sm">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600 sm:h-20 sm:w-20">
                <Receipt size={28} />
              </div>
              <p className="font-display text-2xl font-bold sm:text-3xl">
                En attente de commande
              </p>
              <p className="mt-3 max-w-md text-sm text-ink-soft sm:text-base">
                Les plats ajoutés à la caisse s&apos;affichent ici
                instantanément. Vérifiez le détail avant de payer.
              </p>
            </div>
          ) : (
            <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {lines.map(({ product, qty }) => (
                <li
                  key={product.id}
                  className="flex items-center gap-4 rounded-card border border-line bg-surface p-3 shadow-card sm:gap-5 sm:p-4"
                >
                  <FoodImage
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-16 w-16 shrink-0 rounded-card object-cover sm:h-20 sm:w-20"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base sm:text-xl">
                      {product.name}
                    </p>
                    <p className="mt-1 text-sm text-ink-soft sm:text-base">
                      {qty} × {formatFCFA(product.price)}
                    </p>
                  </div>
                  <p className="text-lg tabular-nums text-brand-600 sm:text-2xl">
                    {formatFCFA(product.price * qty)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <footer className="relative z-10 border-t border-line bg-surface px-6 py-5 shadow-[0_-8px_30px_rgba(16,24,40,0.06)] sm:px-10 sm:py-7">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <span className="text-base text-ink-soft sm:text-2xl">
            Total à payer
          </span>
          <span className="font-display text-3xl font-bold tabular-nums text-brand-600 sm:text-5xl">
            {formatFCFA(total)}
          </span>
        </div>
      </footer>
    </div>
  );
}
