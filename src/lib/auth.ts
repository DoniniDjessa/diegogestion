import { getSupabase } from "@/lib/supabase";
import { DIEGO_TABLES } from "@/lib/supabase/constants";

export const USER_ROLES = [
  "superAdmin",
  "admin",
  "caissier",
  "utilisateur",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const STAFF_ROLES: readonly UserRole[] = [
  "superAdmin",
  "admin",
  "caissier",
];

export const ADMIN_ROLES: readonly UserRole[] = ["superAdmin", "admin"];

export type RoleLookup = {
  role: UserRole | null;
  /** Erreur technique de la requête (table absente, RLS…), null sinon. */
  error: string | null;
};

/**
 * Rôle de l'utilisateur connecté, lu dans la table "diego-users".
 * Le projet Supabase est partagé entre plusieurs applications : un compte
 * auth qui n'a pas de ligne dans "diego-users" n'appartient pas à Diego
 * et le rôle est alors null.
 */
export async function fetchCurrentRoleResult(): Promise<RoleLookup> {
  const supabase = getSupabase();
  if (!supabase) return { role: null, error: "Supabase n'est pas configuré." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { role: null, error: null };

  const { data, error } = await supabase
    .from(DIEGO_TABLES.users)
    .select("role")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (error) {
    console.error("[diego-users] role lookup failed:", error);
    return { role: null, error: error.message };
  }

  const role = data?.role as UserRole | undefined;
  return { role: role && USER_ROLES.includes(role) ? role : null, error: null };
}

export async function fetchCurrentRole(): Promise<UserRole | null> {
  return (await fetchCurrentRoleResult()).role;
}

export function isStaffRole(role: UserRole | null): boolean {
  return role !== null && STAFF_ROLES.includes(role);
}

export function isAdminRole(role: UserRole | null): boolean {
  return role !== null && ADMIN_ROLES.includes(role);
}

export function homeForRole(role: UserRole | null): string {
  if (role === "superAdmin" || role === "admin") return "/menu";
  if (role === "caissier") return "/caisse";
  return "/connexion";
}
