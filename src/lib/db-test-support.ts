import { spawn, spawnSync } from "node:child_process";
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

/**
 * The same as `runSql`, without waiting: for tests that need two sessions at the same time (each one
 * its own transaction, so it sees what the other has committed, not what it is still doing).
 */
export function runSqlAsync(sql: string): Promise<{ ok: boolean; output: string } | null> {
  const container = dbContainer();
  if (!container) return Promise.resolve(null);

  return new Promise((resolve) => {
    const child = spawn(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
      { timeout: 60_000 },
    );
    let output = "";

    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", () => resolve(null));
    child.on("close", (code) => resolve({ ok: code === 0, output }));
    child.stdin.end(sql);
  });
}
