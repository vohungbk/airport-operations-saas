import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * VI-F02-S03: the service-role key bypasses RLS, so it has one reader and one client, and only
 * the system job that needs it imports that client. This reads the source of the app: it is a
 * floor, not a proof.
 */
const SRC = join(process.cwd(), "src");
const KEY_VARIABLE = "SUPABASE_SERVICE_ROLE_KEY";
const ENV_FILE = "src/lib/config/server-env.ts";
const CLIENT_FILE = "src/lib/supabase/service-role.ts";
const ALLOWED_CLIENT_USERS = ["src/app/api/flights/refresh/route.ts"];

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const APP_FILES = listFiles(SRC)
  .filter((file) => !/\.test\.tsx?$/.test(file))
  .map((file) => ({ file: relative(process.cwd(), file), source: readFileSync(file, "utf8") }));

const filesMatching = (pattern: RegExp) =>
  APP_FILES.filter(({ source }) => pattern.test(source)).map(({ file }) => file);

describe("the service-role key stays in the system jobs", () => {
  it("should read the key variable in the server configuration only", () => {
    expect(filesMatching(new RegExp(KEY_VARIABLE))).toEqual([ENV_FILE]);
  });

  it("should not put the key behind the NEXT_PUBLIC_ prefix", () => {
    expect(filesMatching(/NEXT_PUBLIC_\w*(SERVICE_ROLE|CRON)/i)).toEqual([]);
  });

  it("should import the service-role client in the flight refresh route only", () => {
    expect(filesMatching(/from\s+["'][^"']*supabase\/service-role["']/)).toEqual(ALLOWED_CLIENT_USERS);
  });

  it("should define the service-role client in one file of the app", () => {
    expect(filesMatching(/export function createServiceRoleClient/)).toContain(CLIENT_FILE);
  });

  it("should not import the service-role client from a client component", () => {
    const clientFiles = APP_FILES.filter(({ source }) => /^\s*["']use client["']/m.test(source));

    expect(clientFiles.length).toBeGreaterThan(0);
    expect(clientFiles.filter(({ source }) => /service-role|server-env/.test(source))).toEqual([]);
  });
});
