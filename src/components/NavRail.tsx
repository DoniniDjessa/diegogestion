"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChefHat,
  ClipboardList,
  LogOut,
  Settings,
  ShoppingBasket,
  Sofa,
  UtensilsCrossed,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { fetchCurrentRole, type UserRole } from "@/lib/auth";

const ITEMS = [
  {
    href: "/caisse",
    label: "Caisse",
    icon: ShoppingBasket,
    roles: ["superAdmin", "admin", "caissier"] as const,
  },
  {
    href: "/cuisine",
    label: "Cuisine",
    icon: ChefHat,
    roles: ["superAdmin", "admin", "caissier"] as const,
  },
  {
    href: "/salle",
    label: "Salle",
    icon: Sofa,
    roles: ["superAdmin", "admin"] as const,
  },
  {
    href: "/commandes",
    label: "Commandes",
    icon: ClipboardList,
    roles: ["superAdmin", "admin", "caissier"] as const,
  },
  {
    href: "/parametres",
    label: "Paramètres",
    icon: Settings,
    roles: ["superAdmin", "admin", "caissier"] as const,
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/parametres") {
    return (
      pathname.startsWith("/parametres") || pathname.startsWith("/utilisateurs")
    );
  }
  return pathname.startsWith(href);
}

export function NavRail() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    const refresh = async () => {
      const nextRole = await fetchCurrentRole();
      if (active) setRole(nextRole);
    };
    void refresh();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setRole(null);
        return;
      }
      void refresh();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Customer-facing display and login stay full-screen.
  if (pathname === "/affichage" || pathname === "/connexion") return null;

  const visibleItems = ITEMS.filter(
    (item) =>
      role !== null && (item.roles as readonly UserRole[]).includes(role)
  );

  async function logout() {
    const supabase = getSupabase();
    await supabase?.auth.signOut();
    router.replace("/connexion");
    router.refresh();
  }

  return (
    <>
      {/* Sidebar — écrans larges (≥ 1250px) */}
      <nav className="hidden min-[1250px]:flex w-44 shrink-0 flex-col gap-1.5 border-r border-line bg-surface px-3 py-4">
        <div className="mb-4 flex items-center gap-2.5 px-1.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-500 bg-brand-50">
            <UtensilsCrossed size={17} className="text-brand-600" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold text-brand-600">
              DIEGO
            </p>
            <p className="text-2xs text-ink-faint">Gestion</p>
          </div>
        </div>
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 transition-colors ${
                active
                  ? "bg-brand-500 text-ink shadow-card"
                  : "text-ink-soft hover:bg-surface-soft hover:text-ink"
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
        {role !== null && (
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-auto flex items-center gap-2.5 rounded-full px-4 py-2.5 text-ink-soft transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        )}
      </nav>

      {/* Barre horizontale — jusqu'à 1250px */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-surface py-1.5 min-[1250px]:hidden">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 rounded-card px-2 py-1 ${
                active ? "text-brand-600" : "text-ink-soft"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
        {role !== null && (
          <button
            type="button"
            onClick={() => void logout()}
            className="flex flex-col items-center gap-0.5 rounded-card px-2 py-1 text-ink-soft hover:text-red-600"
          >
            <LogOut size={18} />
            Sortir
          </button>
        )}
      </nav>
    </>
  );
}
