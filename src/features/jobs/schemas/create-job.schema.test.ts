import { describe, expect, it } from "vitest";

import { createJobSchema } from "@/features/jobs/schemas/create-job.schema";

const VALID = {
  job_type: "installation",
  technician_id: "d0000000-0000-0000-0000-000000000001",
  booking_id: "f0000000-0000-0000-0000-000000000002",
};

function firstMessage(input: unknown): string | undefined {
  const result = createJobSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("createJobSchema", () => {
  it("should accept a valid job", () => {
    expect(createJobSchema.safeParse(VALID).success).toBe(true);
  });

  it("should return error when job type is empty", () => {
    expect(firstMessage({ ...VALID, job_type: "" })).toBe(
      "Select a job type.",
    );
  });

  it("should return error when job type is unknown", () => {
    expect(firstMessage({ ...VALID, job_type: "repair" })).toBe(
      "Select a job type.",
    );
  });

  it("should return error when technician is empty", () => {
    expect(firstMessage({ ...VALID, technician_id: "" })).toBe(
      "Select a technician.",
    );
  });

  it("should return error when technician id is not a uuid", () => {
    expect(firstMessage({ ...VALID, technician_id: "not-an-id" })).toBe(
      "Select a technician.",
    );
  });

  it("should return error when booking is empty", () => {
    expect(firstMessage({ ...VALID, booking_id: "  " })).toBe(
      "Select a booking.",
    );
  });

  it("should drop fields the client must not set", () => {
    const result = createJobSchema.parse({ ...VALID, status: "completed" });

    expect(result).not.toHaveProperty("status");
  });
});
