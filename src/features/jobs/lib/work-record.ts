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
    available: true,
  },
  cleaning: {
    permission: "cleaning:create",
    segment: "cleaning",
    available: true,
  },
  inspection: {
    permission: "inspections:create",
    segment: "inspection",
    available: true,
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
 * not active, it is assigned to someone else (a cleaning or inspection job is open to Admin
 * and Operations Manager), or the user lacks the permission. Only a visibility rule — the workflow screen must guard
 * itself.
 */
export function getWorkRecordHref(
  job: WorkRecordJob,
  user: WorkRecordUser,
  workflows: WorkRecordWorkflows = WORK_RECORD_WORKFLOWS,
): string | null {
  // A job type the registry does not know yet simply gets no link.
  const workflow: WorkRecordWorkflow | undefined = workflows[job.job_type];

  if (!workflow?.available || !RECORDABLE_STATUSES.includes(job.status)) {
    return null;
  }

  // Admin and Operations Manager open the panel of any cleaning job (UI-F06-T08) and inspection job
  // (UI-F06-T09); every other work is only for the assigned technician.
  const managesWork =
    (job.job_type === "cleaning" || job.job_type === "inspection") &&
    hasPermission(user.role, "technicians:manage");

  if (
    !managesWork &&
    (job.technician?.id !== user.id || !hasPermission(user.role, workflow.permission))
  ) {
    return null;
  }

  return `/jobs/${job.id}/${workflow.segment}`;
}
