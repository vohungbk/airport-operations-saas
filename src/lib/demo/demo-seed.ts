import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * What the demo checks (src/lib/demo) know about the seed: the fixed ids of
 * its rows, and its accounts. Test support only; nothing in the app imports it.
 */

/** The demo login is public and lives in one place: the seed that sets it. */
export function demoLogin(): string {
  const seed = readFileSync(join(process.cwd(), "supabase", "seeds", "demo.sql"), "utf8");
  return /c_password constant text := '([^']+)'/.exec(seed)![1];
}

export const DCR = "b0000000-0000-0000-0000-000000000001";
export const DMO = "b0000000-0000-0000-0000-000000000002";
export const DXB = "a0000000-0000-0000-0000-000000000001";

export const DEMO_ACCOUNTS = [
  ["admin@airportops.example", "admin"],
  ["ops.manager@airportops.example", "operations_manager"],
  ["partner.dcr@airportops.example", "partner_user"],
  ["partner.dmo@airportops.example", "partner_user"],
  ["technician1@airportops.example", "technician"],
  ["technician2@airportops.example", "technician"],
  ["technician3@airportops.example", "technician"],
] as const;

/** A fixed id: a prefix and a number, as the seed writes them. */
export const idOf = (prefix: string, n: number) =>
  `${prefix}-0000-0000-0000-${String(n).padStart(12, "0")}`;

export const bookingId = (n: number) => idOf("f0000000", n);
export const seatId = (n: number) => idOf("e0000000", n);

export const SEED_BOOKING_IDS = Array.from({ length: 30 }, (_, i) => bookingId(i + 1));
export const SEED_SEAT_IDS = Array.from({ length: 40 }, (_, i) => seatId(i + 1));
export const JOB_IDS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => idOf("10000000", n));
export const INSTALLATION_IDS = [1, 3, 4].map((n) => idOf("11000000", n));
export const CLEANING_IDS = [idOf("12000000", 5)];
export const INSPECTION_IDS = [idOf("13000000", 6)];
export const INCIDENT_IDS = [1, 2].map((n) => idOf("14000000", n));
/** The agreed terms of the two demo partners (VI-F04). */
export const DEMO_TERMS_IDS = [1, 2].map((n) => idOf("c1000000", n));
export const CATEGORY_IDS = [1, 2, 3, 4].map((n) => idOf("c0000000", n));

/** The ids of the people of the seed. */
export const USER_IDS = {
  admin: idOf("a1000000", 1),
  ops: idOf("a1000000", 2),
  partnerDcr: idOf("a1000000", 3),
  partnerDmo: idOf("a1000000", 4),
  technician1: idOf("d0000000", 1),
  technician2: idOf("d0000000", 2),
  technician3: idOf("d0000000", 3),
} as const;
