import { BrandLoader } from "@/components/BrandLoader";

/** Fallback if the next.config redirect is skipped (e.g. soft nav). */
export default function MenuPage() {
  return <BrandLoader label="Redirection…" />;
}
