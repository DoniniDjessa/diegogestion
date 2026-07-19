export function formatFCFA(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} F`;
}

export const CHANNEL_META: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  comptoir: { label: "Comptoir", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  table: { label: "Au resto", color: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  emporter: { label: "À emporter", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  livraison: { label: "Livraison", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
};
