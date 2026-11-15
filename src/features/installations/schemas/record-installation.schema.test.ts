import { describe, expect, it } from "vitest";

import {
  NOTES_MAX_LENGTH,
  VEHICLE_LOCATION_MAX_LENGTH,
  buildRecordInstallationSchema,
  toInstalledAtIso,
} from "@/features/installations/schemas/record-installation.schema";

const TIME_ZONE = "Asia/Dubai"; // UTC+4, no DST
// 2026-10-16 12:00 UTC is 16:00 in Dubai.
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0);

const VALID = {
  job_id: "f0000000-0000-0000-0000-000000000002",
  seat_id: "e0000000-0000-0000-0000-000000000002",
  installed_at: "2026-10-16T15:30",
  notes: "Fitted in the rear left seat",
  checklist: ["category_and_fit","shell_and_harness","isofix_belt","seat_movement","harness_tension","final_safety"],
  vehicle_location: "Bay B12",
};

const schema = buildRecordInstallationSchema(TIME_ZONE, () => NOW);

function firstIssue(input: unknown) {
  const result = schema.safeParse(input);
  return result.success ? undefined : result.error.issues[0];
}

describe("buildRecordInstallationSchema", () => {
  it("should accept a valid installation", () => {
    expect(schema.safeParse(VALID).success).toBe(true);
  });

  it("should accept a record without notes", () => {
    expect(schema.safeParse({ ...VALID, notes: undefined }).success).toBe(true);
  });

  it("should return error when the seat is missing", () => {
    const issue = firstIssue({ ...VALID, seat_id: "" });

    expect(issue?.path).toEqual(["seat_id"]);
    expect(issue?.message).toBe("A seat is required.");
  });

  it("should return error when the seat id is not a uuid", () => {
    expect(firstIssue({ ...VALID, seat_id: "nope" })?.path).toEqual([
      "seat_id",
    ]);
  });

  it("should return error when the installation time is empty", () => {
    const issue = firstIssue({ ...VALID, installed_at: "" });

    expect(issue?.path).toEqual(["installed_at"]);
    expect(issue?.message).toBe("Enter a valid installation time.");
  });

  it("should return error when the installation time is not a real date", () => {
    expect(firstIssue({ ...VALID, installed_at: "2026-02-30T10:00" })?.message)
      .toBe("Enter a valid installation time.");
  });

  it("should return error when the installation time is in the future", () => {
    expect(firstIssue({ ...VALID, installed_at: "2026-10-16T16:30" })?.message)
      .toBe("Installation time cannot be in the future.");
  });

  it("should accept a time within the clock skew tolerance", () => {
    expect(
      schema.safeParse({ ...VALID, installed_at: "2026-10-16T16:04" }).success,
    ).toBe(true);
  });

  it("should return error when the notes are too long", () => {
    expect(
      firstIssue({ ...VALID, notes: "a".repeat(NOTES_MAX_LENGTH + 1) })?.path,
    ).toEqual(["notes"]);
  });
});

describe("buildRecordInstallationSchema checklist and vehicle location", () => {
  it("should return error naming the missing item when the checklist is incomplete", () => {
    const issue = firstIssue({
      ...VALID,
      checklist: VALID.checklist.slice(0, 4),
    });

    expect(issue?.path).toEqual(["checklist"]);
    expect(issue?.message).toContain("Harness height and tension verified");
    expect(issue?.message).toContain("Final safety check completed");
    expect(issue?.message).not.toContain("Seat movement checked at belt path");
  });

  it("should return error when the checklist is empty", () => {
    expect(firstIssue({ ...VALID, checklist: [] })?.path).toEqual(["checklist"]);
  });

  it("should return error when the checklist has an unknown item", () => {
    expect(firstIssue({ ...VALID, checklist: ["unknown"] })?.path).toEqual([
      "checklist",
      0,
    ]);
  });

  it.each([
    ["is empty", "", "Enter the vehicle location or bay."],
    ["is only spaces", "   ", "Enter the vehicle location or bay."],
    [
      "is too long",
      "a".repeat(VEHICLE_LOCATION_MAX_LENGTH + 1),
      `Vehicle location must be at most ${VEHICLE_LOCATION_MAX_LENGTH} characters.`,
    ],
  ])("should return error when the vehicle location %s", (_name, value, message) => {
    const issue = firstIssue({ ...VALID, vehicle_location: value });

    expect(issue?.path).toEqual(["vehicle_location"]);
    expect(issue?.message).toBe(message);
  });
});

describe("toInstalledAtIso", () => {
  it("should read the time as wall-clock time at the airport", () => {
    expect(toInstalledAtIso("2026-10-16T15:30", TIME_ZONE)).toBe(
      "2026-10-16T11:30:00.000Z",
    );
  });

  it("should return null for a malformed time", () => {
    expect(toInstalledAtIso("tomorrow", TIME_ZONE)).toBeNull();
  });
});
