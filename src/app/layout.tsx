import type { Metadata, Viewport } from "next";
import {
  Fira_Sans_Condensed,
  Great_Vibes,
  Manrope,
  Marcellus,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";
import { AppShell } from "./AppShell";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-manrope",
});
const firaSans = Fira_Sans_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fira",
  display: "swap",
});
const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-greatvibes",
});
const marcellus = Marcellus({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-marcellus",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: "Diego Gestion — POS & Back-Office",
  description:
    "Caisse, cuisine (KDS), salle et menu — gestion omnicanale du restaurant Diego.",
  manifest: "/manifests/app.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Diego",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/diego.png",
    apple: "/diego.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#c2a24c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${manrope.variable} ${firaSans.variable} ${marcellus.variable} ${playfair.variable} ${greatVibes.variable}`}
    >
      <body className={manrope.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
