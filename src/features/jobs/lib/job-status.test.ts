import { describe, expect, it } from "vitest";

import {
  JOB_STATUSES,
  JOB_STATUS_LABEL,
  getAllowedJobTransitions,
  isJobReasonRequired,
} from "@/features/jobs/lib/job-status";

describe("JOB_STATUS_LABEL", () => {
  it("should have a label for every status", () => {
    for (const status of JOB_STATUSES) {
      expect(JOB_STATUS_LABEL[status]).toBeTruthy();
    }
  });
});

describe("getAllowedJobTransitions", () => {
  it("should let a technician start an assigned job but not cancel it", () => {
    expect(getAllowedJobTransitions("assigned", { canCancel: false })).toEqual([
      "in_progress",
    ]);
  });

  it("should let a technician complete a job in progress but not cancel it", () => {
    expect(
      getAllowedJobTransitions("in_progress", { canCancel: false }),
    ).toEqual(["completed"]);
  });

  it("should let a manager cancel an assigned or in-progress job", () => {
    expect(getAllowedJobTransitions("assigned", { canCancel: true })).toEqual([
      "in_progress",
      "cancelled",
    ]);
    expect(getAllowedJobTransitions("in_progress", { canCancel: true })).toEqual(
      ["completed", "cancelled"],
    );
  });

  it("should return no transitions for completed and cancelled jobs", () => {
    for (const status of ["completed", "cancelled"] as const) {
      expect(getAllowedJobTransitions(status, { canCancel: true })).toEqual([]);
    }
  });
});

describe("isJobReasonRequired", () => {
  it("should require a reason only for cancelled", () => {
    expect(isJobReasonRequired("cancelled")).toBe(true);
    expect(isJobReasonRequired("in_progress")).toBe(false);
    expect(isJobReasonRequired("completed")).toBe(false);
  });
});
