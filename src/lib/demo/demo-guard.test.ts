import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * VI-F07-S06: demo data is not loaded next to real data (spec E1), and a load
 * that fails halfway keeps nothing (spec E3). The checks that need the database
 * are in demo-data.integration.test.ts; these need none: they read the seed
 * files and keep the two properties from being lost by an edit.
 */
const read = (...path: string[]) => readFileSync(join(process.cwd(), ...path), "utf8");

/** The SQL without its comments, so a word in a comment is not a finding. */
const code = (sql: string) => sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const BASE = code(read("supabase", "seed.sql"));
const DEMO = code(read("supabase", "seeds", "demo.sql"));

describe("the seed files guard against real data (spec E1)", () => {
  it.each([
    ["supabase/seed.sql", BASE],
    ["supabase/seeds/demo.sql", DEMO],
  ])("should refuse real addresses in %s before it inserts anything", (_file, sql) => {
    const guard = sql.indexOf("refusing to load demo data");
    const firstInsert = sql.search(/\binsert\s+into\b/i);

    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(firstInsert);
    expect(sql).toMatch(/email\s*!~\*\s*'\(\\\.example\|@test\\\.local\)\$'/);
  });

  it("should check the Auth accounts as well as the profiles in both seeds", () => {
    for (const sql of [BASE, DEMO]) {
      expect(sql).toMatch(/from public\.users/i);
      expect(sql).toMatch(/from auth\.users/i);
    }
  });
});

describe("a load that fails halfway keeps nothing (spec E3)", () => {
  it("should make demo.sql one statement: a single do block, so it is all or nothing", () => {
    const sql = DEMO.trim();

    expect(sql).toMatch(/^do \$demo\$/i);
    expect(sql).toMatch(/end\s+\$demo\$;$/i);
    expect(sql.match(/\$demo\$/g)).toHaveLength(2);
  });

  it("should leave demo.sql without transaction control, which would split or end the one statement", () => {
    expect(DEMO).not.toMatch(/\b(commit|rollback)\b\s*;/i);
    expect(DEMO).not.toMatch(/^\s*begin\s*;/im);
  });
});
