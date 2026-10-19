import { z } from "zod";

import { Constants, type Database } from "@/types/database.types";

// z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
const idField = (message: string) =>
  z.string().trim().min(1, message).pipe(z.guid(message));

export const NOTES_MAX_LENGTH = 1000;

export type InspectionResult = Database["public"]["Enums"]["inspection_result"];

/**
 * The `inspection_result` Postgres enum is the single source of truth; the
 * values come from the generated types so they cannot drift from the database.
 */
export const INSPECTION_RESULTS = [
  ...Constants.public.Enums.inspection_result,
] as [InspectionResult, ...InspectionResult[]];

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
