import { createClient } from "@/lib/supabase/server";
import { incidentIdSchema } from "@/features/incidents/schemas/incident-id.schema";
import type { IncidentHistoryItem } from "@/features/incidents/types";

export const INCIDENT_HISTORY_LIMIT = 50;

export const INCIDENT_HISTORY_SELECT = [
  "id",
  "from_status",
  "to_status",
  "notes",
  "created_at",
  "actor:users!user_id(full_name)",
].join(", ");

export interface IncidentHistoryResult {
  history: IncidentHistoryItem[];
  /** True when older entries were cut off by the limit. */
  truncated: boolean;
}

interface HistoryRow {
  id: string;
  from_status: IncidentHistoryItem["from_status"];
  to_status: IncidentHistoryItem["to_status"];
  notes: string | null;
  created_at: string;
  actor: { full_name: string } | null;
}

/**
 * Server-only, read-only, newest first. Fetches one extra row to know whether
 * older entries were cut off. The log is append-only in the database and RLS
 * scopes it to admin and operations manager. A name the user is not allowed to
 * read comes back null and the UI falls back.
 */
export async function getIncidentHistory(
  incidentId: string,
): Promise<IncidentHistoryResult> {
  if (!incidentIdSchema.safeParse(incidentId).success) {
    return { history: [], truncated: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incident_status_history")
    .select(INCIDENT_HISTORY_SELECT)
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(INCIDENT_HISTORY_LIMIT + 1);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as HistoryRow[];

  return {
    history: rows.slice(0, INCIDENT_HISTORY_LIMIT).map((row) => ({
      id: row.id,
      from_status: row.from_status,
      to_status: row.to_status,
      notes: row.notes,
      created_at: row.created_at,
      actor_name: row.actor?.full_name ?? null,
    })),
    truncated: rows.length > INCIDENT_HISTORY_LIMIT,
  };
}
