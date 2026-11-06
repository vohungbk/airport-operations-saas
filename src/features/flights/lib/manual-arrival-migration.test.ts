import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * VI-F02-S07: reads the migration that lets operations enter an arrival by hand. It runs without a database;
 * the functions are proven by manual-arrival.integration.test.ts.
 */
const SQL = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261210090000_manual_flight_arrival.sql"),
  "utf8",
)
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("manual flight arrival migration (VI-F02-S07)", () => {
  it("should check the role inside the function and refuse everyone but an admin or an operations manager", () => {
    expect(SQL).toMatch(/is_admin_or_ops_manager\(\)/);
    expect(SQL).toMatch(/errcode = '42501'/);
  });

  it("should require a reason for a manual write, in the function and in the table", () => {
    expect(SQL).toMatch(/v_manual and v_reason is null/);
    expect(SQL).toMatch(/check \(source <> 'manual' or \(reason is not null and btrim\(reason\) <> ''\)\)/);
  });

  it("should clear the Manual mark on any write that is not manual", () => {
    expect(SQL).toMatch(/manual_entered_at = case when v_manual then now\(\) end/);
    expect(SQL).toMatch(/manual_reason = case when v_manual then v_reason end/);
  });

  it("should keep the refresh function for the system only and give the person only the new function", () => {
    expect(SQL).toMatch(/revoke execute on function public\.apply_flight_refresh\([^)]*\) from authenticated/);
    expect(SQL).toMatch(/grant execute on function public\.apply_flight_refresh\([^)]*\) to service_role/);
    expect(SQL).toMatch(/grant execute on function public\.enter_manual_arrival\([^)]*\) to authenticated/);
    expect(SQL).not.toMatch(/grant execute on function public\.apply_flight_refresh\([^)]*\) to authenticated/);
  });

  it("should drop the old five-argument refresh function so a call is not ambiguous", () => {
    expect(SQL).toMatch(/drop function public\.apply_flight_refresh\(uuid, jsonb, jsonb, text, timestamptz\)/);
  });

  it("should refuse an ended booking and make the flight only when the booking has none", () => {
    expect(SQL).toMatch(/in \('completed', 'cancelled', 'no_show'\)/);
    expect(SQL).toMatch(/if v_flight_id is null then/);
  });

  it("should use an empty search path and not touch policies", () => {
    expect(SQL).toMatch(/set search_path = ''/);
    expect(SQL).not.toMatch(/create policy|drop policy|disable row level security/i);
  });
});
