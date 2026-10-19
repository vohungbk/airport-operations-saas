import { describe, expect, it } from "vitest";

import { INCIDENT_SEVERITIES, INCIDENT_SEVERITY_LABEL } from "@/features/incidents/lib/incident-severity";
import { INCIDENT_STATUSES, INCIDENT_STATUS_LABEL } from "@/features/incidents/lib/incident-status";

describe("incident enums", () => {
  it("should list the incident_status values and label every one", () => {
    expect([...INCIDENT_STATUSES]).toEqual([
      "open",
      "investigating",
      "resolved",
      "closed",
    ]);
    for (const status of INCIDENT_STATUSES) {
      expect(INCIDENT_STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it("should list the incident_severity values and label every one", () => {
    expect([...INCIDENT_SEVERITIES]).toEqual([
      "low",
      "medium",
      "high",
      "critical",
    ]);
    for (const severity of INCIDENT_SEVERITIES) {
      expect(INCIDENT_SEVERITY_LABEL[severity]).toBeTruthy();
    }
  });
});
