/** Mirrors the `technician_job_type` enum. */
export const JOB_TYPES = ["installation", "cleaning", "inspection"] as const;

export type JobType = (typeof JOB_TYPES)[number];

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  installation: "Installation",
  cleaning: "Cleaning",
  inspection: "Inspection",
};
