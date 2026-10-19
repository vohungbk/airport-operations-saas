import { z } from "zod";

import { INCIDENT_SEVERITIES } from "@/features/incidents/lib/incident-severity";

export const INCIDENT_DESCRIPTION_MAX_LENGTH = 1000;

const JOB_REQUIRED_MESSAGE = "Choose the related job.";

export const reportIncidentSchema = z.object({
  // z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
  job_id: z
    .string()
    .trim()
    .min(1, JOB_REQUIRED_MESSAGE)
    .pipe(z.guid(JOB_REQUIRED_MESSAGE)),
  // No default: the reporter has to choose a severity.
  severity: z.enum(INCIDENT_SEVERITIES, { error: "Choose the severity." }),
  description: z
    .string()
    .trim()
    .min(1, "Describe what happened.")
    .max(
      INCIDENT_DESCRIPTION_MAX_LENGTH,
      `Description must be at most ${INCIDENT_DESCRIPTION_MAX_LENGTH} characters.`,
    ),
});

export type ReportIncidentInput = z.infer<typeof reportIncidentSchema>;
