import { describe, expect, it } from "vitest";

import { changeJobStatusSchema } from "@/features/jobs/schemas/change-job-status.schema";

const VALID = {
  job_id: "f0000000-0000-0000-0000-000000000002",
  from_status: "assigned",
  to_status: "in_progress",
};

function firstIssue(input: unknown) {
  const result = changeJobStatusSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0];
}

describe("changeJobStatusSchema", () => {
  it("should accept a start transition without a reason", () => {
    expect(changeJobStatusSchema.safeParse(VALID).success).toBe(true);
  });

  it("should return error when cancelling without a reason", () => {
    const issue = firstIssue({ ...VALID, to_status: "cancelled" });

    expect(issue?.path).toEqual(["reason"]);
    expect(issue?.message).toBe("Enter a reason.");
  });

  it("should return error when the reason is only whitespace for a cancel", () => {
    expect(
      firstIssue({ ...VALID, to_status: "cancelled", reason: "   " })?.path,
    ).toEqual(["reason"]);
  });

  it("should accept a cancel with a reason", () => {
    expect(
      changeJobStatusSchema.safeParse({
        ...VALID,
        to_status: "cancelled",
        reason: "Customer cancelled",
      }).success,
    ).toBe(true);
  });

  it("should return error when the target is assigned", () => {
    expect(firstIssue({ ...VALID, to_status: "assigned" })?.message).toBe(
      "Select a new status.",
    );
  });

  it("should return error when the job id is not a uuid", () => {
    expect(firstIssue({ ...VALID, job_id: "nope" })?.message).toBe(
      "Job not found.",
    );
  });

  it("should return error when the reason is too long", () => {
    expect(
      firstIssue({ ...VALID, to_status: "cancelled", reason: "a".repeat(501) })
        ?.path,
    ).toEqual(["reason"]);
  });
});
