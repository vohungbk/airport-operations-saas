import { describe, expect, it } from "vitest";

import {
  SCAN_CODE_MAX_LENGTH,
  verifySeatScanSchema,
} from "@/features/installations/schemas/verify-seat-scan.schema";

const JOB_ID = "e0000000-0000-0000-0000-000000000001";

describe("verifySeatScanSchema", () => {
  it("should accept a job and a code", () => {
    expect(verifySeatScanSchema.safeParse({ job_id: JOB_ID, code: " SEAT-0001 " })).toMatchObject({
      success: true,
      data: { job_id: JOB_ID, code: "SEAT-0001" },
    });
  });

  it("should reject an empty code", () => {
    expect(verifySeatScanSchema.safeParse({ job_id: JOB_ID, code: "   " }).success).toBe(false);
  });

  it("should reject a code that is too long", () => {
    expect(verifySeatScanSchema.safeParse({ job_id: JOB_ID, code: "A".repeat(SCAN_CODE_MAX_LENGTH + 1) }).success).toBe(
      false,
    );
  });

  it("should reject a job id that is missing or malformed", () => {
    expect(verifySeatScanSchema.safeParse({ code: "SEAT-0001" }).success).toBe(false);
    expect(verifySeatScanSchema.safeParse({ job_id: "nope", code: "SEAT-0001" }).success).toBe(false);
  });
});
