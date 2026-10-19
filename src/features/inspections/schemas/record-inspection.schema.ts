import { z } from "zod";

// z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
const idField = (message: string) =>
  z.string().trim().min(1, message).pipe(z.guid(message));

export const NOTES_MAX_LENGTH = 1000;

/** Same values as the `inspection_result` enum. */
export const INSPECTION_RESULTS = ["pass", "conditional_pass", "fail"] as const;

export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export function inspectionResultLabel(result: InspectionResult): string {
  switch (result) {
    case "pass":
      return "Pass";
    case "conditional_pass":
      return "Conditional pass";
    case "fail":
      return "Fail";
  }
}

export const recordInspectionSchema = z.object({
  job_id: idField("Job not found."),
  seat_id: idField("A seat is required."),
  // No default: the technician has to choose a result.
  result: z.enum(INSPECTION_RESULTS, { error: "Choose the result." }),
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX_LENGTH, `Notes must be at most ${NOTES_MAX_LENGTH} characters.`)
    .optional(),
});

export type RecordInspectionInput = z.infer<typeof recordInspectionSchema>;
