import { z } from "zod";

import {
  JOB_STATUSES,
  JOB_TARGET_STATUSES,
  isJobReasonRequired,
} from "@/features/jobs/lib/job-status";

const REASON_MAX = 500;

/**
 * `from_status` is the status the user was looking at; the database rejects
 * the change when the job has moved on since (stale data).
 */
export const changeJobStatusSchema = z
  .object({
    job_id: z.guid("Job not found."),
    from_status: z.enum(JOB_STATUSES),
    to_status: z.enum(JOB_TARGET_STATUSES, { error: "Select a new status." }),
    reason: z
      .string()
      .trim()
      .max(REASON_MAX, `Reason must be at most ${REASON_MAX} characters.`)
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (isJobReasonRequired(value.to_status) && !value.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Enter a reason.",
      });
    }
  });

export type ChangeJobStatusInput = z.infer<typeof changeJobStatusSchema>;
