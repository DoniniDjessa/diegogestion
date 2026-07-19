"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  Download,
  ExternalLink,
  LoaderCircle,
  Pencil,
  Plus,
  QrCode,
  RotateCcw,
  ShoppingBasket,
  Trash2,
  Users,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import type { RestaurantTable, TableStatus } from "@/lib/types";
import { useCart } from "@/lib/store";
import {
  createRestaurantTable,
  deleteRestaurantTable,
  fetchRestaurantTables,
  removeRealtimeChannel,
  setRestaurantTableStatus,
  subscribeToRestaurantChanges,
  updateRestaurantTable,
} from "@/lib/supabase/repository";

const STATUS_META: Record<
  TableStatus,
  { label: string; badge: string; dot: string; summary: string }
> = {
  libre: {
    label: "Libre",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    summary: "border-emerald-200 bg-emerald-50",
  },
  occupee: {
    label: "Occupée",
    badge: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
    summary: "border-red-200 bg-red-50",
  },
  reservee: {
    label: "Réservée",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    summary: "border-amber-200 bg-amber-50",
  },
};

const STATUSES: TableStatus[] = ["libre", "occupee", "reservee"];
const WEBSITE_URL =
  process.env.NEXT_PUBLIC_DIEGO_WEB_URL ?? "http://localhost:3000";

export default function SallePage() {
  const router = useRouter();
  const setRestaurantTableId = useCart((s) => s.setRestaurantTableId);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState({
    label: "",
    seats: "2",
    status: "libre" as TableStatus,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    try {
      setTables(await fetchRestaurantTables());
      setError(null);
    } catch {
      setTables([]);
      setError("Impossible de charger les tables depuis Supabase.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTables();
    const channel = subscribeToRestaurantChanges(() => void loadTables());
    return () => {
      void removeRealtimeChannel(channel);
    };
  }, [loadTables]);

  const selected = tables.find((table) => table.id === selectedId) ?? null;

  const tableUrl = useCallback(
    (table: RestaurantTable) =>
      `${WEBSITE_URL.replace(/\/$/, "")}/table/${encodeURIComponent(
        table.qrToken
      )}`,
    []
  );

  useEffect(() => {
    let active = true;
    if (!selected) {
      setQrPreview(null);
      return;
    }

    void QRCode.toDataURL(tableUrl(selected), {
      width: 360,
      margin: 2,
      color: { dark: "#1a1d23", light: "#ffffff" },
    }).then((dataUrl) => {
      if (active) setQrPreview(dataUrl);
    });

    return () => {
      active = false;
    };
  }, [selected, tableUrl]);

  async function changeStatus(id: string, status: TableStatus) {
    const previous = tables;
    setTables((prev) =>
      prev.map((table) =>
        table.id === id ? { ...table, status } : table
      )
    );
    setSaving(true);
    try {
      await setRestaurantTableStatus(id, status);
      setError(null);
    } catch {
      setTables(previous);
      setError(
        "Modification refusée. Connectez-vous avec un compte staff Supabase."
      );
    } finally {
      setSaving(false);
    }
  }

  async function downloadQr(table: RestaurantTable) {
    const dataUrl = await QRCode.toDataURL(tableUrl(table), {
      width: 1200,
      margin: 3,
      errorCorrectionLevel: "H",
      color: { dark: "#1a1d23", light: "#ffffff" },
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `diego-table-${table.label}-qr.png`;
    link.click();
  }

  function startOrder(table: RestaurantTable) {
    setRestaurantTableId(table.id);
    setSelectedId(null);
    router.push("/caisse");
  }

  function openCreate() {
    setEditing(null);
    setForm({ label: "", seats: "1", status: "libre" });
    setError(null);
    setFormOpen(true);
  }

  function openEdit(table: RestaurantTable) {
    setEditing(table);
    setForm({
      label: table.label,
      seats: String(table.seats),
      status: table.status,
    });
    setError(null);
    setFormOpen(true);
  }

  async function saveTable(event: FormEvent) {
    event.preventDefault();
    const seats = editing ? Number(form.seats) : 1;
    if (
      !form.label.trim() ||
      (editing && (!Number.isInteger(seats) || seats < 1))
    ) {
      setError(
        editing
          ? "Renseignez un nom de table et une capacité valide."
          : "Renseignez un nom de table."
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = {
        label: form.label,
        seats,
        status: editing ? form.status : ("libre" as TableStatus),
      };
      if (editing) await updateRestaurantTable(editing.id, input);
      else await createRestaurantTable(input);
      setFormOpen(false);
      setSelectedId(null);
      await loadTables();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "";
      setError(
        message.includes("authentication") ||
          message.includes("not authorized")
          ? "Connectez-vous avec un compte staff (page Compte) pour gérer les tables."
          : message || "Impossible d'enregistrer la table."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeTable(table: RestaurantTable) {
    if (!window.confirm(`Retirer la table « ${table.label} » de la salle ?`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteRestaurantTable(table.id);
      setSelectedId(null);
      await loadTables();
    } catch {
      setError("Suppression refusée. Vérifiez votre session staff.");
    } finally {
      setSaving(false);
    }
  }

  const counts = tables.reduce(
    (acc, t) => ({ ...acc, [t.status]: (acc[t.status] ?? 0) + 1 }),
    {} as Record<TableStatus, number>
  );

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div>
          <h1 className="font-display text-base font-bold">Tables</h1>
          <p className="mt-0.5 text-2xs text-ink-faint">
            État de la salle et QR codes de commande
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-ink shadow-card hover:bg-brand-600"
        >
          <Plus size={13} /> Nouvelle table
        </button>
      </header>

      {error && (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-2xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {STATUSES.map((status) => {
            const meta = STATUS_META[status];
            return (
              <div
                key={status}
                className={`rounded-card border p-3 shadow-card ${meta.summary}`}
              >
                <span className="flex items-center gap-1.5 text-2xs font-semibold text-ink-soft">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">
                  {counts[status] ?? 0}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-line bg-surface-soft px-4 py-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint sm:grid-cols-[1fr_120px_130px_auto]">
            <span>Table</span>
            <span className="hidden sm:block">Places</span>
            <span>État</span>
            <span />
          </div>

          {loading ? (
            <div className="flex justify-center py-14">
              <LoaderCircle size={22} className="animate-spin text-brand-500" />
            </div>
          ) : tables.length === 0 ? (
            <p className="py-14 text-center text-xs text-ink-faint">
              Aucune table disponible.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {tables.map((table) => {
                const meta = STATUS_META[table.status];
                return (
              <button
                    key={table.id}
                    onClick={() => setSelectedId(table.id)}
                    className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-50/50 sm:grid-cols-[1fr_120px_130px_auto]"
              >
                    <span className="font-bold">{table.label}</span>
                    <span className="hidden items-center gap-1 text-xs text-ink-soft sm:flex">
                      <Users size={13} /> {table.seats}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-bold ${meta.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                    <ChevronRight size={16} className="text-ink-faint" />
              </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-ink/35"
            onClick={() => setSelectedId(null)}
            aria-label="Fermer les détails"
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-surface shadow-panel">
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                  Détails de la table
                </p>
                <h2 className="mt-0.5 text-xl font-extrabold">
                  {selected.label}
                </h2>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="p-2 text-ink-soft hover:bg-surface-soft"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              <div>
                <p className="mb-2 text-xs font-bold text-ink-soft">État</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {STATUSES.map((status) => (
                    <button
                      key={status}
                      disabled={saving}
                      onClick={() => void changeStatus(selected.id, status)}
                      className={`rounded-full border px-2 py-2 transition ${
                        selected.status === status
                          ? STATUS_META[status].badge
                          : "border-line text-ink-soft hover:bg-surface-soft"
                      }`}
                    >
                      {STATUS_META[status].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-card border border-line p-4 text-center">
                <div className="mb-3 flex items-center gap-2 text-left">
                  <QrCode size={16} className="text-brand-600" />
                  <div>
                    <p className="text-xs font-bold">QR code client</p>
                    <p className="text-2xs text-ink-faint">
                      Ouvre directement {selected.label}
                    </p>
                  </div>
                </div>
                {qrPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrPreview}
                    alt={`QR code de ${selected.label}`}
                    className="mx-auto h-52 w-52"
                  />
                ) : (
                  <div className="mx-auto flex h-52 w-52 items-center justify-center">
                    <LoaderCircle className="animate-spin text-brand-500" />
                  </div>
                )}
                <p className="mt-2 break-all text-2xs text-ink-faint">
                  {tableUrl(selected)}
                </p>
              </div>
            </div>

            <footer className="grid grid-cols-2 gap-2 border-t border-line p-4">
              {selected.status !== "libre" && (
                <button
                  disabled={saving}
                  onClick={() => void changeStatus(selected.id, "libre")}
                  className="col-span-2 flex items-center justify-center gap-1.5 rounded-full border border-emerald-200 py-2.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <RotateCcw size={14} /> Vider la table
                </button>
              )}
              <button
                onClick={() => startOrder(selected)}
                className="col-span-2 flex items-center justify-center gap-1.5 rounded-full bg-brand-500 py-2.5 text-ink hover:bg-brand-600"
              >
                <ShoppingBasket size={14} /> Commander pour cette table
              </button>
              <button
                onClick={() => openEdit(selected)}
                className="flex items-center justify-center gap-1.5 rounded-full border border-line py-2.5 text-ink-soft hover:bg-surface-soft"
              >
                <Pencil size={14} /> Modifier
              </button>
              <button
                disabled={saving}
                onClick={() => void removeTable(selected)}
                className="flex items-center justify-center gap-1.5 rounded-full border border-red-200 py-2.5 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} /> Supprimer
              </button>
              <a
                href={tableUrl(selected)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-full border border-line py-2.5 text-ink-soft hover:bg-surface-soft"
              >
                <ExternalLink size={14} /> Tester
              </a>
              <button
                onClick={() => void downloadQr(selected)}
                className="flex items-center justify-center gap-1.5 rounded-full border border-line py-2.5 text-ink-soft hover:bg-surface-soft"
              >
                <Download size={14} /> Télécharger QR
              </button>
            </footer>
          </aside>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3">
          <button
            className="absolute inset-0 bg-ink/40"
            onClick={() => setFormOpen(false)}
            aria-label="Fermer"
          />
          <form
            onSubmit={saveTable}
            className="relative w-full max-w-sm rounded-card bg-white shadow-panel"
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-display text-xl font-bold">
                {editing ? "Modifier la table" : "Nouvelle table"}
              </h2>
              <button type="button" onClick={() => setFormOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">
                  Nom ou numéro
                </span>
                <input
                  required
                  value={form.label}
                  onChange={(event) =>
                    setForm({ ...form, label: event.target.value })
                  }
                  placeholder="Ex. T11, Terrasse 1"
                  className="w-full rounded-card border border-line px-3 py-2 text-sm outline-none focus:border-brand-400"
                />
              </label>
              {editing ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold">
                      Nombre de places
                    </span>
                    <input
                      required
                      min="1"
                      step="1"
                      type="number"
                      value={form.seats}
                      onChange={(event) =>
                        setForm({ ...form, seats: event.target.value })
                      }
                      className="w-full rounded-card border border-line px-3 py-2 text-sm outline-none focus:border-brand-400"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold">
                      État
                    </span>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          status: event.target.value as TableStatus,
                        })
                      }
                      className="w-full rounded-card border border-line px-3 py-2 text-sm"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_META[status].label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              {error && (
                <p className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}
            </div>
            <footer className="flex justify-end gap-2 border-t border-line p-4">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-full border border-line px-5 py-2"
              >
                Annuler
              </button>
              <button
                disabled={saving}
                className="rounded-full bg-brand-500 px-5 py-2 text-ink disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
