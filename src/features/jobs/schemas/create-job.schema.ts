import { z } from "zod";

import { JOB_TYPES } from "@/features/jobs/lib/job-type";

// z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
const idField = (message: string) =>
  z.string().trim().min(1, message).pipe(z.guid(message));

/**
 * One schema for the client form and the Server Action. The client can only
 * send these three fields; status and timestamps are set by the database.
 */
export const createJobSchema = z.object({
  job_type: z.enum(JOB_TYPES, { error: "Select a job type." }),
  technician_id: idField("Select a technician."),
  booking_id: idField("Select a booking."),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
