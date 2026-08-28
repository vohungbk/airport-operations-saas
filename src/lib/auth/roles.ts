import { Constants, type Database } from "@/types/database.types";

/**
 * The single source of truth for role literals is the `user_role`
 * Postgres enum (`supabase/migrations/20260828065217_redefine_user_role_enum.sql`).
 * Never hand-duplicate the values here — alias the generated type/constant
 * so this can never drift from the schema.
 */
export type Role = Database["public"]["Enums"]["user_role"];

export const ROLES: Role[] = [...Constants.public.Enums.user_role];
