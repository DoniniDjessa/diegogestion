import type { Metadata } from "next";
import { Great_Vibes, Manrope, Marcellus, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AppShell } from "./AppShell";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-manrope",
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
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body
        className={`${manrope.className} ${manrope.variable} ${marcellus.variable} ${playfair.variable} ${greatVibes.variable}`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
