"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChefHat,
  ClipboardList,
  LogOut,
  Package,
  Settings,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Truck,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { fetchCurrentRole, type UserRole } from "@/lib/auth";

const ITEMS = [
  {
    href: "/recap",
    label: "Récap",
    icon: Smartphone,
    roles: ["superAdmin", "admin"] as const,
  },
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
    href: "/stock",
    label: "Stock",
    icon: Package,
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
    href: "/livraisons",
    label: "Livraisons",
    icon: Truck,
    roles: ["superAdmin", "admin", "caissier"] as const,
  },
  {
    href: "/finances",
    label: "Finances",
    icon: Wallet,
    roles: ["superAdmin", "admin"] as const,
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

  if (
    pathname === "/affichage" ||
<<<<<<< HEAD
    pathname === "/connexion" ||
    pathname.startsWith("/recap")
  ) {
    return null;
  }
=======
    pathname === "/clavier" ||
    pathname === "/connexion"
  )
    return null;
>>>>>>> 1a8c4e257b99c8ff0bf82ebefde37b085416e69b

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
    <nav className="flex w-[4.75rem] shrink-0 flex-col items-center gap-2 border-r border-line bg-surface px-2 py-4 sm:w-20">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl diego-gradient text-white shadow-card">
        <UtensilsCrossed size={18} />
      </div>

      <div className="flex w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-2.5 transition-all ${
                active
                  ? "diego-gradient text-white shadow-panel"
                  : "text-ink-soft hover:bg-surface-soft hover:text-ink"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.4 : 2} />
              <span className="max-w-full whitespace-normal break-words text-center font-sans text-[9px] font-semibold normal-case leading-tight tracking-normal">
                {label}
              </span>
            </Link>
          );
        })}
      </div>

      {role !== null && (
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-2 flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-ink-soft transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={17} />
          <span className="text-center font-sans text-[9px] font-semibold normal-case leading-tight tracking-normal">
            Sortir
          </span>
        </button>
      )}
    </nav>
  );
}
