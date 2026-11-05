import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JobDetail } from "@/features/jobs/components/job-detail";
import type { JobDetailItem } from "@/features/jobs/types";

const JOB: JobDetailItem = {
  id: "j-1",
  job_number: "JOB-2026-000123",
  status: "in_progress",
  job_type: "installation",
  assigned_at: "2026-10-16T08:00:00Z",
  started_at: null,
  completed_at: null,
  vehicle_bay: null,
  installation_notes: null,
  deadline_at: null,
  technician: { id: "t-1", full_name: "Ahmed" },
  booking: null,
};

function render(
  workRecordHref: string | null,
  reportIncidentHref?: string | null,
  scanHref?: string | null,
) {
  return renderToStaticMarkup(
    createElement(JobDetail, {
      job: JOB,
      events: [],
      eventsTruncated: false,
      allowedStatuses: [],
      workRecordHref,
      reportIncidentHref,
      scanHref,
    }),
  );
}

describe("JobDetail", () => {
  it("should link Record work to the workflow screen when one is offered", () => {
    const html = render("/jobs/j-1/installation");

    expect(html).toContain('href="/jobs/j-1/installation"');
    expect(html).toContain("Record work");
  });

  it("should link Scan assigned seat to the scanner when one is offered, and hide it otherwise", () => {
    const shown = render(null, null, "/jobs/j-1/scan");

    expect(shown).toContain('href="/jobs/j-1/scan"');
    expect(shown).toContain("Scan assigned seat");
    expect(render(null, null, null)).not.toContain("Scan assigned seat");
  });

  it("should link Report incident to the report form when it is offered", () => {
    const html = render(null, "/incidents/new?job_id=j-1");

    expect(html).toContain('href="/incidents/new?job_id=j-1"');
    expect(html).toContain("Report incident");
  });

  it("should not show Report incident when it is not offered", () => {
    expect(render(null)).not.toContain("Report incident");
    expect(render(null, null)).not.toContain("Report incident");
  });

  it("should not show Record work when no workflow is offered", () => {
    expect(render(null)).not.toContain("Record work");
  });

  it("should show the flight of the booking with the deadline of the job (VI-F02-S02)", () => {
    const html = renderToStaticMarkup(
      createElement(JobDetail, {
        job: {
          ...JOB,
          deadline_at: "2026-10-24T11:15:00.000Z",
          booking: {
            booking_number: "BK-1",
            pickup_at: "2026-10-24T12:15:00.000Z",
            return_at: "2026-10-27T12:15:00.000Z",
            vehicle: null,
            vehicle_bay: null,
            child_age_band: null,
            child_height: null,
            flight_number: "EK203",
            flight_lookup_status: "linked",
            airport: { code: "DXB", name: "Dubai International", city: "Dubai", timezone: "Asia/Dubai" },
            seat: null,
            flight: {
              flight_number: "EK203",
              status: "scheduled",
              terminal: "3",
              scheduled_arrival_at: "2026-10-24T12:30:00.000Z",
              estimated_arrival_at: "2026-10-24T11:45:00.000Z",
              actual_arrival_at: null,
              delay_minutes: null,
              last_synced_at: "2026-10-24T10:02:00.000Z",
            },
          },
        },
        events: [],
        eventsTruncated: false,
        allowedStatuses: [],
        workRecordHref: null,
      }),
    );

    expect(html).toContain("EK203 · Dubai arrival");
    expect(html).toContain("Installation deadline");
    expect(html).toContain("15:15 GST");
  });

  it("should say no flight is linked when the booking has no flight number", () => {
    const html = renderToStaticMarkup(
      createElement(JobDetail, {
        job: {
          ...JOB,
          booking: {
            booking_number: "BK-1",
            pickup_at: "2026-10-24T12:15:00.000Z",
            return_at: "2026-10-27T12:15:00.000Z",
            vehicle: null,
            vehicle_bay: null,
            child_age_band: null,
            child_height: null,
            flight_number: null,
            flight_lookup_status: null,
            airport: null,
            seat: null,
            flight: null,
          },
        },
        events: [],
        eventsTruncated: false,
        allowedStatuses: [],
        workRecordHref: null,
      }),
    );

    expect(html).toContain("No flight is linked to this booking.");
  });
});
