import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * VI-F02-S13: reads the migration that restricts who may read a flight. It runs without a database, so
 * the rule is checked on every run; the policies themselves are proven by flights-access.integration.test.ts.
 */
const MIGRATION = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261204090000_restrict_flight_select.sql"),
  "utf8",
);

/** The SQL without its comments, so a rollback line in a comment is not read as a statement. */
const SQL = MIGRATION.split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const POLICIES = ["flights_select_admin_ops_manager", "flights_select_technician", "flights_select_partner_user"];

describe("restrict flight select migration (VI-F02-S13)", () => {
  it("should drop the policy that let every signed-in user read every flight", () => {
    expect(SQL).toMatch(/drop policy "flights_select_authenticated" on public\.flights;/);
  });

  it.each(POLICIES)("should create the select policy %s for signed-in users on flights", (name) => {
    expect(SQL).toMatch(new RegExp(`create policy "${name}"\\s+on public\\.flights for select\\s+to authenticated`));
  });

  it("should not open flights to everyone again with using (true)", () => {
    expect(SQL).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it("should tie a partner user to its own partner and a technician to its own bookings", () => {
    expect(SQL).toMatch(/b\.partner_id = \(select public\.current_user_partner_id\(\)\)/);
    expect(SQL).toMatch(/b\.assigned_technician_id = \(select auth\.uid\(\)\)/);
    expect(SQL).toMatch(/tj\.technician_id = \(select auth\.uid\(\)\)/);
  });

  it("should let admin and operations manager read every flight through the existing role check", () => {
    expect(SQL).toMatch(/using \(\(select public\.is_admin_or_ops_manager\(\)\)\)/);
  });

  it("should not change who may insert or update a flight", () => {
    expect(SQL).not.toMatch(/for (insert|update|delete)/i);
  });

  it("should not create a policy for anonymous callers", () => {
    expect(SQL).not.toMatch(/to anon|to public/i);
  });
});
