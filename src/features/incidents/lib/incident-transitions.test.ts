import { describe, expect, it } from "vitest";

import {
  INCIDENT_STATUSES,
  getAllowedIncidentTransitions,
  isIncidentNoteRequired,
} from "@/features/incidents/lib/incident-status";

describe("getAllowedIncidentTransitions", () => {
  it.each([
    ["open", ["investigating", "resolved"]],
    ["investigating", ["resolved"]],
    ["resolved", ["closed", "investigating"]],
    ["closed", []],
  ] as const)("should allow %s to go to %j", (status, targets) => {
    expect(getAllowedIncidentTransitions(status)).toEqual(targets);
  });

  it("should never offer the status the incident already has", () => {
    for (const status of INCIDENT_STATUSES) {
      expect(getAllowedIncidentTransitions(status)).not.toContain(status);
    }
  });

  it("should treat closed as the end of the road", () => {
    expect(getAllowedIncidentTransitions("closed")).toEqual([]);
  });
});

describe("isIncidentNoteRequired", () => {
  it("should require a note only to reopen a resolved incident", () => {
    expect(isIncidentNoteRequired("resolved", "investigating")).toBe(true);
  });

  it.each([
    ["open", "investigating"],
    ["open", "resolved"],
    ["investigating", "resolved"],
    ["resolved", "closed"],
  ] as const)("should not require a note to go from %s to %s", (from, to) => {
    expect(isIncidentNoteRequired(from, to)).toBe(false);
  });
});
