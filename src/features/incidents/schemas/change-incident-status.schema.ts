import { z } from "zod";

import {
  INCIDENT_STATUSES,
  isIncidentNoteRequired,
} from "@/features/incidents/lib/incident-status";

export const INCIDENT_NOTE_MAX_LENGTH = 500;

/**
 * `from_status` is the status the user was looking at; the database rejects
 * the change when the incident has moved on since (stale data).
 */
export const changeIncidentStatusSchema = z
  .object({
    incident_id: z.guid("Incident not found."),
    from_status: z.enum(INCIDENT_STATUSES),
    to_status: z.enum(INCIDENT_STATUSES, { error: "Select a new status." }),
    note: z
      .string()
      .trim()
      .max(
        INCIDENT_NOTE_MAX_LENGTH,
        `Note must be at most ${INCIDENT_NOTE_MAX_LENGTH} characters.`,
      )
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (isIncidentNoteRequired(value.from_status, value.to_status) && !value.note) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Enter a note saying why the incident is reopened.",
      });
    }
  });

export type ChangeIncidentStatusInput = z.infer<
  typeof changeIncidentStatusSchema
>;
