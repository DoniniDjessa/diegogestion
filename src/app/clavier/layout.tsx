import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Diego Clavier caisse",
  description: "Clavier et pavé numérique pour la caisse Diego.",
  manifest: "/manifests/clavier.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Clavier",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/ky.jpg",
    apple: "/ky.jpg",
  },
};

export const viewport: Viewport = {
  themeColor: "#c2a24c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ClavierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
