import { z } from "zod";

import {
  isLocalDateTime,
  zonedLocalToUtcIso,
} from "@/features/bookings/lib/booking-time";
import {
  INSTALLATION_CHECKLIST_KEYS,
  getChecklistIncompleteMessage,
  getMissingChecklistItems,
} from "@/features/installations/lib/installation-checklist";

// z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
const idField = (message: string) =>
  z.string().trim().min(1, message).pipe(z.guid(message));

export const NOTES_MAX_LENGTH = 1000;
export const VEHICLE_LOCATION_MAX_LENGTH = 100;

/** Tolerated clock skew between the browser and the server. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** Fields the form carries, before the time is checked against a timezone. */
const recordInstallationFields = z.object({
  job_id: idField("Job not found."),
  seat_id: idField("A seat is required."),
  installed_at: z.string().trim(),
  checklist: z.array(z.enum(INSTALLATION_CHECKLIST_KEYS), {
    error: "Complete every checklist item.",
  }),
  vehicle_location: z
    .string()
    .trim()
    .min(1, "Enter the vehicle location or bay.")
    .max(
      VEHICLE_LOCATION_MAX_LENGTH,
      `Vehicle location must be at most ${VEHICLE_LOCATION_MAX_LENGTH} characters.`,
    ),
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX_LENGTH, `Notes must be at most ${NOTES_MAX_LENGTH} characters.`)
    .optional(),
});

export type RecordInstallationInput = z.infer<typeof recordInstallationFields>;

/** Just the job id: enough to look up the airport timezone. */
export const recordInstallationJobSchema = recordInstallationFields.pick({
  job_id: true,
});

/**
 * Installation time is wall-clock time at the airport (like bookings). The
 * timezone and the clock are inputs so the same schema runs on the client
 * form and in the Server Action.
 */
export function buildRecordInstallationSchema(
  timeZone: string,
  now: () => number = Date.now,
) {
  return recordInstallationFields.superRefine((value, ctx) => {
    if (getMissingChecklistItems(value.checklist).length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["checklist"],
        message: getChecklistIncompleteMessage(value.checklist),
      });
    }

    const utc = isLocalDateTime(value.installed_at)
      ? zonedLocalToUtcIso(value.installed_at, timeZone)
      : null;

    if (!utc) {
      ctx.addIssue({
        code: "custom",
        path: ["installed_at"],
        message: "Enter a valid installation time.",
      });
      return;
    }

    if (new Date(utc).getTime() > now() + FUTURE_TOLERANCE_MS) {
      ctx.addIssue({
        code: "custom",
        path: ["installed_at"],
        message: "Installation time cannot be in the future.",
      });
    }
  });
}

/** UTC ISO instant of a validated local installation time. */
export function toInstalledAtIso(
  installedAt: string,
  timeZone: string,
): string | null {
  return zonedLocalToUtcIso(installedAt, timeZone);
}
