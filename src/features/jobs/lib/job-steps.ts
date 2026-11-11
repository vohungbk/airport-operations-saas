import type { JobStatus } from "@/features/jobs/lib/job-status";
import { JOB_TYPE_LABEL, type JobType } from "@/features/jobs/lib/job-type";

export type JobStepState = "completed" | "current" | "locked";

export interface JobStep {
  label: string;
  state: JobStepState;
}

/**
 * The three steps of a job and where it stands, from its status. A cancelled job keeps its first step done
 * and locks the rest. Pure.
 */
export function buildJobSteps(status: JobStatus, type: JobType): JobStep[] {
  const name = JOB_TYPE_LABEL[type].toLowerCase();
  const states: Record<JobStatus, JobStepState[]> = {
    assigned: ["completed", "current", "locked"],
    in_progress: ["completed", "completed", "current"],
    completed: ["completed", "completed", "completed"],
    cancelled: ["completed", "locked", "locked"],
  };
  const labels = ["Assigned", `Start ${name}`, `Complete ${name}`];

  return labels.map((label, index) => ({ label, state: states[status][index] }));
}

export const JOB_STEP_STATE_LABEL: Record<JobStepState, string> = {
  completed: "Completed",
  current: "Current step",
  locked: "Locked",
};
