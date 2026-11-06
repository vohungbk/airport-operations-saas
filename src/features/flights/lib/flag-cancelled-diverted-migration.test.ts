import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * VI-F02-S06: reads the migration that flags a cancelled or diverted flight. It runs without a database; the
 * function itself is proven by workflow-board-reads.integration.test.ts.
 */
const SQL = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261209090000_flag_cancelled_diverted_flights.sql"),
  "utf8",
)
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("flag cancelled or diverted flights migration (VI-F02-S06)", () => {
  it("should read the status before the time gap, so an old estimate is not read as early", () => {
    expect(SQL.indexOf("'cancelled', 'diverted'")).toBeGreaterThan(-1);
    expect(SQL.indexOf("'cancelled', 'diverted'")).toBeLessThan(SQL.indexOf("then 'delayed'"));
  });

  it("should keep the early and delayed rules at 15 minutes", () => {
    expect(SQL).toMatch(/offset_minutes >= 15 then 'delayed'/);
    expect(SQL).toMatch(/offset_minutes <= -15 then 'early'/);
  });

  it("should stay a read as the caller, so row-level security decides what is seen", () => {
    expect(SQL).not.toMatch(/security definer/i);
  });

  it("should not touch policies, tables or the priority function", () => {
    expect(SQL).not.toMatch(/create policy|alter table|create table|drop |board_priority/i);
  });
});
