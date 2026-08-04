"use client";

import { usePathname } from "next/navigation";
import { NavRail } from "@/components/NavRail";
import { AuthGate } from "@/components/AuthGate";
import { PwaRegister } from "@/components/PwaRegister";
import { usePosKeyboardDomBridge } from "@/lib/pos-keyboard";

<<<<<<< HEAD
const FULLSCREEN_ROUTES = ["/affichage", "/connexion", "/recap"];
=======
const FULLSCREEN_ROUTES = ["/affichage", "/clavier", "/connexion"];
>>>>>>> 1a8c4e257b99c8ff0bf82ebefde37b085416e69b

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  usePosKeyboardDomBridge();
  const fullscreen = FULLSCREEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (fullscreen) {
    return (
      <div className="h-dvh overflow-hidden">
        <PwaRegister />
        <AuthGate>{children}</AuthGate>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <PwaRegister />
      <NavRail />
      <main className="min-w-0 flex-1 overflow-hidden">
        <AuthGate>{children}</AuthGate>
      </main>
    </div>
  );
}
