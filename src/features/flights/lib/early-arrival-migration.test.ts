import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * VI-F02-S04: reads the migration that sets the priority and the deadline for an early arrival. It
 * runs without a database, so the rule is checked on every run; the functions themselves are proven by
 * kpi-inputs.integration.test.ts and workflow-board-reads.integration.test.ts.
 */
const MIGRATION = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261205090000_early_arrival_priority_deadline.sql"),
  "utf8",
);

/** The SQL without its comments, so a word in a comment is not read as a statement. */
const SQL = MIGRATION.split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("early arrival migration (VI-F02-S04)", () => {
  it("should raise the priority to high for an early flight only, not for a late one", () => {
    expect(SQL).toMatch(/board_flight_alert\(b\) = 'early' then 'high'/);
    expect(SQL).not.toMatch(/board_flight_alert\(b\) is not null/);
  });

  it("should keep an overdue booking urgent before anything else", () => {
    expect(SQL.indexOf("then 'urgent'")).toBeGreaterThan(-1);
    expect(SQL.indexOf("then 'urgent'")).toBeLessThan(SQL.indexOf("then 'high'"));
  });

  it("should move the deadline earlier only at 15 minutes early or more", () => {
    expect(SQL).toMatch(/round\(extract\(epoch from g\.gap\) \/ 60\) <= -15/);
  });

  it("should count the deadline from the pickup time, 60 minutes before it", () => {
    expect(SQL).toMatch(/p_pickup_at\s+- interval '60 minutes'/);
  });

  it("should keep the late rule as it was and add nothing for a flight that is less early", () => {
    expect(SQL).toMatch(/else greatest\(g\.gap, interval '0'\)/);
  });

  it("should keep the deadline function for the system only", () => {
    expect(SQL).toMatch(/create or replace function public\.installation_job_deadline[\s\S]*security definer/);
  });

  it("should not touch policies or tables", () => {
    expect(SQL).not.toMatch(/create policy|alter table|create table|drop /i);
  });
});
