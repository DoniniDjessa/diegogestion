"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogIn, Settings, UserPlus, UtensilsCrossed } from "lucide-react";
import { fetchCurrentRole, isAdminRole, type UserRole } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export default function ParametresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void fetchCurrentRole().then(setRole);
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setRole(null);
      else void fetchCurrentRole().then(setRole);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const tabs = [
    { href: "/parametres/compte", label: "Compte", icon: LogIn },
    ...(isAdminRole(role)
      ? [
          {
            href: "/parametres/menu",
            label: "Menu",
            icon: UtensilsCrossed,
          },
          {
            href: "/parametres/utilisateurs",
            label: "Utilisateurs",
            icon: UserPlus,
          },
        ]
      : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-brand-600" />
          <h1 className="font-display text-base font-bold">Paramètres</h1>
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition ${
                  active
                    ? "border-brand-500 bg-brand-500 text-ink"
                    : "border-line bg-white text-ink-soft hover:border-brand-300 hover:text-brand-600"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
