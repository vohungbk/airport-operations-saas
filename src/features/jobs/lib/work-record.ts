import { hasPermission, type Permission } from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";
import type { JobStatus } from "@/features/jobs/lib/job-status";
import type { JobType } from "@/features/jobs/lib/job-type";

interface WorkRecordWorkflow {
  /** Permission the user needs to record this kind of work. */
  permission: Permission;
  /** Route segment under `/jobs/[id]` of the workflow screen. */
  segment: string;
  /**
   * Whether the workflow screen exists. The story that ships the screen
   * (FO-F02 installation, FO-F03 cleaning, FO-F04 inspection) flips this;
   * until then the "Record work" link is not shown.
   */
  available: boolean;
}

export type WorkRecordWorkflows = Record<JobType, WorkRecordWorkflow>;

export const WORK_RECORD_WORKFLOWS: WorkRecordWorkflows = {
  installation: {
    permission: "installation:perform",
    segment: "installation",
    available: false,
  },
  cleaning: {
    permission: "cleaning:create",
    segment: "cleaning",
    available: false,
  },
  inspection: {
    permission: "inspections:create",
    segment: "inspection",
    available: false,
  },
};

/** Work is recorded on active jobs only. */
const RECORDABLE_STATUSES: readonly JobStatus[] = ["assigned", "in_progress"];

interface WorkRecordJob {
  id: string;
  job_type: JobType;
  status: JobStatus;
  technician: { id: string } | null;
}

interface WorkRecordUser {
  id: string;
  role: Role;
}

/**
 * Href of the workflow screen that matches the job, or `null` when the user
 * should not be offered one: the workflow is not available yet, the job is
 * not active, it is assigned to someone else, or the user lacks the
 * permission. Only a visibility rule — the workflow screen must guard
 * itself.
 */
export function getWorkRecordHref(
  job: WorkRecordJob,
  user: WorkRecordUser,
  workflows: WorkRecordWorkflows = WORK_RECORD_WORKFLOWS,
): string | null {
  // A job type the registry does not know yet simply gets no link.
  const workflow: WorkRecordWorkflow | undefined = workflows[job.job_type];

  if (
    !workflow?.available ||
    !RECORDABLE_STATUSES.includes(job.status) ||
    job.technician?.id !== user.id ||
    !hasPermission(user.role, workflow.permission)
  ) {
    return null;
  }

  return `/jobs/${job.id}/${workflow.segment}`;
}
