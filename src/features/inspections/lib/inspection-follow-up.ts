/**
 * What happened to the seat when a failed inspection was recorded. Set by
 * `public.guard_inspection_insert()`; `null` when nothing happened (a passing
 * result, or a seat that was already in quarantine).
 */
export const INSPECTION_FOLLOW_UPS = [
  "seat_quarantined",
  "seat_quarantined_active_booking",
] as const;

export type InspectionFollowUp = (typeof INSPECTION_FOLLOW_UPS)[number];

export function toInspectionFollowUp(
  value: string | null,
): InspectionFollowUp | null {
  return INSPECTION_FOLLOW_UPS.find((known) => known === value) ?? null;
}

/** Messages for the person who recorded the inspection. */
export function inspectionFollowUpMessages(
  followUp: InspectionFollowUp | null,
): string[] {
  switch (followUp) {
    case "seat_quarantined":
      return ["The seat was moved to quarantine."];
    case "seat_quarantined_active_booking":
      return [
        "The seat was moved to quarantine.",
        "This seat is in an active booking. Review the booking.",
      ];
    default:
      return [];
  }
}
