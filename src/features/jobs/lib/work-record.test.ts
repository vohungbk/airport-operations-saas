import { describe, expect, it } from "vitest";

import {
  WORK_RECORD_WORKFLOWS,
  getWorkRecordHref,
  type WorkRecordWorkflows,
} from "@/features/jobs/lib/work-record";

const TECHNICIAN = { id: "t-1", role: "technician" as const };

const ALL_AVAILABLE: WorkRecordWorkflows = {
  installation: { ...WORK_RECORD_WORKFLOWS.installation, available: true },
  cleaning: { ...WORK_RECORD_WORKFLOWS.cleaning, available: true },
  inspection: { ...WORK_RECORD_WORKFLOWS.inspection, available: true },
};

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: "j-1",
    job_type: "installation" as const,
    status: "in_progress" as const,
    technician: { id: "t-1" },
    ...overrides,
  };
}

describe("getWorkRecordHref", () => {
  it("should return the installation screen for the assigned technician when available", () => {
    expect(getWorkRecordHref(job(), TECHNICIAN, ALL_AVAILABLE)).toBe(
      "/jobs/j-1/installation",
    );
  });

  it("should match the screen to the job type", () => {
    expect(
      getWorkRecordHref(job({ job_type: "cleaning" }), TECHNICIAN, ALL_AVAILABLE),
    ).toBe("/jobs/j-1/cleaning");
    expect(
      getWorkRecordHref(
        job({ job_type: "inspection" }),
        TECHNICIAN,
        ALL_AVAILABLE,
      ),
    ).toBe("/jobs/j-1/inspection");
  });

  it("should offer the link on an assigned job as well as one in progress", () => {
    expect(
      getWorkRecordHref(job({ status: "assigned" }), TECHNICIAN, ALL_AVAILABLE),
    ).toBe("/jobs/j-1/installation");
  });

  it("should return null while no workflow screen is available", () => {
    for (const jobType of ["installation", "cleaning", "inspection"] as const) {
      expect(
        getWorkRecordHref(job({ job_type: jobType }), TECHNICIAN),
      ).toBeNull();
    }
  });

  it("should return null when the workflow of this job type is not available", () => {
    const onlyCleaning: WorkRecordWorkflows = {
      ...WORK_RECORD_WORKFLOWS,
      cleaning: { ...WORK_RECORD_WORKFLOWS.cleaning, available: true },
    };

    expect(getWorkRecordHref(job(), TECHNICIAN, onlyCleaning)).toBeNull();
  });

  it("should return null when the job is assigned to another technician", () => {
    expect(
      getWorkRecordHref(
        job({ technician: { id: "t-2" } }),
        TECHNICIAN,
        ALL_AVAILABLE,
      ),
    ).toBeNull();
  });

  it("should return null for an admin or manager who is not the assignee", () => {
    for (const role of ["admin", "operations_manager"] as const) {
      expect(
        getWorkRecordHref(job(), { id: "u-9", role }, ALL_AVAILABLE),
      ).toBeNull();
    }
  });

  it("should return null when the job has no technician", () => {
    expect(
      getWorkRecordHref(job({ technician: null }), TECHNICIAN, ALL_AVAILABLE),
    ).toBeNull();
  });

  it.each(["completed", "cancelled"])(
    "should return null when the job is %s",
    (status) => {
      expect(
        getWorkRecordHref(job({ status }), TECHNICIAN, ALL_AVAILABLE),
      ).toBeNull();
    },
  );

  it("should return null when the user lacks the permission for the job type", () => {
    // A partner user holds none of the work-recording permissions.
    expect(
      getWorkRecordHref(
        job(),
        { id: "t-1", role: "partner_user" },
        ALL_AVAILABLE,
      ),
    ).toBeNull();
  });

  it("should return null instead of throwing for a job type the registry does not know", () => {
    expect(
      getWorkRecordHref(
        job({ job_type: "repair" as never }),
        TECHNICIAN,
        ALL_AVAILABLE,
      ),
    ).toBeNull();
  });
});
