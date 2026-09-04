import { Constants, type Database } from "@/types/database.types";

/**
 * The single source of truth for `partners` row/status shapes is the
 * generated Supabase types (`partners` table, `partner_status` enum).
 * Never hand-duplicate the columns/values here — alias the generated
 * type/constant so this can never drift from the schema, matching the
 * `Role`/`ROLES` pattern in `src/lib/auth/roles.ts`.
 */
export type Partner = Database["public"]["Tables"]["partners"]["Row"];

export type PartnerStatus = Database["public"]["Enums"]["partner_status"];

export const PARTNER_STATUSES: PartnerStatus[] = [
  ...Constants.public.Enums.partner_status,
];
