import { createJobSchema } from "@/features/jobs/schemas/create-job.schema";
import { jobIdSchema } from "@/features/jobs/schemas/jobs-query.schema";

/**
 * An edit can only change the job type and the technician. The booking is
 * fixed when the job is created, and the status has its own action, so
 * neither is part of this input.
 */
export const updateJobSchema = createJobSchema
  .pick({ job_type: true, technician_id: true })
  .extend({ id: jobIdSchema });
