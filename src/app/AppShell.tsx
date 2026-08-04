"use client";

import { usePathname } from "next/navigation";
import { NavRail } from "@/components/NavRail";
import { AuthGate } from "@/components/AuthGate";

const FULLSCREEN_ROUTES = ["/affichage", "/connexion", "/recap"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullscreen = FULLSCREEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (fullscreen) {
    return (
      <div className="h-dvh overflow-hidden">
        <AuthGate>{children}</AuthGate>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <NavRail />
      <main className="min-w-0 flex-1 overflow-hidden">
        <AuthGate>{children}</AuthGate>
      </main>
    </div>
  );
}
