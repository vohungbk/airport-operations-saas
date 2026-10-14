import { describe, expect, it } from "vitest";

import { JOB_STATUSES, JOB_STATUS_LABEL } from "@/features/jobs/lib/job-status";

describe("JOB_STATUS_LABEL", () => {
  it("should have a label for every status", () => {
    for (const status of JOB_STATUSES) {
      expect(JOB_STATUS_LABEL[status]).toBeTruthy();
    }
  });
});
