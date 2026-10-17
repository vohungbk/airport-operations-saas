import { describe, expect, it } from "vitest";

import {
  NOTES_MAX_LENGTH,
  buildRecordCleaningSchema,
  toCleanedAtIso,
} from "@/features/cleaning/schemas/record-cleaning.schema";

const TIME_ZONE = "Asia/Dubai"; // UTC+4, no DST
// 2026-10-16 12:00 UTC is 16:00 in Dubai.
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0);

const VALID = {
  job_id: "f0000000-0000-0000-0000-000000000002",
  seat_id: "e0000000-0000-0000-0000-000000000002",
  cleaned_at: "2026-10-16T15:30",
  notes: "Fitted in the rear left seat",
};

const schema = buildRecordCleaningSchema(TIME_ZONE, () => NOW);

function firstIssue(input: unknown) {
  const result = schema.safeParse(input);
  return result.success ? undefined : result.error.issues[0];
}

describe("buildRecordCleaningSchema", () => {
  it("should accept a valid cleaning", () => {
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

  it("should return error when the cleaning time is empty", () => {
    const issue = firstIssue({ ...VALID, cleaned_at: "" });

    expect(issue?.path).toEqual(["cleaned_at"]);
    expect(issue?.message).toBe("Enter a valid cleaning time.");
  });

  it("should return error when the cleaning time is not a real date", () => {
    expect(firstIssue({ ...VALID, cleaned_at: "2026-02-30T10:00" })?.message)
      .toBe("Enter a valid cleaning time.");
  });

  it("should return error when the cleaning time is in the future", () => {
    expect(firstIssue({ ...VALID, cleaned_at: "2026-10-16T16:30" })?.message)
      .toBe("Cleaning time cannot be in the future.");
  });

  it("should accept a time within the clock skew tolerance", () => {
    expect(
      schema.safeParse({ ...VALID, cleaned_at: "2026-10-16T16:04" }).success,
    ).toBe(true);
  });

  it("should return error when the notes are too long", () => {
    expect(
      firstIssue({ ...VALID, notes: "a".repeat(NOTES_MAX_LENGTH + 1) })?.path,
    ).toEqual(["notes"]);
  });
});

describe("toCleanedAtIso", () => {
  it("should read the time as wall-clock time at the airport", () => {
    expect(toCleanedAtIso("2026-10-16T15:30", TIME_ZONE)).toBe(
      "2026-10-16T11:30:00.000Z",
    );
  });

  it("should return null for a malformed time", () => {
    expect(toCleanedAtIso("tomorrow", TIME_ZONE)).toBeNull();
  });
});
