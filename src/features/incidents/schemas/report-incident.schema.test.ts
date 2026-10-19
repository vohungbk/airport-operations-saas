import { describe, expect, it } from "vitest";

import {
  INCIDENT_DESCRIPTION_MAX_LENGTH,
  reportIncidentSchema,
} from "@/features/incidents/schemas/report-incident.schema";

const JOB_ID = "f0000000-0000-0000-0000-000000000002";
const valid = {
  job_id: JOB_ID,
  severity: "high" as const,
  description: "The harness strap is torn.",
};

describe("reportIncidentSchema", () => {
  it.each([["low"], ["medium"], ["high"], ["critical"]])(
    "should accept the severity %s",
    (severity) => {
      expect(
        reportIncidentSchema.safeParse({ ...valid, severity }).success,
      ).toBe(true);
    },
  );

  it("should reject a missing severity with a clear message", () => {
    const parsed = reportIncidentSchema.safeParse({
      job_id: JOB_ID,
      description: valid.description,
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe("Choose the severity.");
  });

  it.each([[""], ["urgent"], ["HIGH"], [" high"], [null], [3]])(
    "should reject the severity %j, which is outside the enum",
    (severity) => {
      const parsed = reportIncidentSchema.safeParse({ ...valid, severity });

      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0].message).toBe("Choose the severity.");
    },
  );

  it("should leave the status and the other columns the client sends out of the parsed input", () => {
    const parsed = reportIncidentSchema.parse({
      ...valid,
      status: "resolved",
      partner_id: "forged",
      reported_by: "forged",
    });

    expect(parsed).toEqual({
      job_id: JOB_ID,
      severity: "high",
      description: "The harness strap is torn.",
    });
  });

  it.each([[""], ["   "], ["\n\t"]])(
    "should reject the empty description %j with a clear message",
    (description) => {
      const parsed = reportIncidentSchema.safeParse({ ...valid, description });

      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0].message).toBe("Describe what happened.");
    },
  );

  it("should trim the description", () => {
    expect(
      reportIncidentSchema.parse({ ...valid, description: "  Torn  " })
        .description,
    ).toBe("Torn");
  });

  it("should accept a description of the maximum length and reject one more", () => {
    const ok = reportIncidentSchema.safeParse({
      ...valid,
      description: "x".repeat(INCIDENT_DESCRIPTION_MAX_LENGTH),
    });
    const tooLong = reportIncidentSchema.safeParse({
      ...valid,
      description: "x".repeat(INCIDENT_DESCRIPTION_MAX_LENGTH + 1),
    });

    expect(ok.success).toBe(true);
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0].message).toBe(
      `Description must be at most ${INCIDENT_DESCRIPTION_MAX_LENGTH} characters.`,
    );
  });

  it.each([[""], ["   "], ["not-a-uuid"]])(
    "should reject the job %j with a clear message",
    (job_id) => {
      const parsed = reportIncidentSchema.safeParse({ ...valid, job_id });

      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0].message).toBe("Choose the related job.");
    },
  );
});
