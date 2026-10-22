import { describe, expect, it } from "vitest";

import { DECISIONS, checkDecisions } from "@/lib/release/unresolved-decisions";

/**
 * VI-F08-S08 (spec R8): the unresolved decisions are written down, with their source,
 * so the people who decide can see them. A decision is closed only with who decided,
 * when and what.
 */
const open = (over: Record<string, unknown> = {}) => ({
  id: "X-1",
  source: "A spec, section 12",
  question: "Which one?",
  effect: "Nothing is claimed.",
  status: "open",
  ...over,
});

const decided = (over: Record<string, unknown> = {}) =>
  open({ status: "decided", decision: "The first one.", decided_by: "Product owner", decided_on: "2026-11-01", ...over });

describe("the register of unresolved decisions", () => {
  it("should hold only entries that are valid", () => {
    const { rejected, decisions } = checkDecisions(DECISIONS);

    expect(rejected).toEqual([]);
    expect(decisions).toHaveLength(DECISIONS.length);
  });

  it("should have a unique id, a source and an effect for every entry", () => {
    const ids = DECISIONS.map((d) => d.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const decision of DECISIONS) {
      expect(decision.source, decision.id).not.toBe("");
      expect(decision.effect, decision.id).not.toBe("");
    }
  });

  it.each(["VI-F08-Q1", "VI-F08-Q2", "VI-F08-Q3", "VI-F08-Q4", "VI-F07-Q1", "VI-F07-Q2", "VI-F07-Q3"])(
    "should list the open question %s of the specs",
    (id) => {
      expect(DECISIONS.find((d) => d.id === id)?.status).toBe("open");
    },
  );
});

describe("checkDecisions (spec R8)", () => {
  it("should accept an open decision", () => {
    expect(checkDecisions([open()]).decisions).toHaveLength(1);
  });

  it("should accept a decision that says what, who and when", () => {
    expect(checkDecisions([decided()]).decisions[0]).toMatchObject({ status: "decided", decided_by: "Product owner" });
  });

  it.each([
    ["no one decided it", { decided_by: " " }, "decided_by"],
    ["the date is not a date", { decided_on: "soon" }, "decided_on"],
    ["no decision is written", { decision: "" }, "decision"],
  ])("should not close a decision when %s: it is reported and not counted", (_name, over, field) => {
    const { decisions, rejected } = checkDecisions([decided(over)]);

    expect(decisions).toEqual([]);
    expect(rejected[0].id).toBe("X-1");
    expect(rejected[0].issues.join(" ")).toContain(field);
  });

  it("should reject an entry with no question or no source", () => {
    expect(checkDecisions([open({ question: "" }), open({ id: "X-2", source: "" })]).rejected).toHaveLength(2);
  });

  it("should reject an entry that is not an object, without failing", () => {
    expect(checkDecisions([null, "x"]).rejected.map((r) => r.id)).toEqual(["entry 1", "entry 2"]);
  });
});
