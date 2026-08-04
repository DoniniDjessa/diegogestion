import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Diego Affichage client",
  description: "Écran client — total, montant remis et monnaie.",
  manifest: "/manifests/affichage.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Affichage",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#c2a24c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function AffichageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
