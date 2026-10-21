import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * VI-F07-S02, spec R2: the same input gives the same data. The proof that two
 * loads are equal in every column is `npm run demo:determinism` (it resets the
 * database twice); these are the checks that run with every `npm test` and need
 * no database: the seed files hold nothing that can differ from one load to the
 * next, and the base seed can be loaded again.
 */
const read = (...path: string[]) => readFileSync(join(process.cwd(), ...path), "utf8");

/** The SQL without its comments, so a word in a comment is not a finding. */
function code(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

const SEEDS = {
  "supabase/seed.sql": code(read("supabase", "seed.sql")),
  "supabase/seeds/demo.sql": code(read("supabase", "seeds", "demo.sql")),
};

describe("the seed files hold nothing that differs from one load to the next", () => {
  it.each(Object.entries(SEEDS))("should read no random number, uuid generator or clock in %s", (_file, sql) => {
    for (const forbidden of [
      /gen_random_uuid\s*\(/i,
      /uuid_generate_v\d/i,
      /\brandom\s*\(/i,
      /gen_random_bytes\s*\(/i,
      /\bnow\s*\(\s*\)/i,
      /clock_timestamp\s*\(/i,
      /statement_timestamp\s*\(/i,
      /transaction_timestamp\s*\(/i,
      /current_timestamp/i,
      /\bcurrent_date\b/i,
      /\bgenerate_booking_number\s*\(/i,
      /\bnextval\s*\(/i,
    ]) {
      expect(sql, String(forbidden)).not.toMatch(forbidden);
    }
  });

  it("should load the demo password with a fixed salt, so the stored hash is the same every time", () => {
    expect(SEEDS["supabase/seeds/demo.sql"]).toMatch(/crypt\(c_password, '\$2a\$10\$[./A-Za-z0-9]{22}'\)/);
    expect(SEEDS["supabase/seeds/demo.sql"]).not.toMatch(/gen_salt/i);
  });

  it("should give the seats a public token made from their number, not a random one", () => {
    expect(SEEDS["supabase/seed.sql"]).toMatch(/public_token/);
    expect(SEEDS["supabase/seed.sql"]).toMatch(/md5\('seat-public-token:'/);
  });

  it("should fix every system timestamp of the seeded rows to one moment, in the last step", () => {
    const demo = SEEDS["supabase/seeds/demo.sql"];

    expect(demo).toMatch(/c_base constant timestamptz := timestamptz '2026-08-01 00:00:00\+00'/);
    for (const table of [
      "users",
      "partners",
      "airports",
      "seat_categories",
      "seats",
      "bookings",
      "technician_jobs",
      "installations",
      "cleaning_records",
      "inspection_records",
      "incidents",
    ]) {
      expect(demo, table).toMatch(new RegExp(`update public\\.${table} set created_at = c_base`));
    }
  });

  it("should give the audit rows an id and a time made from their rank, for each of the four audit tables", () => {
    const demo = SEEDS["supabase/seeds/demo.sql"];

    for (const table of [
      "booking_events",
      "seat_status_history",
      "technician_job_events",
      "incident_status_history",
    ]) {
      expect(demo, table).toMatch(new RegExp(`md5\\('${table}:' \\|\\| r\\.n\\)::uuid`));
    }
  });

  it("should turn the triggers back on after it turns them off, for every table it touched", () => {
    const demo = SEEDS["supabase/seeds/demo.sql"];
    const off = [...demo.matchAll(/alter table (public\.\w+) disable trigger user/g)].map((m) => m[1]);
    const on = [...demo.matchAll(/alter table (public\.\w+) enable trigger user/g)].map((m) => m[1]);

    expect(off.length).toBeGreaterThan(0);
    expect([...on].sort()).toEqual([...off].sort());
    expect(demo.lastIndexOf("disable trigger user")).toBeLessThan(demo.indexOf("enable trigger user"));
  });
});

describe("the base seed can be loaded again (spec E2)", () => {
  it("should make every insert of the base seed a no-op for a row that is already there", () => {
    const sql = SEEDS["supabase/seed.sql"];
    const inserts = sql.match(/insert into [\s\S]*?;/gi) ?? [];

    expect(inserts).toHaveLength(6);
    for (const insert of inserts) {
      expect(insert, insert.slice(0, 60)).toMatch(/on conflict \(id\) do nothing;$/i);
    }
  });

  it("should make the demo seed stop early on a database that already has it", () => {
    expect(SEEDS["supabase/seeds/demo.sql"]).toMatch(/already loaded; nothing to do/);
  });
});
