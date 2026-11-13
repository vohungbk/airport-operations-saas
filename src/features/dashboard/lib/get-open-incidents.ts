import { createClient } from "@/lib/supabase/server";
import { INCIDENT_SEVERITY_LABEL, type IncidentSeverity } from "@/features/incidents/lib/incident-severity";
import { INCIDENT_STATUS_LABEL, type IncidentStatus } from "@/features/incidents/lib/incident-status";
import { ATTENTION_LIST_LIMIT, type AttentionList } from "@/features/dashboard/lib/attention-list";

/** The incidents list the Open incidents rows link to: the same rule as the count. */
export const OPEN_INCIDENTS_HREF = "/incidents?status=open";

export interface OpenIncidentRow {
  id: string;
  type: string;
  severity: string;
  status: string;
}

/** Pure. The query sorts the most severe first. */
export function toOpenIncidentList(rows: readonly OpenIncidentRow[], count: number): AttentionList {
  return {
    count,
    items: rows.map((row) => ({
      id: row.id,
      href: `/incidents/${row.id}`,
      label: `${row.type} · ${INCIDENT_SEVERITY_LABEL[row.severity as IncidentSeverity] ?? row.severity}`,
      status_label: INCIDENT_STATUS_LABEL[row.status as IncidentStatus] ?? row.status,
    })),
  };
}

/**
 * Server-only. The first open incidents of the Command Centre (VI-F11-S08) with the total, read as the
 * signed-in user so RLS is the scope. The most severe comes first, then the one waiting longest. Open is the
 * `open` status, as in the Open incidents chart. A failed read gives `null` (a dash), never an empty list.
 */
export async function getOpenIncidents(): Promise<AttentionList | null> {
  try {
    const supabase = await createClient();
    const { data, count, error } = await supabase
      .from("incidents")
      .select("id, type, severity, status", { count: "exact" })
      .eq("status", "open")
      .order("severity", { ascending: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(ATTENTION_LIST_LIMIT);

    return error || !data || count === null ? null : toOpenIncidentList(data, count);
  } catch {
    return null;
  }
}
