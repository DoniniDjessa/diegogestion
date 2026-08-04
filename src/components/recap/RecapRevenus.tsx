"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { BrandLoader } from "@/components/BrandLoader";
import { ListPagination } from "@/components/ListPagination";
import { formatFCFA } from "@/lib/data";
import { orderCode } from "@/lib/order-code";
import type { Order, OrderStatus, PaymentMethod } from "@/lib/types";
import { fetchAllOrders } from "@/lib/supabase/repository";

type DateFilter = "today" | "week" | "month" | "all" | "range";

const PAGE_SIZE = 12;

/** Aligné avec l’onglet Commandes → Terminées. */
const SALE_STATUSES: OrderStatus[] = ["servi", "livre"];

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function matchesDate(
  isoDate: string,
  filter: DateFilter,
  rangeStart: string,
  rangeEnd: string
): boolean {
  if (filter === "all") return true;
  const date = new Date(isoDate);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let end = new Date(start);

  if (filter === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (filter === "month") {
    start.setDate(1);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  } else if (filter === "range") {
    if (!rangeStart || !rangeEnd) return true;
    const rangeStartDate = new Date(`${rangeStart}T00:00:00`);
    const rangeEndDate = new Date(`${rangeEnd}T23:59:59.999`);
    return date >= rangeStartDate && date <= rangeEndDate;
  } else {
    end.setDate(end.getDate() + 1);
  }

  return date >= start && date < end;
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="font-amount text-sm font-bold leading-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}

export function RecapRevenus() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [rangeStart, setRangeStart] = useState(localDateValue(new Date()));
  const [rangeEnd, setRangeEnd] = useState(localDateValue(new Date()));
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentMethod>(
    "all"
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      setOrders(await fetchAllOrders());
    } catch {
      setError("Impossible de charger les revenus.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allSales = useMemo(
    () =>
      orders
        .filter((o) => SALE_STATUSES.includes(o.status))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [orders]
  );

  const filteredSales = useMemo(() => {
    return allSales.filter((order) => {
      if (!matchesDate(order.createdAt, dateFilter, rangeStart, rangeEnd)) {
        return false;
      }
      if (paymentFilter !== "all" && order.paymentMethod !== paymentFilter) {
        return false;
      }
      return true;
    });
  }, [allSales, dateFilter, paymentFilter, rangeEnd, rangeStart]);

  const revenueTotal = useMemo(
    () => filteredSales.reduce((sum, o) => sum + o.total, 0),
    [filteredSales]
  );

  const averageTicket = filteredSales.length
    ? Math.round(revenueTotal / filteredSales.length)
    : 0;

  const pageCount = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));
  const displayed = filteredSales.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [dateFilter, paymentFilter, rangeEnd, rangeStart]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  if (loading) return <BrandLoader />;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-muted">
      <header className="border-b border-line bg-surface px-3 py-3">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-brand-600" />
          <h1 className="font-display text-base font-bold">Revenus</h1>
        </div>
      </header>

      <div className="border-b border-line bg-surface-soft/60 px-3 py-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-ink-faint">
              Période
            </span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs outline-none focus:border-brand-400"
            >
              <option value="today">Aujourd&apos;hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="all">Tout</option>
              <option value="range">Personnalisée</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-ink-faint">
              Paiement
            </span>
            <select
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(e.target.value as typeof paymentFilter)
              }
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs outline-none focus:border-brand-400"
            >
              <option value="all">Tous</option>
              <option value="especes">Espèces</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="carte">Carte</option>
            </select>
          </label>
        </div>
        {dateFilter === "range" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="date"
              aria-label="Date de début"
              value={rangeStart}
              max={rangeEnd || undefined}
              onChange={(e) => setRangeStart(e.target.value)}
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs"
            />
            <input
              type="date"
              aria-label="Date de fin"
              value={rangeEnd}
              min={rangeStart || undefined}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <SummaryCard label="Total" value={formatFCFA(revenueTotal)} />
          <SummaryCard label="Ventes" value={String(filteredSales.length)} />
          <SummaryCard
            label="Panier moyen"
            value={formatFCFA(averageTicket)}
          />
          <SummaryCard
            label="Ticket max"
            value={formatFCFA(
              filteredSales.reduce((max, o) => Math.max(max, o.total), 0)
            )}
          />
        </div>

        {filteredSales.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-faint">
            Aucune vente pour ces filtres.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-card divide-y divide-line">
            {displayed.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold">
                    {orderCode(order.number, order.createdAt)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-faint">
                    {new Date(order.createdAt).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="shrink-0 font-amount text-sm font-bold tabular-nums text-brand-700">
                  {formatFCFA(order.total)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <ListPagination
          page={page}
          pageCount={pageCount}
          totalItems={filteredSales.length}
          itemLabel="vente"
          onPageChange={setPage}
          className="mt-3"
          ariaLabel="Pagination des revenus"
        />
      </div>
    </div>
  );
}
