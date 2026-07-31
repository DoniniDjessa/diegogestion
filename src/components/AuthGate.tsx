"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandLoader } from "@/components/BrandLoader";
import { getSupabase } from "@/lib/supabase";
import {
  fetchCurrentRole,
  homeForRole,
  isStaffRole,
  type UserRole,
} from "@/lib/auth";

const PUBLIC_ROUTES = ["/connexion", "/affichage", "/clavier"];

function canOpenPath(role: UserRole | null, pathname: string): boolean {
  if (role === "superAdmin" || role === "admin") return true;
  if (role === "caissier") {
    return (
      pathname === "/" ||
      pathname.startsWith("/caisse") ||
      pathname.startsWith("/cuisine") ||
      pathname.startsWith("/stock") ||
      pathname.startsWith("/commandes") ||
      pathname.startsWith("/livraisons") ||
      pathname === "/parametres" ||
      pathname.startsWith("/parametres/compte")
    );
  }
  return false;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const [checking, setChecking] = useState(!isPublic);

  useEffect(() => {
    if (isPublic) {
      setChecking(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      router.replace("/connexion");
      setChecking(false);
      return;
    }

    let active = true;
    async function check() {
      const role = await fetchCurrentRole();
      if (!active) return;
      if (!isStaffRole(role)) {
        router.replace("/connexion");
      } else if (!canOpenPath(role, pathname)) {
        router.replace(homeForRole(role));
      }
      setChecking(false);
    }
    void check();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/connexion");
        return;
      }
      void check();
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [isPublic, pathname, router]);

  if (checking) {
    return <BrandLoader />;
  }

  return children;
}
