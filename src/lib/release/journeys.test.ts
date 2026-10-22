import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  JOURNEYS,
  JOURNEY_ROLES,
  MIN_JOURNEYS_PER_ROLE,
  findJourneyGaps,
  type Journey,
} from "@/lib/release/journeys";

/**
 * VI-F08-S08 (spec E3): a fix that breaks a journey that passed is caught by the
 * regression suite before release. The suite is `npm test`; the journeys are the
 * blocks of tests of the integration suites. This checks that every journey of every
 * role names a block that is still in its file, so a test that is renamed or removed
 * cannot leave a journey with nothing to catch it.
 */
const read = (file: string) => {
  const path = join(process.cwd(), file);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
};

describe("the key journeys of each role (spec E3)", () => {
  it("should have a test in place for every journey of the register", () => {
    expect(findJourneyGaps(JOURNEYS, read)).toEqual([]);
  });

  it.each(JOURNEY_ROLES.map((role) => [role] as const))("should have at least %s journeys of its own that a test checks", (role) => {
    const count = JOURNEYS.filter((journey) => journey.roles.includes(role)).length;

    expect(count, role).toBeGreaterThanOrEqual(MIN_JOURNEYS_PER_ROLE);
  });

  it("should have a unique id for every journey", () => {
    const ids = JOURNEYS.map((journey) => journey.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should be run by the tests gate of the release gates, which is the whole suite", () => {
    const script = readFileSync(join(process.cwd(), "scripts", "release-gates.sh"), "utf8");

    expect(script).toContain("run_gate tests npm run test");
  });
});

describe("findJourneyGaps", () => {
  const journey = (over: Partial<Journey> = {}): Journey => ({
    id: "T1",
    roles: JOURNEY_ROLES,
    title: "A journey",
    tests: [{ file: "a.test.ts", block: "the block" }],
    ...over,
  });
  const many = (n: number) => Array.from({ length: n }, (_, i) => journey({ id: `T${i}` }));
  const files = (text: string | null) => () => text;

  it("should find no gap when every role has enough journeys and every block is in its file", () => {
    expect(findJourneyGaps(many(MIN_JOURNEYS_PER_ROLE), files('describe("the block", () => {})'))).toEqual([]);
  });

  it("should report a role with too few journeys", () => {
    const gaps = findJourneyGaps(many(2), files('describe("the block", () => {})'));

    expect(gaps).toHaveLength(JOURNEY_ROLES.length);
    expect(gaps[0]).toContain("2 journeys");
  });

  it("should report a journey that no test checks", () => {
    const gaps = findJourneyGaps([...many(3), journey({ id: "T9", tests: [] })], files('describe("the block", () => {})'));

    expect(gaps).toEqual(["T9 (A journey): no test checks it"]);
  });

  it("should report a test file that is gone", () => {
    const gaps = findJourneyGaps(many(3), files(null));

    expect(gaps).toHaveLength(3);
    expect(gaps[0]).toContain("a.test.ts does not exist");
  });

  it("should not take the name of a block in a comment or a string for a block", () => {
    const gaps = findJourneyGaps(many(3), files('// the block\nconst name = "the block";'));

    expect(gaps).toHaveLength(3);
  });

  it("should find a block of a describe that is skipped when the stack is down", () => {
    expect(findJourneyGaps(many(3), files('describe.skipIf(!config)("the block", () => {})'))).toEqual([]);
  });

  it("should find a block whose name has characters of a pattern", () => {
    const journeys = Array.from({ length: 3 }, (_, i) =>
      journey({ id: `P${i}`, tests: [{ file: "a.test.ts", block: "bookings (F11)" }] }),
    );

    expect(findJourneyGaps(journeys, files('describe("bookings (F11)", () => {})'))).toEqual([]);
  });

  it("should report a block that was renamed or removed from its file", () => {
    const gaps = findJourneyGaps(many(3), files('describe("another name", () => {})'));

    expect(gaps).toHaveLength(3);
    expect(gaps[0]).toContain('"the block" is no longer in a.test.ts');
  });
});
