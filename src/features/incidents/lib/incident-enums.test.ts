import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABEL,
} from "@/features/incidents/lib/incident-severity";
import {
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABEL,
} from "@/features/incidents/lib/incident-status";

const ENUMS_MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260826083733_create_enums_and_extensions.sql",
);

/** The values of `create type <name> as enum (...)`, in order. */
function enumValuesInMigration(name: string): string[] {
  const sql = readFileSync(ENUMS_MIGRATION, "utf8");
  const body = new RegExp(`create type ${name} as enum \\(([^)]*)\\)`).exec(sql);

  return [...(body?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe("incident enums", () => {
  it("should list exactly the values of the incident_status enum in the migration", () => {
    const values = enumValuesInMigration("incident_status");

    expect(values.length).toBeGreaterThan(0);
    expect([...INCIDENT_STATUSES]).toEqual(values);
  });

  it("should list exactly the values of the incident_severity enum in the migration", () => {
    const values = enumValuesInMigration("incident_severity");

    expect(values.length).toBeGreaterThan(0);
    expect([...INCIDENT_SEVERITIES]).toEqual(values);
  });

  it.each(INCIDENT_STATUSES.map((status) => [status]))(
    "should label the status %s",
    (status) => {
      expect(INCIDENT_STATUS_LABEL[status]).toBeTruthy();
    },
  );

  it.each(INCIDENT_SEVERITIES.map((severity) => [severity]))(
    "should label the severity %s",
    (severity) => {
      expect(INCIDENT_SEVERITY_LABEL[severity]).toBeTruthy();
    },
  );
});
