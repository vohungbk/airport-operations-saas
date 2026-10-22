import { describe, expect, it } from "vitest";

import { findDataRuleGaps, type DataRuleInput } from "@/lib/data-rules/coverage";

const covered = (): DataRuleInput => ({
  constraints: ["a_check", "a_key"],
  casedConstraints: ["a_check", "a_key"],
  statusFunctions: ["change_a_status"],
  historyTables: ["a_events"],
  casedHistoryTables: ["a_events"],
  tests: [
    {
      file: "a.test.ts",
      text: 'it("should reject an invalid transition", () => { rpc("change_a_status") })',
    },
  ],
});

describe("findDataRuleGaps (VI-F08-S03, spec R3)", () => {
  it("should find no gap when every rule has a test", () => {
    expect(findDataRuleGaps(covered())).toEqual([]);
  });

  it("should report a constraint that has no case that breaks it", () => {
    const input = covered();
    input.constraints.push("b_check");

    expect(findDataRuleGaps(input)).toEqual([
      { id: "constraint:b_check", message: "b_check: no case that breaks it" },
    ]);
  });

  it("should report a case for a constraint that is not in the schema any more", () => {
    const input = covered();
    input.casedConstraints.push("gone_check");

    expect(findDataRuleGaps(input).map((gap) => gap.id)).toEqual(["stale:gone_check"]);
  });

  it("should report a status function that no test names", () => {
    const input = covered();
    input.statusFunctions.push("change_b_status");

    expect(findDataRuleGaps(input).map((gap) => gap.id)).toEqual(["function:change_b_status"]);
  });

  it("should report a status function whose test names it but has no case about a refused transition", () => {
    const input = covered();
    input.tests = [{ file: "a.test.ts", text: 'it("should move it on", () => { rpc("change_a_status") })' }];

    expect(findDataRuleGaps(input).map((gap) => gap.id)).toEqual(["function:change_a_status"]);
  });

  it("should not take a title about a valid transition for a case about a refused one", () => {
    const input = covered();
    input.tests = [
      { file: "a.test.ts", text: 'it("should record a valid transition", () => { rpc("change_a_status") })' },
    ];

    expect(findDataRuleGaps(input).map((gap) => gap.id)).toEqual(["function:change_a_status"]);
  });

  it("should report a history table with no case that tries to change a row", () => {
    const input = covered();
    input.historyTables.push("b_history");

    expect(findDataRuleGaps(input).map((gap) => gap.id)).toEqual(["history:b_history"]);
  });
});
