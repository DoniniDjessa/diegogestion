"use client";

import Image from "next/image";
import { formatFCFA } from "@/lib/data";
import { cartChange, cartTotal } from "@/lib/store";
import { useCustomerDisplayReceiver } from "@/lib/customer-display";
import { FoodImage } from "@/components/FoodImage";

export default function AffichagePage() {
  const { snapshot } = useCustomerDisplayReceiver();
  const { lines, amountReceived } = snapshot;
  const total = cartTotal(lines);
  const change = cartChange(amountReceived, total);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-transparent text-ink">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 0% 0%, rgba(194,162,76,0.22) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(166,136,59,0.18) 0%, transparent 50%)",
        }}
      />

      <header className="relative z-10 flex items-center gap-2.5 px-5 py-3.5 sm:px-7">
        <Image
          src="/diego.png"
          alt="Chez Diego"
          width={96}
          height={48}
          priority
          className="h-8 w-auto object-contain sm:h-9"
        />
      </header>

      <main className="relative z-10 grid min-h-0 flex-1 grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.85fr)] gap-4 px-5 pb-5 sm:gap-5 sm:px-7 sm:pb-7">
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-[#c2a24c]/25 bg-white/70 shadow-panel backdrop-blur-sm">
          <div className="flex shrink-0 items-end justify-between gap-3 border-b border-[#c2a24c]/20 px-5 py-4 sm:px-6">
            <div>
              <p className="font-button text-[10px] uppercase tracking-[0.22em] text-brand-600">
                Commande en cours
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Votre sélection
              </h1>
            </div>
            {itemCount > 0 && (
              <span className="rounded-full border border-brand-300 bg-brand-50 px-3 py-1 font-button text-[10px] uppercase tracking-[0.14em] text-brand-700">
                {itemCount} article{itemCount > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {lines.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <div className="mb-5 h-px w-16 bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
              <p className="font-display text-2xl font-bold text-ink sm:text-3xl">
                Bienvenue chez Diego
              </p>
              <p className="mt-3 max-w-sm text-sm font-light leading-relaxed text-ink-soft">
                Votre commande apparaîtra ici au fur et à mesure.
              </p>
              <div className="mt-5 h-px w-16 bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
            </div>
          ) : (
            <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4 sm:p-5">
              {lines.map(({ product, qty }) => (
                <li
                  key={product.id}
                  className="flex items-center gap-3.5 rounded-2xl border border-[#c2a24c]/15 bg-white/80 px-3.5 py-3 shadow-card"
                >
                  <div className="relative h-[3.75rem] w-[3.75rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-[#c2a24c]/20 sm:h-16 sm:w-16">
                    <FoodImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full diego-gradient px-1.5 font-amount text-[10px] font-semibold text-white">
                      {qty}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-script text-lg leading-6 text-ink sm:text-xl sm:leading-7">
                      {product.name}
                    </p>
                    <p className="mt-0.5 font-amount text-xs font-medium tabular-nums text-ink-faint">
                      {formatFCFA(product.price)} l’unité
                    </p>
                  </div>
                  <p className="shrink-0 font-amount text-lg font-semibold tabular-nums text-brand-700 sm:text-xl">
                    {formatFCFA(product.price * qty)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Montants regroupés dans une seule carte */}
        <aside className="flex min-h-0">
          <div className="flex w-full flex-col overflow-hidden rounded-[1.75rem] border border-[#c2a24c]/25 bg-white/75 shadow-panel backdrop-blur-sm">
            <div className="border-b border-[#c2a24c]/15 px-5 py-4 sm:px-6">
              <p className="font-button text-[10px] uppercase tracking-[0.22em] text-brand-600">
                Règlement
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">
                Synthèse
              </h2>
            </div>

            <div className="flex flex-1 flex-col justify-between gap-4 p-5 sm:p-6">
              <div className="space-y-4">
                <div className="rounded-2xl bg-brand-50/80 px-4 py-4">
                  <p className="font-button text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                    Montant remis
                  </p>
                  <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight text-ink sm:text-4xl">
                    {formatFCFA(amountReceived)}
                  </p>
                </div>

                <div className="rounded-2xl bg-emerald-50 px-4 py-4">
                  <p className="font-button text-[10px] uppercase tracking-[0.18em] text-emerald-700/70">
                    Monnaie à rendre
                  </p>
                  <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight text-emerald-700 sm:text-4xl">
                    {formatFCFA(change)}
                  </p>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[1.35rem] diego-gradient p-5 shadow-panel sm:p-6">
                <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
                <p className="relative font-button text-[11px] uppercase tracking-[0.22em] text-white/85">
                  Total à payer
                </p>
                <p className="relative mt-3 font-amount text-4xl font-bold leading-none tabular-nums tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
                  {formatFCFA(total)}
                </p>
                <p className="relative mt-4 text-xs font-light text-white/75">
                  Merci de votre visite
                </p>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
