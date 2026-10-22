import { describe, expect, it } from "vitest";

import { ACCEPTED_RISKS, type AcceptedRisk } from "@/lib/security/accepted-risks";
import {
  applyAcceptedRisks,
  collectCoverageInput,
  findCoverageGaps,
  type CoverageInput,
  type Gap,
} from "@/lib/security/coverage";

/**
 * VI-F08-S02 (spec R2, E1): permissions and tenant isolation have automated
 * tests, and a rule with no test blocks the release until it is covered or the
 * risk is accepted in `accepted-risks.ts`. This runs with `npm test`, so it is
 * part of the tests gate of `npm run release:gates`. It needs no database; the
 * isolation itself is proven by src/lib/auth/rls.integration.test.ts.
 */
describe("the repo's security coverage (VI-F08-S02)", () => {
  const input = collectCoverageInput();
  const { blocked, problems } = applyAcceptedRisks(findCoverageGaps(input), ACCEPTED_RISKS);

  it("should find the tables, the guards and the permissions it is meant to check", () => {
    expect(input.tables.length).toBeGreaterThanOrEqual(18);
    expect(input.guarded.length).toBeGreaterThan(30);
    expect(input.permissions.length).toBeGreaterThanOrEqual(20);
    expect(input.rlsSuiteText.length).toBeGreaterThan(10_000);
  });

  it("should have no rule without an automated test, unless the risk is accepted", () => {
    expect(blocked.map((gap) => gap.message)).toEqual([]);
  });

  it("should list only accepted risks that are complete and still needed", () => {
    expect(problems).toEqual([]);
  });
});

const base = (): CoverageInput => ({
  tables: ["bookings"],
  rlsTables: ["bookings"],
  rlsSuiteText: "describe('bookings', () => {})",
  guarded: [
    {
      file: "src/features/x/actions/do.action.ts",
      guards: ["requirePermission"],
      testText: 'it("should redirect when the caller lacks permission", () => { requirePermission })',
    },
  ],
  permissions: ["x:manage"],
  permissionsUsedInCode: ["x:manage"],
  matrixTestText: '"x:manage"',
  otherTestsText: '"x:manage"',
});

const risk = (item: string, over: Partial<AcceptedRisk> = {}): AcceptedRisk => ({
  item,
  reason: "Read-only screen, covered by the RLS suite",
  accepted_by: "Product owner",
  accepted_on: "2026-10-22",
  ...over,
});

describe("findCoverageGaps (spec E1)", () => {
  it("should find no gap when every rule has its test", () => {
    expect(findCoverageGaps(base())).toEqual([]);
  });

  it("should block a guarded file that has no test next to it", () => {
    const input = base();
    input.guarded[0].testText = null;

    expect(findCoverageGaps(input).map((g) => g.id)).toEqual([
      "guard:src/features/x/actions/do.action.ts",
    ]);
  });

  it("should block a guarded file whose test has a refusal case but does not name its guard", () => {
    const input = base();
    input.guarded[0].testText = 'it("should redirect when the caller lacks permission", () => {})';

    expect(findCoverageGaps(input)[0].message).toContain("does not name requirePermission");
  });

  it("should block a guarded file whose test names the guard but has no case about a refusal", () => {
    const input = base();
    input.guarded[0].testText = 'it("should save the record", () => { requirePermission })';

    expect(findCoverageGaps(input)[0].message).toContain("no case about a refusal");
  });

  it("should block a table without row level security, and a table no RLS test names", () => {
    const input = base();
    input.tables.push("flights");

    expect(findCoverageGaps(input).map((g) => g.id)).toEqual([
      "table:flights:rls",
      "table:flights:suite",
    ]);
  });

  it("should block a permission that is missing from the matrix, and one that guards code but no test names", () => {
    const input = base();
    input.permissions.push("y:view", "z:view");
    input.permissionsUsedInCode.push("z:view");
    input.matrixTestText += ' "z:view"';

    expect(findCoverageGaps(input).map((g) => g.id)).toEqual([
      "permission:y:view",
      "permission:z:view",
    ]);
  });
});

describe("applyAcceptedRisks (spec E1)", () => {
  const gap: Gap = { id: "guard:a.ts", message: "a.ts: no test next to it" };

  it("should block a gap nobody accepted", () => {
    expect(applyAcceptedRisks([gap], []).blocked).toEqual([gap]);
  });

  it("should let a gap through when the risk is accepted with who, when and why", () => {
    expect(applyAcceptedRisks([gap], [risk("guard:a.ts")])).toEqual({ blocked: [], problems: [] });
  });

  it("should report a stale entry whose gap is gone", () => {
    const { problems } = applyAcceptedRisks([], [risk("guard:gone.ts")]);

    expect(problems).toEqual(["guard:gone.ts: stale, there is no such gap any more: remove it"]);
  });

  it.each([["reason"], ["accepted_by"], ["accepted_on"]] as const)(
    "should not let a gap through when the accepted risk has no %s",
    (field) => {
      const { blocked, problems } = applyAcceptedRisks([gap], [risk("guard:a.ts", { [field]: " " })]);

      expect(blocked).toEqual([gap]);
      expect(problems[0]).toContain(`missing ${field}`);
    },
  );

  it("should report a date that is not YYYY-MM-DD", () => {
    const { problems } = applyAcceptedRisks([gap], [risk("guard:a.ts", { accepted_on: "22/10/2026" })]);

    expect(problems).toEqual(["guard:a.ts: accepted_on must be YYYY-MM-DD"]);
  });
});
