import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Test support: runs SQL as the database owner in the container of the local
 * Supabase stack. For checks that PostgREST cannot make, such as reading the
 * catalog or trying a statement inside a transaction that is rolled back.
 * Nothing in the app imports it.
 */

/** The database container of the local stack, found from the project id. */
export function dbContainer(): string | null {
  try {
    const toml = readFileSync(join(process.cwd(), "supabase", "config.toml"), "utf8");
    const id = /^project_id\s*=\s*"([^"]+)"/m.exec(toml)?.[1];
    return id ? `supabase_db_${id}` : null;
  } catch {
    return null;
  }
}

/** Runs SQL in the local database container; `null` when Docker is not there. */
export function runSql(sql: string): { ok: boolean; output: string } | null {
  const container = dbContainer();
  if (!container) return null;

  const result = spawnSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8", timeout: 60_000 },
  );

  if (result.error) return null;

  return {
    ok: result.status === 0,
    output: `${result.stdout}${result.stderr}`,
  };
}
