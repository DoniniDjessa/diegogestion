"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  ClipboardList,
  Download,
  LoaderCircle,
  Lock,
  LogIn,
  LogOut,
  Smartphone,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import MenuManager from "@/components/MenuManager";
import { BrandLoader } from "@/components/BrandLoader";
import { RecapCommandes } from "@/components/recap/RecapCommandes";
import { RecapRevenus } from "@/components/recap/RecapRevenus";
import { getSupabase } from "@/lib/supabase";
import {
  fetchCurrentRole,
  fetchCurrentRoleResult,
  isAdminRole,
  type UserRole,
} from "@/lib/auth";

type RecapTab = "revenus" | "commandes" | "menu";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const TABS: {
  id: RecapTab;
  label: string;
  icon: typeof UtensilsCrossed;
}[] = [
  { id: "revenus", label: "Revenus", icon: Wallet },
  { id: "commandes", label: "Commandes", icon: ClipboardList },
  { id: "menu", label: "Menu", icon: UtensilsCrossed },
];

export default function RecapPage() {
  const [tab, setTab] = useState<RecapTab>("revenus");
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const connected = isAdminRole(role);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/sw-recap.js", { scope: "/recap" })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const syncInstalled = () => {
      setInstalled(
        media.matches ||
          ("standalone" in navigator &&
            Boolean(
              (navigator as Navigator & { standalone?: boolean }).standalone
            ))
      );
    };
    syncInstalled();
    media.addEventListener("change", syncInstalled);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      media.removeEventListener("change", syncInstalled);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      setAuthLoading(false);
      return;
    }

    let active = true;
    async function refresh(nextUser: User | null) {
      if (!active) return;
      setUser(nextUser);
      if (!nextUser) {
        setRole(null);
        setAuthLoading(false);
        return;
      }
      const nextRole = await fetchCurrentRole();
      if (!active) return;
      setRole(nextRole);
      setAuthLoading(false);
    }

    void supabase.auth.getUser().then(({ data }) => {
      void refresh(data.user);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void refresh(session?.user ?? null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function installApp() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setInstallEvent(null);
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setAuthBusy(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError("Email ou mot de passe incorrect.");
      setAuthBusy(false);
      return;
    }

    const lookup = await fetchCurrentRoleResult();
    if (lookup.error) {
      setError(`Impossible de vérifier le compte : ${lookup.error}`);
      setAuthBusy(false);
      return;
    }
    if (!isAdminRole(lookup.role)) {
      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
      setError("Accès Récap réservé aux administrateurs.");
      setAuthBusy(false);
      return;
    }

    setUser(data.user);
    setRole(lookup.role);
    setPassword("");
    setAuthBusy(false);
  }

  async function signOut() {
    const supabase = getSupabase();
    if (!supabase) return;
    setAuthBusy(true);
    setError(null);
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setTab("revenus");
    setAuthBusy(false);
  }

  return (
    <>
      <div className="hidden h-full flex-col items-center justify-center gap-4 bg-surface-muted px-8 text-center md:flex">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface text-brand-600 shadow-card">
          <Lock size={28} />
        </span>
        <div className="max-w-sm space-y-2">
          <h1 className="font-display text-xl font-bold text-ink">
            Récap mobile uniquement
          </h1>
          <p className="text-sm text-ink-soft">
            Cette page est conçue pour le téléphone. Ouvrez{" "}
            <span className="font-semibold text-ink">/recap</span> depuis un
            mobile, ou réduisez la fenêtre sous 768&nbsp;px.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft">
          <Smartphone size={13} />
          Admin · mobile
        </span>
      </div>

      <div className="flex h-full min-h-0 flex-col md:hidden">
        <header className="shrink-0 border-b border-line bg-surface px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-sm font-bold leading-tight">
                Diego Récap
              </p>
              <p className="truncate text-[10px] text-ink-faint">
                {authLoading
                  ? "…"
                  : connected
                    ? (user?.email ?? "Connecté")
                    : user
                      ? "Compte non autorisé"
                      : "Non connecté"}
              </p>
            </div>
            {connected || user ? (
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void signOut()}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 disabled:opacity-50"
              >
                {authBusy ? (
                  <LoaderCircle size={12} className="animate-spin" />
                ) : (
                  <LogOut size={12} />
                )}
                Déconnexion
              </button>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface-soft px-3 py-1.5 text-[11px] font-semibold text-ink-soft">
                <LogIn size={12} />
                Connexion
              </span>
            )}
          </div>
        </header>

        {!installed && installEvent && (
          <div className="flex items-center justify-between gap-2 border-b border-line bg-brand-50 px-3 py-2">
            <p className="text-[11px] font-medium text-ink-soft">
              Installer Récap sur l&apos;écran d&apos;accueil
            </p>
            <button
              type="button"
              onClick={() => void installApp()}
              className="inline-flex shrink-0 items-center gap-1 rounded-full diego-gradient px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              <Download size={12} />
              Installer
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {authLoading ? (
            <BrandLoader />
          ) : connected ? (
            <>
              {tab === "revenus" && <RecapRevenus />}
              {tab === "commandes" && <RecapCommandes />}
              {tab === "menu" && <MenuManager readOnly />}
            </>
          ) : user ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-surface-muted p-6 text-center">
              <p className="text-sm font-semibold text-ink">Accès refusé</p>
              <p className="max-w-xs text-xs text-ink-soft">
                Récap est réservé aux administrateurs. Déconnectez-vous pour
                changer de compte.
              </p>
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
              >
                <LogOut size={13} />
                Déconnexion
              </button>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center overflow-y-auto bg-surface-muted p-4">
              <section className="mx-auto w-full max-w-sm rounded-card border border-line bg-white p-5 shadow-panel">
                <div className="text-center">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-ink">
                    <LogIn size={18} />
                  </span>
                  <h2 className="mt-3 font-display text-lg font-bold">
                    Connexion Récap
                  </h2>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    Réservé aux administrateurs.
                  </p>
                </div>

                {error && (
                  <p className="mt-3 rounded-card border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </p>
                )}

                <form onSubmit={(e) => void signIn(e)} className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold">
                      Email
                    </span>
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-card border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold">
                      Mot de passe
                    </span>
                    <input
                      required
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-card border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full diego-gradient py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {authBusy && (
                      <LoaderCircle size={14} className="animate-spin" />
                    )}
                    Se connecter
                  </button>
                </form>
              </section>
            </div>
          )}
        </div>

        {connected && (
          <nav
            className="shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
            aria-label="Navigation Récap"
          >
            <div className="grid grid-cols-3">
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`flex flex-col items-center gap-0.5 px-2 py-2.5 text-[10px] font-semibold transition-colors ${
                      active
                        ? "text-brand-700"
                        : "text-ink-faint hover:text-ink-soft"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                        active ? "diego-gradient text-white shadow-card" : ""
                      }`}
                    >
                      <Icon size={16} strokeWidth={active ? 2.4 : 2} />
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
