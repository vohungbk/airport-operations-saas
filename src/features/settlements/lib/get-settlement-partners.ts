import { createClient } from "@/lib/supabase/server";

export interface SettlementPartnerOption {
  value: string;
  label: string;
}

/** The partners an admin can generate a settlement for. RLS decides which rows are visible. */
export async function getSettlementPartners(): Promise<SettlementPartnerOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .select("id, name, code")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((partner) => ({
    value: partner.id,
    label: `${partner.name} (${partner.code})`,
  }));
}
