import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Diego Récap",
  description: "Récapitulatif mobile — menu, commandes et revenus.",
  applicationName: "Diego Récap",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Diego Récap",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: [
      { url: "/icons/recap-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/recap-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#c2a24c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RecapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
