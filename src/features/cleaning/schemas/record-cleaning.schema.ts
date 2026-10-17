import { z } from "zod";

import {
  isLocalDateTime,
  zonedLocalToUtcIso,
} from "@/features/bookings/lib/booking-time";

// z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
const idField = (message: string) =>
  z.string().trim().min(1, message).pipe(z.guid(message));

export const NOTES_MAX_LENGTH = 1000;

/** Tolerated clock skew between the browser and the server. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** Fields the form carries, before the time is checked against a timezone. */
const recordCleaningFields = z.object({
  job_id: idField("Job not found."),
  seat_id: idField("A seat is required."),
  cleaned_at: z.string().trim(),
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX_LENGTH, `Notes must be at most ${NOTES_MAX_LENGTH} characters.`)
    .optional(),
});

export type RecordCleaningInput = z.infer<typeof recordCleaningFields>;

/** Just the job id: enough to look up the airport timezone. */
export const recordCleaningJobSchema = recordCleaningFields.pick({
  job_id: true,
});

/**
 * Cleaning time is wall-clock time at the airport (like bookings). The
 * timezone and the clock are inputs so the same schema runs on the client
 * form and in the Server Action.
 */
export function buildRecordCleaningSchema(
  timeZone: string,
  now: () => number = Date.now,
) {
  return recordCleaningFields.superRefine((value, ctx) => {
    const utc = isLocalDateTime(value.cleaned_at)
      ? zonedLocalToUtcIso(value.cleaned_at, timeZone)
      : null;

    if (!utc) {
      ctx.addIssue({
        code: "custom",
        path: ["cleaned_at"],
        message: "Enter a valid cleaning time.",
      });
      return;
    }

    if (new Date(utc).getTime() > now() + FUTURE_TOLERANCE_MS) {
      ctx.addIssue({
        code: "custom",
        path: ["cleaned_at"],
        message: "Cleaning time cannot be in the future.",
      });
    }
  });
}

/** UTC ISO instant of a validated local cleaning time. */
export function toCleanedAtIso(
  cleanedAt: string,
  timeZone: string,
): string | null {
  return zonedLocalToUtcIso(cleanedAt, timeZone);
}
