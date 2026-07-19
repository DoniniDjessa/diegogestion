import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { USER_ROLES, type UserRole } from "@/lib/auth";
import { DIEGO_TABLES } from "@/lib/supabase/constants";

export const runtime = "nodejs";

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string
) {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const user = data.users.find(
      (item) => item.email?.toLowerCase() === email
    );
    if (user) return user;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

async function upsertDiegoUser(
  supabase: SupabaseClient,
  user: { id: string; email: string },
  role: UserRole
) {
  const { error } = await supabase.from(DIEGO_TABLES.users).upsert(
    {
      id: user.id,
      email: user.email.toLowerCase(),
      role,
      active: true,
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}

export async function POST(request: Request) {
  try {
    return await handleRegister(request);
  } catch (cause) {
    console.error("[register] unexpected error:", cause);
    const message =
      cause instanceof Error && /schema cache|does not exist/i.test(cause.message)
        ? "La table diego-users est introuvable. Exécutez la migration 20260719160000_diego_users.sql puis « notify pgrst, 'reload schema'; » dans le SQL Editor."
        : "Erreur interne lors de la création du compte.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleRegister(request: Request) {
  const supabase = serverClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "La configuration Supabase serveur est incomplète." },
      { status: 500 }
    );
  }

  let body: { email?: string; password?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const role = body.role as UserRole;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Le mot de passe doit contenir au moins 8 caractères." },
      { status: 400 }
    );
  }
  if (!USER_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Type de compte invalide." },
      { status: 400 }
    );
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;
  if (!token) {
    return NextResponse.json(
      { error: "Connectez-vous comme admin ou superAdmin." },
      { status: 401 }
    );
  }

  const { data: caller, error: callerError } =
    await supabase.auth.getUser(token);
  if (callerError || !caller.user) {
    return NextResponse.json(
      { error: "Session invalide ou expirée." },
      { status: 401 }
    );
  }
  const { data: callerRow, error: callerRowError } = await supabase
    .from(DIEGO_TABLES.users)
    .select("role")
    .eq("id", caller.user.id)
    .eq("active", true)
    .maybeSingle();
  if (callerRowError) throw callerRowError;

  const callerRole = callerRow?.role as UserRole | undefined;
  if (callerRole !== "admin" && callerRole !== "superAdmin") {
    return NextResponse.json(
      { error: "Seuls les admins peuvent créer des utilisateurs." },
      { status: 403 }
    );
  }
  if (role === "superAdmin" && callerRole !== "superAdmin") {
    return NextResponse.json(
      { error: "Seul un superAdmin peut créer un autre superAdmin." },
      { status: 403 }
    );
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });

  if (!error) {
    await upsertDiegoUser(supabase, { id: data.user.id, email }, role);
    return NextResponse.json(
      { id: data.user.id, email: data.user.email, role },
      { status: 201 }
    );
  }

  const duplicate = /already|registered|exists/i.test(error.message);
  if (!duplicate) {
    return NextResponse.json(
      { error: "Impossible de créer le compte." },
      { status: 400 }
    );
  }

  // The auth account may belong to another app sharing this Supabase project.
  // An authorized Diego admin can attach it without changing its password.
  const existingAuthUser = await findAuthUserByEmail(supabase, email);
  if (!existingAuthUser) {
    return NextResponse.json(
      { error: "Le compte Auth existant est introuvable." },
      { status: 409 }
    );
  }

  const { data: existingRow } = await supabase
    .from(DIEGO_TABLES.users)
    .select("id")
    .eq("id", existingAuthUser.id)
    .maybeSingle();
  if (existingRow) {
    return NextResponse.json(
      { error: "Ce compte est déjà enregistré dans Diego." },
      { status: 409 }
    );
  }

  await upsertDiegoUser(supabase, { id: existingAuthUser.id, email }, role);
  return NextResponse.json(
    { id: existingAuthUser.id, email, role },
    { status: 200 }
  );
}
