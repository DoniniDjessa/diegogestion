"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { LoaderCircle, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { ListPagination } from "@/components/ListPagination";
import { getSupabase } from "@/lib/supabase";
import {
  fetchCurrentRole,
  USER_ROLES,
  type UserRole,
} from "@/lib/auth";
import { DIEGO_TABLES } from "@/lib/supabase/constants";

const ROLE_LABELS: Record<UserRole, string> = {
  superAdmin: "Super administrateur",
  admin: "Administrateur",
  caissier: "Caissier",
  utilisateur: "Utilisateur",
};

type DiegoUser = {
  id: string;
  email: string;
  role: UserRole;
  active: boolean;
};

const USERS_PAGE_SIZE = 12;

export default function InscriptionPage() {
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [users, setUsers] = useState<DiegoUser[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("utilisateur");
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data, error: loadError } = await supabase
      .from(DIEGO_TABLES.users)
      .select("id,email,role,active")
      .order("email");
    if (loadError) {
      setError("Impossible de charger les utilisateurs Diego.");
      return;
    }
    setUsers((data ?? []) as DiegoUser[]);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.auth.getUser().then(async ({ data }) => {
      setCurrentRole(data.user ? await fetchCurrentRole() : null);
      if (data.user) await loadUsers();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setCurrentRole(null);
    });
    return () => data.subscription.unsubscribe();
  }, [loadUsers]);

  async function register(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabase();
      const session = supabase
        ? (await supabase.auth.getSession()).data.session
        : null;
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ email, password, role }),
      });
      let result: { error?: string } = {};
      try {
        result = (await response.json()) as { error?: string };
      } catch {
        // Réponse vide ou non-JSON (erreur serveur inattendue).
      }
      if (!response.ok) {
        throw new Error(
          result.error ??
            `Impossible de créer le compte (erreur ${response.status}).`
        );
      }

      setSuccess(`Compte ${ROLE_LABELS[role]} créé avec succès.`);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRole("utilisateur");
      await loadUsers();
      setDrawerOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Impossible de créer le compte."
      );
    } finally {
      setLoading(false);
    }
  }

  const allowedRoles =
    currentRole === "superAdmin"
      ? USER_ROLES
      : USER_ROLES.filter((item) => item !== "superAdmin");

  const userPageCount = Math.max(1, Math.ceil(users.length / USERS_PAGE_SIZE));
  const displayedUsers = users.slice(
    (userPage - 1) * USERS_PAGE_SIZE,
    userPage * USERS_PAGE_SIZE
  );

  useEffect(() => {
    if (userPage > userPageCount) setUserPage(userPageCount);
  }, [userPage, userPageCount]);

  return (
    <main className="relative h-full overflow-y-auto bg-surface-muted p-4 sm:p-6">
      <div className="mx-auto w-full max-w-5xl">
        <section className="overflow-hidden rounded-card border border-line bg-white shadow-card">
          <header className="flex items-center justify-between gap-3 border-b border-line p-5">
            <div className="flex items-center gap-3">
              <Users className="text-brand-600" size={20} />
              <div>
                <h1 className="font-display text-xl font-bold">Utilisateurs</h1>
                <p className="text-xs text-ink-soft">
                  Comptes autorisés à utiliser les applications Diego
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSuccess(null);
                setDrawerOpen(true);
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-ink hover:bg-brand-600"
            >
              <UserPlus size={14} /> Ajouter
            </button>
          </header>
          <div className="divide-y divide-line">
            {displayedUsers.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.email}</p>
                  <p className="text-[11px] text-ink-faint">
                    {ROLE_LABELS[item.role]}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${
                    item.active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {item.active ? "Actif" : "Inactif"}
                </span>
              </div>
            ))}
            {users.length === 0 && (
              <p className="px-5 py-10 text-center text-xs text-ink-faint">
                Aucun utilisateur Diego.
              </p>
            )}
          </div>
          <ListPagination
            page={userPage}
            pageCount={userPageCount}
            totalItems={users.length}
            itemLabel="utilisateur"
            onPageChange={setUserPage}
            className="border-t border-line p-4"
            ariaLabel="Pagination des utilisateurs"
          />
        </section>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ink/35"
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-panel">
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="font-display text-xl font-bold">
                  Nouvel utilisateur
                </h2>
                <p className="mt-1 text-xs text-ink-soft">
                  {currentRole === "superAdmin"
                    ? "Tous les types de comptes sont disponibles."
                    : "Un admin ne peut pas créer de super administrateur."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-full p-2 text-ink-soft hover:bg-surface-soft"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </header>

            <form
              onSubmit={register}
              className="flex-1 space-y-4 overflow-y-auto p-5"
            >
          {error && (
            <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-card border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {success}
            </p>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Email</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">
              Type de compte
            </span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="w-full border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
            >
              {allowedRoles.map((item) => (
                <option key={item} value={item}>
                  {ROLE_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">
              Mot de passe
            </span>
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">
              Confirmer le mot de passe
            </span>
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-400"
            />
          </label>
              <button
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-3 text-ink hover:bg-brand-600 disabled:opacity-60"
              >
                {loading && <LoaderCircle size={15} className="animate-spin" />}
                Créer le compte
              </button>
              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-faint">
                <ShieldCheck size={13} />
                Création réservée aux admins
              </p>
            </form>
          </aside>
        </div>
      )}
    </main>
  );
}
