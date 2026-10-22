import { describe, expect, it } from "vitest";

import {
  WORKFLOWS,
  buildReport,
  evaluate,
  summarize,
  type Measured,
  type ReportInput,
} from "@/lib/performance/measure";
import { AGREED_TARGETS, validateTargets, type AgreedTarget } from "@/lib/performance/targets";

const target = (over: Partial<AgreedTarget> = {}): AgreedTarget => ({
  workflow: "list:bookings",
  metric: "p95_ms",
  limit_ms: 500,
  agreed_by: "Product owner",
  agreed_on: "2026-11-01",
  load: "one user, local database, production build",
  ...over,
});

const measured = (times: number[], id = "list:bookings"): Measured => ({
  workflow: WORKFLOWS.find((w) => w.id === id)!,
  stats: summarize(times),
});

const report = (over: Partial<ReportInput> = {}) =>
  buildReport({
    measuredAt: "2026-10-22 12:00 UTC",
    commit: "abc1234",
    mode: "production",
    environment: "node v22 darwin",
    measured: [measured([100, 200, 300, 400, 500])],
    targets: [],
    rejected: [],
    ...over,
  });

describe("summarize (VI-F08-S06)", () => {
  it("should give the minimum, median, 95th percentile and maximum of the runs", () => {
    const times = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);

    expect(summarize(times)).toEqual({ runs: 20, min: 10, median: 100, p95: 190, max: 200 });
  });

  it("should not depend on the order of the runs", () => {
    expect(summarize([500, 100, 300, 200, 400])).toEqual(summarize([100, 200, 300, 400, 500]));
  });

  it("should give the one run as every figure when there is only one", () => {
    expect(summarize([42])).toEqual({ runs: 1, min: 42, median: 42, p95: 42, max: 42 });
  });

  it("should refuse to summarize no runs, not make a figure up", () => {
    expect(() => summarize([])).toThrow("no runs");
  });
});

describe("buildReport figures", () => {
  it("should show one decimal under 10 ms and whole milliseconds from 10", () => {
    const text = report({ measured: [measured([4.26, 4.31, 4.4]), measured([12.4, 12.6, 99.5], "list:seats")] });

    expect(text).toMatch(/Bookings list[^\n]*\| 4\.3 \| 4\.3 \| 4\.4 \| 4\.4 \|/);
    expect(text).toMatch(/Seats list[^\n]*\| 12 \| 13 \| 100 \| 100 \|/);
  });
});

describe("no target is agreed (spec E2, AC02)", () => {
  it("should have no agreed target in the register, as nobody has agreed one", () => {
    expect(AGREED_TARGETS).toEqual([]);
  });

  it("should say that nothing is agreed and give a verdict for no workflow", () => {
    const text = report();

    expect(text).toContain("No performance target is agreed (spec Q2)");
    expect(text).toContain("none agreed");
    expect(text).not.toMatch(/\b(pass|fail|within|over|meets?|at most)\b/i);
  });

  it("should list every measured workflow with its figures", () => {
    const text = report({ measured: WORKFLOWS.map((w) => measured([10, 20, 30], w.id)) });

    for (const workflow of WORKFLOWS) {
      expect(text).toContain(workflow.label);
    }
    expect(text.match(/none agreed/g)).toHaveLength(WORKFLOWS.length);
  });

  it("should say that p95 is the slowest run when there are fewer than 20 runs", () => {
    expect(report()).toContain("the 95th percentile is the slowest run, so p95 and Max are the same figure: Bookings list");
    expect(report({ measured: [measured(Array.from({ length: 20 }, (_, i) => i + 1))] })).not.toContain(
      "the 95th percentile is the slowest run",
    );
  });

  it("should say that a development server is not representative", () => {
    expect(report({ mode: "development" })).toContain("not representative");
    expect(report({ mode: "production" })).not.toContain("not representative");
  });
});

describe("a target is agreed (spec R6, AC01)", () => {
  it("should say within the target when the 95th percentile is at or below the limit", () => {
    expect(evaluate("list:bookings", summarize([100, 500]), [target()]).kind).toBe("within_target");
  });

  it("should say over the target when the 95th percentile is above the limit", () => {
    expect(evaluate("list:bookings", summarize([100, 501]), [target()]).kind).toBe("over_target");
  });

  it("should compare only the workflow the target is for, and only measure the others", () => {
    const text = report({
      measured: [measured([100, 200]), measured([900, 950], "list:seats")],
      targets: [target()],
    });

    expect(text).toContain("p95 at most 500 ms: within (agreed by Product owner on 2026-11-01");
    expect(text).toMatch(/Seats list[^\n]*none agreed/);
    expect(text).not.toContain("No performance target is agreed");
  });

  it("should show who agreed the target and what it holds for, so it is not a bare number", () => {
    const text = report({ targets: [target()] });

    expect(text).toContain("Product owner");
    expect(text).toContain("one user, local database, production build");
  });

  it("should not use a target for a workflow that does not exist, and say so", () => {
    const text = report({ targets: [target({ workflow: "list:nothing" })] });

    expect(text).toContain("list:nothing: there is no such workflow");
  });
});

describe("validateTargets (no target is claimed before it is agreed)", () => {
  it("should accept a target with a workflow, a limit, who agreed, when and the load", () => {
    expect(validateTargets([target()]).valid).toEqual([target()]);
  });

  it.each([
    ["no one agreed it", { agreed_by: "  " }, "agreed_by"],
    ["the date is not a date", { agreed_on: "next week" }, "agreed_on"],
    ["the limit is zero", { limit_ms: 0 }, "limit_ms"],
    ["the limit is negative", { limit_ms: -5 }, "limit_ms"],
    ["no load is said", { load: "" }, "load"],
    ["the workflow is empty", { workflow: " " }, "workflow"],
  ])("should reject a target when %s, so its workflow stays measured only", (_name, over, field) => {
    const { valid, rejected } = validateTargets([target(over as Partial<AgreedTarget>)]);

    expect(valid).toEqual([]);
    expect(rejected[0].issues.join(" ")).toContain(field);
  });

  it("should reject a target that is not an object at all", () => {
    expect(validateTargets(["500ms"]).rejected).toHaveLength(1);
  });

  it("should say in the report that a rejected target is not a target, and compare nothing with it", () => {
    const { valid, rejected } = validateTargets([target({ agreed_by: "" })]);
    const text = report({ targets: valid, rejected });

    expect(text).toContain("is not complete, so it is not a target");
    expect(text).toContain("No performance target is agreed");
    expect(text).not.toMatch(/\bwithin\b/);
  });
});
