// Applique les migrations SQL Supabase dans l'ordre chronologique.
//
// Usage :
//   1. Renseigner SUPABASE_DB_URL dans diegogestion/.env.local
//      (Dashboard Supabase → Project Settings → Database → Connection string → URI,
//       en remplaçant [YOUR-PASSWORD] par le mot de passe de la base).
//   2. npm run db:migrate
//
// Le script lit tous les fichiers supabase/migrations/*.sql triés par nom et
// exécute chacun dans une transaction. Les migrations sont idempotentes
// (create ... if not exists, create or replace, drop ... if exists), à
// l'exception de « alter publication ... add table » qui est ignoré s'il a
// déjà été appliqué.

import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "..", "supabase", "migrations");

function loadEnvLocal() {
  const path = join(HERE, "..", ".env.local");
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env.local absent : on se rabat sur l'environnement courant.
  }
}

async function main() {
  loadEnvLocal();

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error(
      "\n✗ SUPABASE_DB_URL manquant.\n" +
        "  Ajoutez-le dans diegogestion/.env.local, par ex. :\n" +
        "  SUPABASE_DB_URL=postgresql://postgres.kywgxckxtikapzcxxksz:MOT_DE_PASSE@aws-0-eu-west-3.pooler.supabase.com:6543/postgres\n"
    );
    process.exit(1);
  }

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.error("✗ Aucune migration trouvée dans supabase/migrations.");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`Connecté. ${files.length} migration(s) à appliquer.\n`);

  try {
    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`→ ${file} … `);
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("commit");
        console.log("OK");
      } catch (error) {
        await client.query("rollback");
        const message = String(error?.message ?? error);
        if (/already a member of publication|already exists/i.test(message)) {
          console.log("déjà appliqué (ignoré)");
        } else {
          console.log("ÉCHEC");
          throw new Error(`${file}: ${message}`);
        }
      }
    }
    console.log("\n✓ Migrations appliquées avec succès.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
