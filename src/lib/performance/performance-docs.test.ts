import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AGREED_TARGETS } from "@/lib/performance/targets";

/**
 * VI-F08-S06 (spec E2, AC02): no target is claimed before it is agreed. While the
 * register of agreed targets is empty, the text about performance must not state
 * a number as a goal, a limit or a promise.
 */
const doc = readFileSync(join(process.cwd(), "docs", "performance.md"), "utf8");

/** A word that makes a promise, close to a time. */
const CLAIM =
  /\b(target|goal|sla|must be|should be|will be|within|under|below|less than|at most|no more than|guarantee)\b[^.\n|]{0,40}\b\d+(\.\d+)?\s?(ms|milliseconds?|s|seconds?)\b/i;

describe("the text about performance claims no target (spec E2)", () => {
  it("should have no agreed target in the register", () => {
    expect(AGREED_TARGETS).toEqual([]);
  });

  it("should say that no target is agreed", () => {
    expect(doc).toContain("No performance target is agreed");
  });

  it("should state no time as a goal, a limit or a promise while no target is agreed", () => {
    const claims = doc.split("\n").filter((line) => CLAIM.test(line));

    expect(claims).toEqual([]);
  });

  it.each([
    ["Bookings list must be under 500 ms"],
    ["The target is 2 seconds"],
    ["pages load within 300ms"],
    ["response time should be at most 1 s"],
  ])("should find a claim of a target: %s", (line) => {
    expect(CLAIM.test(line)).toBe(true);
  });

  it.each([
    ["| Bookings list | 26 | 73 | 81 |"],
    ["Times in milliseconds."],
    ["It signs in as the demo admin and times, for one user and one request after another."],
    ["Add it with the limit for p95 in milliseconds, who agreed it."],
  ])("should not take a plain measurement or a description for a claim: %s", (line) => {
    expect(CLAIM.test(line)).toBe(false);
  });
});
