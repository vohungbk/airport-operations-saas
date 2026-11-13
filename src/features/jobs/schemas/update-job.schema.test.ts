import { describe, expect, it } from "vitest";

import { updateJobSchema } from "@/features/jobs/schemas/update-job.schema";

const VALID = {
  id: "a0000000-0000-0000-0000-000000000009",
  job_type: "cleaning",
  technician_id: "d0000000-0000-0000-0000-000000000001",
};

describe("updateJobSchema", () => {
  it("should accept a valid change", () => {
    expect(updateJobSchema.safeParse(VALID).success).toBe(true);
  });

  it("should drop a booking sent with the change", () => {
    const parsed = updateJobSchema.parse({
      ...VALID,
      booking_id: "f0000000-0000-0000-0000-000000000002",
      status: "completed",
    });

    expect(parsed).toEqual(VALID);
  });

  it.each([
    ["id", { ...VALID, id: "not-an-id" }],
    ["job_type", { ...VALID, job_type: "repair" }],
    ["technician_id", { ...VALID, technician_id: "" }],
  ])("should return error when %s is invalid", (_field, input) => {
    expect(updateJobSchema.safeParse(input).success).toBe(false);
  });
});
