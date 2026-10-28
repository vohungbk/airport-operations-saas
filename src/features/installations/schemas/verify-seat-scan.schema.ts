import { z } from "zod";

export const SCAN_CODE_MAX_LENGTH = 200;

// z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
export const verifySeatScanSchema = z.object({
  job_id: z.string().trim().min(1, "Job not found.").pipe(z.guid("Job not found.")),
  code: z
    .string()
    .trim()
    .min(1, "Scan the seat or type its code.")
    .max(SCAN_CODE_MAX_LENGTH, "This code is too long."),
});

export type VerifySeatScanInput = z.infer<typeof verifySeatScanSchema>;
