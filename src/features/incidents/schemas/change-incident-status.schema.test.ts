import { describe, expect, it } from "vitest";

import {
  INCIDENT_NOTE_MAX_LENGTH,
  changeIncidentStatusSchema,
} from "@/features/incidents/schemas/change-incident-status.schema";

const INCIDENT_ID = "c0000000-0000-0000-0000-000000000001";
const valid = {
  incident_id: INCIDENT_ID,
  from_status: "open" as const,
  to_status: "investigating" as const,
};

describe("changeIncidentStatusSchema", () => {
  it("should accept a change without a note", () => {
    expect(changeIncidentStatusSchema.safeParse(valid).success).toBe(true);
  });

  it("should trim the note", () => {
    expect(
      changeIncidentStatusSchema.parse({ ...valid, note: "  Looking  " }).note,
    ).toBe("Looking");
  });

  it("should accept a note of the maximum length and reject one more", () => {
    const ok = changeIncidentStatusSchema.safeParse({
      ...valid,
      note: "x".repeat(INCIDENT_NOTE_MAX_LENGTH),
    });
    const tooLong = changeIncidentStatusSchema.safeParse({
      ...valid,
      note: "x".repeat(INCIDENT_NOTE_MAX_LENGTH + 1),
    });

    expect(ok.success).toBe(true);
    expect(tooLong.success).toBe(false);
  });

  it.each([[""], ["   "], [undefined]])(
    "should require a note to reopen a resolved incident (note %j)",
    (note) => {
      const parsed = changeIncidentStatusSchema.safeParse({
        ...valid,
        from_status: "resolved",
        to_status: "investigating",
        note,
      });

      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0].message).toBe(
        "Enter a note saying why the incident is reopened.",
      );
    },
  );

  it("should accept a reopen that has a note", () => {
    expect(
      changeIncidentStatusSchema.safeParse({
        ...valid,
        from_status: "resolved",
        to_status: "investigating",
        note: "The seat failed again",
      }).success,
    ).toBe(true);
  });

  it.each([[""], ["done"], ["OPEN"], [null]])(
    "should reject the new status %j that is not in the enum",
    (to_status) => {
      expect(
        changeIncidentStatusSchema.safeParse({ ...valid, to_status }).success,
      ).toBe(false);
    },
  );

  it("should reject a missing new status with a clear message", () => {
    const parsed = changeIncidentStatusSchema.safeParse({
      incident_id: INCIDENT_ID,
      from_status: "open",
    });

    expect(parsed.error?.issues[0].message).toBe("Select a new status.");
  });

  it.each([[""], ["nope"]])("should reject the incident id %j", (incident_id) => {
    expect(
      changeIncidentStatusSchema.safeParse({ ...valid, incident_id }).success,
    ).toBe(false);
  });
});
