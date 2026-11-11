import type { RecordInspectionInput } from "@/features/inspections/schemas/record-inspection.schema";

/** Whether the form holds something the user typed or chose and has not saved. */
export function hasUnsavedInspection(
  values: Partial<Pick<RecordInspectionInput, "result" | "notes">>,
): boolean {
  return !!values.result || !!values.notes?.trim();
}
