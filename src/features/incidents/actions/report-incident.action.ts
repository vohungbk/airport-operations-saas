"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireAnyPermission } from "@/lib/auth/current-user";
import { INCIDENT_REPORT_PERMISSIONS } from "@/lib/auth/permissions";
import {
  VALIDATION_ERROR,
  mapJobError,
  type JobActionResult,
} from "@/features/jobs/lib/job-errors";
import { reportIncidentSchema } from "@/features/incidents/schemas/report-incident.schema";

// Not-null columns the guard trigger overwrites from the job. They are
// placeholders, never trusted values.
const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Only the job, the severity and the description come from the client. The
 * guard trigger on `incidents` derives the partner, booking and seat from the
 * job, sets the type and the reporter, and opens the incident; RLS lets a
 * technician report only for a job assigned to them while active.
 */
export async function reportIncidentAction(
  input: unknown,
): Promise<JobActionResult> {
  const user = await requireAnyPermission(INCIDENT_REPORT_PERMISSIONS);

  const parsed = reportIncidentSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      technician_job_id: parsed.data.job_id,
      severity: parsed.data.severity,
      description: parsed.data.description,
      partner_id: PLACEHOLDER_ID,
      reported_by: user.id,
      type: "report",
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: mapJobError(error) };
  }

  // Every reporter can open the incident they just made: RLS gives a
  // technician the ones they reported, a manager every incident.
  redirect(`/incidents/${data.id}`);
}
