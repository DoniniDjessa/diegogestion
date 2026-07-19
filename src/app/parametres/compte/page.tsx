"use client";

import { useEffect, useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { BrandLoader } from "@/components/BrandLoader";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { fetchCurrentRole, type UserRole } from "@/lib/auth";

const ROLE_LABELS: Record<UserRole, string> = {
  superAdmin: "Super administrateur",
  admin: "Administrateur",
  caissier: "Caissier",
  utilisateur: "Utilisateur",
};

export default function ParametresComptePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      setRole(data.user ? await fetchCurrentRole() : null);
      setLoading(false);
    });
  }, []);

  async function signOut() {
    const supabase = getSupabase();
    await supabase?.auth.signOut();
    router.replace("/connexion");
    router.refresh();
  }

  if (loading) {
    return <BrandLoader />;
  }

  return (
    <div className="flex h-full items-start justify-center overflow-y-auto bg-surface-muted p-4 sm:p-6">
      <section className="w-full max-w-md rounded-card border border-line bg-white p-6 shadow-panel">
        <div className="text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-ink">
            <UserRound size={20} />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold">Mon compte</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Informations de session Diego Gestion
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <div className="rounded-card border border-line bg-surface-muted px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Email
            </p>
            <p className="mt-1 text-sm font-semibold">{user?.email ?? "—"}</p>
          </div>
          <div className="rounded-card border border-line bg-surface-muted px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Rôle
            </p>
            <p className="mt-1 text-sm font-semibold">
              {role ? ROLE_LABELS[role] : "Non défini"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-line py-3 text-ink-soft hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={15} /> Se déconnecter
        </button>
      </section>
    </div>
  );
}
