import { describe, expect, it } from "vitest";

import {
  getJobWorkTab,
  getNoTaskMessage,
  getWorkActionLabel,
  getWorkPanelHint,
  WORK_TABS,
} from "@/features/jobs/lib/job-work-panel";

describe("job work panel", () => {
  it("should offer the tabs Cleaning, Inspection and Return in that order", () => {
    expect([...WORK_TABS]).toEqual(["cleaning", "inspection", "return"]);
  });

  it("should open the tab of the job, and none for an installation job", () => {
    expect(getJobWorkTab("cleaning")).toBe("cleaning");
    expect(getJobWorkTab("inspection")).toBe("inspection");
    expect(getJobWorkTab("installation")).toBeNull();
  });

  it("should tell the person what to do from where the job stands", () => {
    expect(getWorkPanelHint("assigned", "cleaning")).toBe(
      "Start cleaning after confirming there is no conflicting booking.",
    );
    expect(getWorkPanelHint("in_progress", "inspection")).toBe("Record the inspection result for this seat.");
    expect(getWorkPanelHint("assigned", "inspection")).toBe("Record the inspection result for this seat.");
    expect(getWorkPanelHint("completed", "cleaning")).toBe("This job is completed.");
    expect(getWorkPanelHint("cancelled", "cleaning")).toBe("This job was cancelled.");
  });

  it("should name the button Start while assigned and Record work after", () => {
    expect(getWorkActionLabel("assigned", "cleaning")).toBe("Start cleaning");
    expect(getWorkActionLabel("in_progress", "cleaning")).toBe("Record work");
  });

  it("should name the inspection button Record inspection whether assigned or in progress", () => {
    expect(getWorkActionLabel("assigned", "inspection")).toBe("Record inspection");
    expect(getWorkActionLabel("in_progress", "inspection")).toBe("Record inspection");
  });

  it("should word the tab of a work the job does not have", () => {
    expect(getNoTaskMessage("inspection")).toBe("This job has no inspection task");
  });
});
