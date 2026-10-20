"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAnyPermission } from "@/lib/auth/current-user";
import { INCIDENT_STATUS_UPDATE_PERMISSIONS } from "@/lib/auth/permissions";
import {
  VALIDATION_ERROR,
  type JobActionResult,
} from "@/features/jobs/lib/job-errors";
import { mapIncidentError } from "@/features/incidents/lib/incident-errors";
import { changeIncidentStatusSchema } from "@/features/incidents/schemas/change-incident-status.schema";

/**
 * Status changes go only through `public.change_incident_status()`, which
 * checks the caller, validates the transition under a row lock and (via
 * trigger) writes the history row atomically. Never a direct
 * `update({ status })`: the guard trigger rejects it.
 */
export async function changeIncidentStatusAction(
  input: unknown,
): Promise<JobActionResult> {
  await requireAnyPermission(INCIDENT_STATUS_UPDATE_PERMISSIONS);

  const parsed = changeIncidentStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_incident_status", {
    p_incident_id: parsed.data.incident_id,
    p_from_status: parsed.data.from_status,
    p_to_status: parsed.data.to_status,
    p_note: parsed.data.note || undefined,
  });

  if (error) {
    return { success: false, error: mapIncidentError(error) };
  }

  return { success: true };
}
