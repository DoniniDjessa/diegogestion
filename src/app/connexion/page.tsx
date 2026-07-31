"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import {
  fetchCurrentRole,
  fetchCurrentRoleResult,
  homeForRole,
  isStaffRole,
  type UserRole,
} from "@/lib/auth";

export default function ConnexionPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }
    void supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      setRole(data.user ? await fetchCurrentRole() : null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) setRole(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    // Le projet Supabase est partagé entre plusieurs applications : le compte
    // doit exister dans la table diego-users pour accéder à Diego Gestion.
    const lookup = await fetchCurrentRoleResult();
    if (lookup.error) {
      setUser(data.user);
      setError(
        `Impossible de vérifier le compte dans diego-users : ${lookup.error}. ` +
          "Vérifiez que la migration 20260719160000_diego_users.sql a été exécutée."
      );
      setLoading(false);
      return;
    }
    const nextRole = lookup.role;
    if (!nextRole) {
      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
      setError(
        "Ce compte n'est pas enregistré dans Diego. Créez un compte via la page d'inscription."
      );
      setLoading(false);
      return;
    }
    if (!isStaffRole(nextRole)) {
      setUser(data.user);
      setRole(nextRole);
      setError("Ce compte n'a pas accès à l'espace de gestion.");
      setLoading(false);
      return;
    }

    setUser(data.user);
    setRole(nextRole);
    setLoading(false);
    router.push(homeForRole(nextRole));
    router.refresh();
  }

  async function signOut() {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
  }

  return (
    <main className="flex h-full items-center justify-center bg-surface-muted p-4">
      <section className="w-full max-w-sm rounded-card border border-line bg-white p-6 shadow-panel">
        <div className="text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-ink">
            <LogIn size={20} />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold">
            Compte Diego Gestion
          </h1>
          <p className="mt-1 text-xs text-ink-soft">
            Connexion réservée aux membres du personnel.
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-card border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="animate-spin text-brand-500" />
          </div>
        ) : user ? (
          <div className="mt-6">
            <p className="bg-emerald-50 px-3 py-3 text-center text-xs font-semibold text-emerald-700">
              Connecté : {user.email}
              {role ? ` — ${role}` : ""}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                disabled={!isStaffRole(role)}
                onClick={() => router.push(homeForRole(role))}
                className="rounded-full bg-brand-500 py-2.5 text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continuer
              </button>
              <button
                onClick={() => void signOut()}
                className="flex items-center justify-center gap-1.5 rounded-full border border-line py-2.5"
              >
                <LogOut size={14} /> Déconnexion
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={signIn} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Email</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-card border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-400"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">
                Mot de passe
              </span>
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-card border border-line px-3 py-2.5 pr-11 text-sm outline-none focus:border-brand-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center px-3 text-ink-soft touch-manipulation"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <button className="w-full rounded-full bg-brand-500 py-3 text-ink hover:bg-brand-600">
              Se connecter
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
