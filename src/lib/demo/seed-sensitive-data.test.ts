import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { findSensitiveData } from "@/lib/demo/sensitive-data";

/**
 * VI-F07-S03, spec R3: no real personal, financial or credential data in the
 * demo data. These are the checks that need no database and run with every
 * `npm test`: the seed files are scanned as text. The rows once loaded are
 * scanned in demo-data.integration.test.ts.
 */
const read = (...path: string[]) => readFileSync(join(process.cwd(), ...path), "utf8");

const SEED_FILES = {
  "supabase/seed.sql": read("supabase", "seed.sql"),
  "supabase/seeds/demo.sql": read("supabase", "seeds", "demo.sql"),
};

// A password-shaped sample, put together here so that this file holds no
// credential-shaped text of its own for a secret scanner to take for a real one.
const assigned = (name: string, value: string) => `${name} = '${value}'`;

/** The demo password is public on purpose (docs/database.md); nothing else is. */
function demoPassword(): string {
  return /c_password constant text := '([^']+)'/.exec(SEED_FILES["supabase/seeds/demo.sql"])![1];
}

const scan = (text: string) => findSensitiveData(text, { allow: [demoPassword()] });

describe("the seed files hold no real personal, financial or credential data", () => {
  it.each(Object.entries(SEED_FILES))("should have nothing sensitive in %s, comments included", (file, sql) => {
    expect(scan(sql), file).toEqual([]);
  });

  it("should allow exactly one public value: the demo password, set in one place", () => {
    const passwordWords = SEED_FILES["supabase/seeds/demo.sql"].match(/'[^'\n]*Passw[^'\n]*'/gi) ?? [];

    expect(passwordWords).toEqual([`'${demoPassword()}'`]);
    // Left allowed, the same text anywhere else in the files would be a finding.
    expect(findSensitiveData(assigned("pass" + "word", "z".repeat(14)), { allow: [demoPassword()] }).length).toBeGreaterThan(0);
  });

  it("should use only demo addresses: every email ends in .example", () => {
    const addresses = Object.values(SEED_FILES)
      .flatMap((sql) => sql.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]+/g) ?? []);

    expect(addresses.length).toBeGreaterThan(10);
    expect(addresses.every((a) => a.toLowerCase().endsWith(".example"))).toBe(true);
  });

  it("should name no real company or person: the names the seed used to have are gone", () => {
    // The base seed once had real company names and names that could be a real
    // person's. They were made clearly fictional (Demo ...); this keeps them out.
    for (const removed of [
      "Emirates Rent A Car",
      "Al Futtaim",
      "emiratesrentacar",
      "alfuttaim",
      "Mazrouei",
      "Suwaidi",
      "Nuaimi",
    ]) {
      for (const [file, sql] of Object.entries(SEED_FILES)) {
        expect(sql.toLowerCase(), `${removed} in ${file}`).not.toContain(removed.toLowerCase());
      }
    }
  });

  it("should give every person and company of the seed a name that starts with Demo", () => {
    const people = [...SEED_FILES["supabase/seed.sql"].matchAll(/technician\d@airportops\.example', '([^']+)'/g)].map((m) => m[1]);
    const companies = [...SEED_FILES["supabase/seed.sql"].matchAll(/\('b0000000-[0-9-]+', '([^']+)'/g)].map((m) => m[1]);
    const accounts = [...SEED_FILES["supabase/seeds/demo.sql"].matchAll(/@airportops\.example', '([^']+)'/g)].map((m) => m[1]);

    expect(people).toHaveLength(3);
    expect(companies).toHaveLength(2);
    expect(accounts.length).toBeGreaterThanOrEqual(4);
    for (const name of [...people, ...companies, ...accounts]) {
      expect(name.startsWith("Demo "), name).toBe(true);
    }
  });
});

describe("the scan would catch real data if it were added to a seed", () => {
  const seed = SEED_FILES["supabase/seeds/demo.sql"];

  it.each([
    ["a real email address", "insert into users values ('x', 'maria.garcia@gmail.com');", "email"],
    ["a card number", "update bookings set notes = 'paid with 4111 1111 1111 1111';", "card number"],
    ["a phone number", "update bookings set notes = 'call +971 50 123 4567';", "phone number"],
    ["an API key", `-- stripe ${"sk_" + "live_"}${"a".repeat(12)}`, "api key"],
    ["another password", `c_other_${"pass" + "word"} constant text := '${"q".repeat(12)}';`, "credential in text"],
    ["a link to a real site", "-- see https://www.dubaiairports.ae/", "url"],
  ])("should catch %s added to the demo seed", (_label, line, kind) => {
    expect(scan(`${seed}\n${line}`).map((f) => f.kind)).toContain(kind);
  });
});
