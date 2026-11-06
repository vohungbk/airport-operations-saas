import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * VI-F02-S05: reads the migration that moves the installation deadline on a delay. It runs without a
 * database, so the rule is checked on every run; the function itself is proven by
 * kpi-inputs.integration.test.ts.
 */
const MIGRATION = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261208090000_move_deadline_on_delay.sql"),
  "utf8",
);

/** The SQL without its comments, so a word in a comment is not read as a statement. */
const SQL = MIGRATION.split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("move deadline on delay migration (VI-F02-S05)", () => {
  it("should move the deadline by the gap only at 15 minutes or more, early or late", () => {
    expect(SQL).toMatch(/abs\(round\(extract\(epoch from g\.gap\) \/ 60\)\) >= 15/);
    expect(SQL).toMatch(/then make_interval\(mins => round\(extract\(epoch from g\.gap\) \/ 60\)::integer\)/);
  });

  it("should add nothing for a gap under 15 minutes", () => {
    expect(SQL).toMatch(/else interval '0'\s+end/);
  });

  it("should no longer add every delay as it came", () => {
    expect(SQL).not.toMatch(/greatest\(g\.gap/);
  });

  it("should count the deadline from the pickup time, 60 minutes before it", () => {
    expect(SQL).toMatch(/p_pickup_at\s+- interval '60 minutes'/);
  });

  it("should read the actual arrival first, then the estimate, then delay_minutes", () => {
    expect(SQL).toMatch(/coalesce\(f\.actual_arrival_at, f\.estimated_arrival_at\) - f\.scheduled_arrival_at/);
    expect(SQL).toMatch(/make_interval\(mins => coalesce\(f\.delay_minutes, 0\)\)/);
  });

  it("should keep the deadline function for the system only", () => {
    expect(SQL).toMatch(/create or replace function public\.installation_job_deadline[\s\S]*security definer/);
    expect(SQL).toMatch(/set search_path = ''/);
  });

  it("should not touch policies, tables or grants", () => {
    expect(SQL).not.toMatch(/create policy|alter table|create table|drop |grant /i);
  });
});
