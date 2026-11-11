import { describe, expect, it } from "vitest";

import { buildJobSteps } from "@/features/jobs/lib/job-steps";

describe("buildJobSteps", () => {
  it("should name the steps after the job type", () => {
    expect(buildJobSteps("assigned", "cleaning").map((step) => step.label)).toEqual([
      "Assigned",
      "Start cleaning",
      "Complete cleaning",
    ]);
    expect(buildJobSteps("assigned", "installation")[1].label).toBe("Start installation");
  });

  it("should make Start the current step of an assigned job", () => {
    expect(buildJobSteps("assigned", "cleaning").map((step) => step.state)).toEqual([
      "completed",
      "current",
      "locked",
    ]);
  });

  it("should make Complete the current step once the job is in progress", () => {
    expect(buildJobSteps("in_progress", "inspection").map((step) => step.state)).toEqual([
      "completed",
      "completed",
      "current",
    ]);
  });

  it("should complete every step of a completed job", () => {
    expect(buildJobSteps("completed", "cleaning").every((step) => step.state === "completed")).toBe(true);
  });

  it("should lock the steps after Assigned when the job is cancelled", () => {
    expect(buildJobSteps("cancelled", "cleaning").map((step) => step.state)).toEqual([
      "completed",
      "locked",
      "locked",
    ]);
  });
});
