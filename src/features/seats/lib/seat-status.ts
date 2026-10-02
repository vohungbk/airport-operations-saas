import type { SeatStatus } from "@/features/seats/types";

export const SEAT_STATUSES = [
  "available",
  "reserved",
  "in_use",
  "cleaning",
  "inspection",
  "quarantine",
  "retired",
] as const satisfies readonly SeatStatus[];

export const SEAT_STATUS_LABEL: Record<SeatStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  in_use: "In use",
  cleaning: "Cleaning",
  inspection: "Inspection",
  quarantine: "Quarantine",
  retired: "Retired",
};

export const MANUAL_TARGET_STATUSES = [
  "available",
  "quarantine",
  "retired",
] as const satisfies readonly SeatStatus[];

export type ManualTargetStatus = (typeof MANUAL_TARGET_STATUSES)[number];

/**
 * Minimal manual (admin/ops) transition table. The operational statuses
 * (`reserved`, `in_use`, `cleaning`, `inspection`) are owned by future
 * workflows, so they have no manual transitions and are never a manual
 * target. Must stay in sync with `public.change_seat_status()`, which is
 * the enforcing authority.
 */
export const MANUAL_STATUS_TRANSITIONS: Record<
  SeatStatus,
  ManualTargetStatus[]
> = {
  available: ["quarantine", "retired"],
  reserved: [],
  in_use: [],
  cleaning: [],
  inspection: [],
  quarantine: ["available", "retired"],
  retired: [],
};

export function getAllowedManualTransitions(
  status: SeatStatus,
): ManualTargetStatus[] {
  return MANUAL_STATUS_TRANSITIONS[status];
}
