import { describe, expect, it } from "vitest";

import {
  NOTES_MAX_LENGTH,
  completeCleaningSchema,
  startCleaningSchema,
} from "@/features/cleaning/schemas/cleaning.schema";

const JOB_ID = "f0000000-0000-0000-0000-000000000002";

describe("startCleaningSchema", () => {
  it("should accept a job id", () => {
    expect(startCleaningSchema.safeParse({ job_id: JOB_ID }).success).toBe(true);
  });

  it.each([[""], ["   "], ["not-a-uuid"]])(
    "should reject the job id %j",
    (job_id) => {
      expect(startCleaningSchema.safeParse({ job_id }).success).toBe(false);
    },
  );
});

describe("completeCleaningSchema", () => {
  it.each([["passed"], ["failed"]])(
    "should accept the result %s with optional notes",
    (result) => {
      expect(
        completeCleaningSchema.safeParse({ job_id: JOB_ID, result }).success,
      ).toBe(true);
    },
  );

  it("should reject a missing result with a clear message", () => {
    const parsed = completeCleaningSchema.safeParse({ job_id: JOB_ID });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe("Choose the result.");
  });

  it("should reject a result that is not passed or failed", () => {
    expect(
      completeCleaningSchema.safeParse({ job_id: JOB_ID, result: "maybe" })
        .success,
    ).toBe(false);
  });

  it("should trim the notes", () => {
    const parsed = completeCleaningSchema.parse({
      job_id: JOB_ID,
      result: "passed",
      notes: "  Wiped  ",
    });

    expect(parsed.notes).toBe("Wiped");
  });

  it("should accept notes of the maximum length and reject one more", () => {
    const ok = completeCleaningSchema.safeParse({
      job_id: JOB_ID,
      result: "passed",
      notes: "x".repeat(NOTES_MAX_LENGTH),
    });
    const tooLong = completeCleaningSchema.safeParse({
      job_id: JOB_ID,
      result: "passed",
      notes: "x".repeat(NOTES_MAX_LENGTH + 1),
    });

    expect(ok.success).toBe(true);
    expect(tooLong.success).toBe(false);
  });
});
