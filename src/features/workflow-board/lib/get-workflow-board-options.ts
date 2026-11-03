import { createClient } from "@/lib/supabase/server";
import type { WorkflowBoardOptions } from "@/features/workflow-board/lib/resolve-workflow-board-query";

/**
 * Server-only. The partners and airports of the filter bar; RLS decides which ones are visible.
 * `withPartners: false` leaves the partners out (a technician has no partner filter and cannot see partners).
 */
export async function getWorkflowBoardOptions({ withPartners = true } = {}): Promise<WorkflowBoardOptions> {
  const supabase = await createClient();

  const [partners, airports] = await Promise.all([
    withPartners
      ? supabase.from("partners").select("id, name").order("name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("airports").select("id, code").order("code", { ascending: true }),
  ]);

  for (const { error } of [partners, airports]) {
    if (error) {
      throw error;
    }
  }

  return {
    partners: (partners.data ?? []).map((partner) => ({ value: partner.id, label: partner.name })),
    airports: (airports.data ?? []).map((airport) => ({ value: airport.id, label: airport.code })),
  };
}
