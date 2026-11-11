import type { JobStatus } from "@/features/jobs/lib/job-status";
import { JOB_TYPE_LABEL, type JobType } from "@/features/jobs/lib/job-type";

/** The tabs of the work panel; Return is a tab of the design, not a job type. */
export const WORK_TABS = ["cleaning", "inspection", "return"] as const;

export type WorkTab = (typeof WORK_TABS)[number];

export const WORK_TAB_LABEL: Record<WorkTab, string> = {
  cleaning: "Cleaning",
  inspection: "Inspection",
  return: "Return",
};

/** The tab that belongs to the job; an installation job has none. */
export function getJobWorkTab(type: JobType): WorkTab | null {
  return type === "cleaning" || type === "inspection" ? type : null;
}

/** The sentence under the seat, from where the job stands. */
export function getWorkPanelHint(status: JobStatus, type: JobType): string {
  const name = JOB_TYPE_LABEL[type].toLowerCase();

  switch (status) {
    case "assigned":
      return `Start ${name} after confirming there is no conflicting booking.`;
    case "in_progress":
      return `Complete ${name} to finish this job.`;
    case "completed":
      return "This job is completed.";
    case "cancelled":
      return "This job was cancelled.";
  }
}

/** The label of the main button: Start while the job is assigned, Record work after. */
export function getWorkActionLabel(status: JobStatus, type: JobType): string {
  return status === "assigned" ? `Start ${JOB_TYPE_LABEL[type].toLowerCase()}` : "Record work";
}
