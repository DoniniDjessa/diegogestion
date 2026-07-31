"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus, Search, Trash2, Wallet } from "lucide-react";
import { BrandLoader } from "@/components/BrandLoader";
import { ListPagination } from "@/components/ListPagination";
import { SaleDetailSidebar } from "@/components/SaleDetailSidebar";
import { CHANNEL_META, formatFCFA } from "@/lib/data";
import { orderCode } from "@/lib/order-code";
import type { Order, PaymentMethod } from "@/lib/types";
import {
  createExpense,
  deleteExpense,
  fetchAllOrders,
  fetchExpenses,
  type Expense,
} from "@/lib/supabase/repository";
import { usePosKeyboardReceiver } from "@/lib/pos-keyboard";

type FinanceTab = "revenus" | "depenses";
type DateFilter = "today" | "week" | "month" | "all" | "range";

const ROW_PAGE_SIZE = 15;

const PAYMENT_LABELS: Record<string, string> = {
  especes: "Espèces",
  mobile_money: "Mobile Money",
  carte: "Carte",
};

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

function paymentLabel(order: Order): string {
  if (order.paymentMethod) {
    return PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod;
  }
  return order.customerId ? "En ligne" : "—";
}

function saleSummary(order: Order): string {
  if (order.table) return order.table;
  if (order.channel === "livraison" && order.deliveryAddress) {
    return order.deliveryAddress.slice(0, 40);
  }
  if (order.customerPhone) return order.customerPhone;
  return CHANNEL_META[order.channel]?.label ?? order.channel;
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="font-amount text-sm font-bold leading-tight tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-ink-soft">{hint}</p>}
    </div>
  );
}

export default function FinancesPage() {
  const [tab, setTab] = useState<FinanceTab>("revenus");
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenuePage, setRevenuePage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [note, setNote] = useState("");
  const [expenseDate, setExpenseDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [rangeStart, setRangeStart] = useState(localDateValue(new Date()));
  const [rangeEnd, setRangeEnd] = useState(localDateValue(new Date()));
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentMethod>(
    "all"
  );
  const [revenueQuery, setRevenueQuery] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  usePosKeyboardReceiver({
    route: "finances",
    onQuery: setRevenueQuery,
    onAmount: (next) => setAmount(String(next || "")),
    getQuery: () => revenueQuery,
    getAmount: () => Number.parseInt(amount.replace(/\s/g, ""), 10) || 0,
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [allOrders, allExpenses] = await Promise.all([
        fetchAllOrders(),
        fetchExpenses(),
      ]);
      setOrders(allOrders);
      setExpenses(allExpenses);
    } catch {
      setError("Impossible de charger les finances.");
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
        .filter((o) => o.paymentStatus === "paye" && o.status !== "annule")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [orders]
  );

  const filteredSales = useMemo(() => {
    const q = revenueQuery.trim().toLocaleLowerCase("fr");
    return allSales.filter((order) => {
      if (!matchesDate(order.createdAt, dateFilter, rangeStart, rangeEnd)) {
        return false;
      }
      if (paymentFilter !== "all") {
        if (order.paymentMethod !== paymentFilter) return false;
      }
      if (!q) return true;
      const code = orderCode(order.number, order.createdAt).toLowerCase();
      if (code.includes(q)) return true;
      return order.lines.some((line) =>
        line.product.name.toLocaleLowerCase("fr").includes(q)
      );
    });
  }, [
    allSales,
    dateFilter,
    paymentFilter,
    rangeEnd,
    rangeStart,
    revenueQuery,
  ]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((row) => {
      const iso = `${row.expenseDate}T12:00:00`;
      if (!matchesDate(iso, dateFilter, rangeStart, rangeEnd)) return false;
      if (
        expenseCategoryFilter !== "all" &&
        (row.category ?? "") !== expenseCategoryFilter
      ) {
        return false;
      }
      return true;
    });
  }, [dateFilter, expenseCategoryFilter, expenses, rangeEnd, rangeStart]);

  const expenseCategories = useMemo(() => {
    const set = new Set<string>();
    for (const row of expenses) {
      if (row.category?.trim()) set.add(row.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [expenses]);

  const revenueTotal = useMemo(
    () => filteredSales.reduce((sum, o) => sum + o.total, 0),
    [filteredSales]
  );

  const expenseTotal = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  const averageTicket = filteredSales.length
    ? Math.round(revenueTotal / filteredSales.length)
    : 0;

  const revenuePageCount = Math.max(
    1,
    Math.ceil(filteredSales.length / ROW_PAGE_SIZE)
  );
  const displayedSales = filteredSales.slice(
    (revenuePage - 1) * ROW_PAGE_SIZE,
    revenuePage * ROW_PAGE_SIZE
  );

  const expensePageCount = Math.max(
    1,
    Math.ceil(filteredExpenses.length / ROW_PAGE_SIZE)
  );
  const displayedExpenses = filteredExpenses.slice(
    (expensePage - 1) * ROW_PAGE_SIZE,
    expensePage * ROW_PAGE_SIZE
  );

  const selectedSale = useMemo(
    () => filteredSales.find((o) => o.id === selectedSaleId) ?? null,
    [filteredSales, selectedSaleId]
  );

  useEffect(() => {
    if (revenuePage > revenuePageCount) setRevenuePage(revenuePageCount);
  }, [revenuePage, revenuePageCount]);

  useEffect(() => {
    if (expensePage > expensePageCount) setExpensePage(expensePageCount);
  }, [expensePage, expensePageCount]);

  useEffect(() => {
    setRevenuePage(1);
    setExpensePage(1);
  }, [
    dateFilter,
    expenseCategoryFilter,
    paymentFilter,
    rangeEnd,
    rangeStart,
    revenueQuery,
    tab,
  ]);

  useEffect(() => {
    if (selectedSaleId && !selectedSale) setSelectedSaleId(null);
  }, [selectedSale, selectedSaleId]);

  async function submitExpense(event: FormEvent) {
    event.preventDefault();
    const parsed = Number.parseInt(amount.replace(/\s/g, ""), 10);
    if (!label.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setError("Libellé et montant valides requis.");
      return;
    }
    setExpenseBusy(true);
    setError(null);
    try {
      await createExpense({
        label: label.trim(),
        amount: parsed,
        category: expenseCategory.trim() || undefined,
        note: note.trim() || undefined,
        expenseDate,
      });
      setLabel("");
      setAmount("");
      setExpenseCategory("");
      setNote("");
      setFormOpen(false);
      await load();
    } catch {
      setError("Impossible d'enregistrer la dépense.");
    } finally {
      setExpenseBusy(false);
    }
  }

  async function removeExpense(id: string) {
    if (!window.confirm("Supprimer cette dépense ?")) return;
    setExpenseBusy(true);
    setError(null);
    try {
      await deleteExpense(id);
      await load();
    } catch {
      setError("Suppression refusée.");
    } finally {
      setExpenseBusy(false);
    }
  }

  const filterBar = (
    <div className="border-b border-line bg-surface-soft/60 px-4 py-3 sm:px-5">
      <div
        className={`grid grid-cols-1 gap-2 ${
          tab === "revenus" ? "sm:grid-cols-3" : "sm:grid-cols-2"
        }`}
      >
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
        {tab === "revenus" ? (
          <>
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
            <label className="relative block">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-ink-faint">
                Recherche
              </span>
              <Search
                size={13}
                className="pointer-events-none absolute bottom-2.5 left-3 text-ink-faint"
              />
              <input
                type="search"
                value={revenueQuery}
                onChange={(e) => setRevenueQuery(e.target.value)}
                placeholder="Code ou produit"
                className="w-full rounded-xl border border-line bg-white py-2 pl-8 pr-3 text-xs outline-none focus:border-brand-400"
              />
            </label>
          </>
        ) : (
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase text-ink-faint">
              Catégorie
            </span>
            <select
              value={expenseCategoryFilter}
              onChange={(e) => setExpenseCategoryFilter(e.target.value)}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs outline-none focus:border-brand-400"
            >
              <option value="all">Toutes</option>
              {expenseCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {dateFilter === "range" && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
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
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-line bg-surface px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet size={18} className="text-brand-600" />
              <h1 className="font-display text-base font-bold">Finances</h1>
            </div>
            <div className="flex rounded-full border border-line bg-white p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  setTab("revenus");
                  setSelectedSaleId(null);
                }}
                className={`rounded-full px-4 py-1.5 transition ${
                  tab === "revenus"
                    ? "diego-gradient text-white shadow-sm"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                Revenus
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("depenses");
                  setSelectedSaleId(null);
                }}
                className={`rounded-full px-4 py-1.5 transition ${
                  tab === "depenses"
                    ? "diego-gradient text-white shadow-sm"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                Dépenses
              </button>
            </div>
          </div>
        </header>

        {!loading && filterBar}

        {error && (
          <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <BrandLoader />
          ) : tab === "revenus" ? (
            <div className="mx-auto max-w-6xl space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryCard
                  label="Encaissé"
                  value={formatFCFA(revenueTotal)}
                />
                <SummaryCard
                  label="Ventes"
                  value={String(filteredSales.length)}
                />
                <SummaryCard
                  label="Panier moyen"
                  value={formatFCFA(averageTicket)}
                />
                <SummaryCard
                  label="Résultat"
                  value={formatFCFA(revenueTotal - expenseTotal)}
                  hint="Revenus − dépenses (période)"
                />
              </div>

              {filteredSales.length === 0 ? (
                <p className="py-12 text-center text-sm text-ink-faint">
                  Aucune vente pour ces filtres.
                </p>
              ) : (
                <>
                  <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="border-b border-line bg-surface-soft text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                        <tr>
                          <th className="px-3 py-2.5 sm:px-4">Commande</th>
                          <th className="px-3 py-2.5 sm:px-4">Date</th>
                          <th className="px-3 py-2.5 sm:px-4">Canal</th>
                          <th className="hidden px-3 py-2.5 sm:table-cell sm:px-4">
                            Détail
                          </th>
                          <th className="px-3 py-2.5 sm:px-4">Paiement</th>
                          <th className="px-3 py-2.5 text-right sm:px-4">
                            Montant
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {displayedSales.map((order) => {
                          const selected = selectedSaleId === order.id;
                          return (
                            <tr
                              key={order.id}
                              onClick={() =>
                                setSelectedSaleId((id) =>
                                  id === order.id ? null : order.id
                                )
                              }
                              className={`cursor-pointer transition ${
                                selected
                                  ? "bg-brand-50/80"
                                  : "hover:bg-surface-soft/80"
                              }`}
                            >
                              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold sm:px-4">
                                {orderCode(order.number, order.createdAt)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-soft sm:px-4">
                                {new Date(order.createdAt).toLocaleString(
                                  "fr-FR"
                                )}
                              </td>
                              <td className="px-3 py-2.5 sm:px-4">
                                <span
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                    CHANNEL_META[order.channel]?.color ??
                                    "border-line bg-white"
                                  }`}
                                >
                                  {CHANNEL_META[order.channel]?.label ??
                                    order.channel}
                                </span>
                              </td>
                              <td className="hidden max-w-[12rem] truncate px-3 py-2.5 text-xs text-ink-soft sm:table-cell sm:px-4">
                                {saleSummary(order)}
                              </td>
                              <td className="px-3 py-2.5 text-xs sm:px-4">
                                {paymentLabel(order)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold sm:px-4">
                                {formatFCFA(order.total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <ListPagination
                    page={revenuePage}
                    pageCount={revenuePageCount}
                    totalItems={filteredSales.length}
                    itemLabel="vente"
                    onPageChange={setRevenuePage}
                    className="mt-2"
                    ariaLabel="Pagination des revenus"
                  />
                </>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-6xl space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <SummaryCard
                  label="Dépenses"
                  value={formatFCFA(expenseTotal)}
                />
                <SummaryCard
                  label="Lignes"
                  value={String(filteredExpenses.length)}
                />
                <SummaryCard
                  label="Solde"
                  value={formatFCFA(revenueTotal - expenseTotal)}
                  hint="Revenus − dépenses (période)"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setFormOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-400 bg-brand-50 px-3.5 py-2 text-xs font-semibold text-brand-800 hover:bg-brand-100"
                >
                  <Plus size={14} />
                  Nouvelle dépense
                </button>
              </div>

              {formOpen && (
                <form
                  onSubmit={(e) => void submitExpense(e)}
                  className="rounded-card border border-line bg-surface p-4 shadow-card"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-semibold text-ink-soft">
                      Libellé
                      <input
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        required
                        className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-ink-soft">
                      Montant (FCFA)
                      <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        inputMode="numeric"
                        required
                        className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-ink-soft">
                      Catégorie (optionnel)
                      <input
                        value={expenseCategory}
                        onChange={(e) => setExpenseCategory(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-ink-soft">
                      Date
                      <input
                        type="date"
                        value={expenseDate}
                        onChange={(e) => setExpenseDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-ink-soft sm:col-span-2">
                      Note (optionnel)
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setFormOpen(false)}
                      className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-soft"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={expenseBusy}
                      className="inline-flex items-center gap-1.5 rounded-full diego-gradient px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {expenseBusy && (
                        <LoaderCircle size={14} className="animate-spin" />
                      )}
                      Enregistrer
                    </button>
                  </div>
                </form>
              )}

              {filteredExpenses.length === 0 ? (
                <p className="py-12 text-center text-sm text-ink-faint">
                  Aucune dépense pour ces filtres.
                </p>
              ) : (
                <>
                  <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="border-b border-line bg-surface-soft text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                        <tr>
                          <th className="px-3 py-2.5 sm:px-4">Date</th>
                          <th className="px-3 py-2.5 sm:px-4">Libellé</th>
                          <th className="hidden px-3 py-2.5 sm:table-cell sm:px-4">
                            Catégorie
                          </th>
                          <th className="px-3 py-2.5 text-right sm:px-4">
                            Montant
                          </th>
                          <th className="w-12 px-2 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {displayedExpenses.map((row) => (
                          <tr key={row.id} className="hover:bg-surface-soft/80">
                            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-soft sm:px-4">
                              {new Date(row.expenseDate).toLocaleDateString(
                                "fr-FR"
                              )}
                            </td>
                            <td className="px-3 py-2.5 sm:px-4">
                              <div className="font-medium">{row.label}</div>
                              {row.note && (
                                <div className="text-xs text-ink-faint">
                                  {row.note}
                                </div>
                              )}
                            </td>
                            <td className="hidden px-3 py-2.5 text-xs text-ink-soft sm:table-cell sm:px-4">
                              {row.category ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-red-700 sm:px-4">
                              {formatFCFA(row.amount)}
                            </td>
                            <td className="px-2 py-2.5">
                              <button
                                type="button"
                                disabled={expenseBusy}
                                onClick={() => void removeExpense(row.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-red-600 hover:bg-red-50 disabled:opacity-40"
                                aria-label="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ListPagination
                    page={expensePage}
                    pageCount={expensePageCount}
                    totalItems={filteredExpenses.length}
                    itemLabel="dépense"
                    onPageChange={setExpensePage}
                    className="mt-2"
                    ariaLabel="Pagination des dépenses"
                  />
                </>
              )}
            </div>
          )}
        </div>

      {selectedSale && (
        <>
          <button
            type="button"
            aria-label="Fermer le détail"
            className="fixed inset-0 z-40 bg-ink/25"
            onClick={() => setSelectedSaleId(null)}
          />
          <SaleDetailSidebar
            order={selectedSale}
            onClose={() => setSelectedSaleId(null)}
          />
        </>
      )}
    </div>
  );
}
