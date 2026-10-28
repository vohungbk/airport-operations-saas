import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TodayJobsList } from "@/features/jobs/components/today-jobs-list";
import type { TodayJob, TodaysJobs } from "@/features/jobs/lib/todays-jobs";

const NOW = new Date("2026-10-24T10:05:00Z");

const job = (overrides: Partial<TodayJob> = {}): TodayJob => ({
  id: "j1",
  status: "assigned",
  pickup_at: "2026-10-24T11:00:00Z",
  booking_number: "BK-2026-000123",
  technician: "Omar Haddad",
  vehicle: "Toyota RAV4 · DXB A 48291",
  vehicle_bay: "C-14",
  airport: { code: "DXB", city: "Dubai", timezone: "Asia/Dubai" },
  required_category: "Convertible",
  seat: "SEAT-0001",
  flight: {
    flight_number: "EK 203",
    terminal: "3",
    timing: "early",
    offset_minutes: -45,
    scheduled_at: "2026-10-24T12:30:00Z",
    expected_at: "2026-10-24T11:45:00Z",
    last_synced_at: "2026-10-24T10:02:00Z",
  },
  ...overrides,
});

const render = (today: Partial<TodaysJobs> = {}) =>
  renderToStaticMarkup(createElement(TodayJobsList, { today: { jobs: [], next_pickup_at: null, ...today }, now: NOW }));

describe("Today's Jobs card of the first job", () => {
  it("should show the rows of the design with the values of the job", () => {
    const out = render({ jobs: [job()] });

    expect(out).toContain("Assigned");
    expect(out).toContain("BK-2026-000123");
    expect(out).toContain("DXB · Terminal 3 · Bay C-14");
    expect(out).toContain("Toyota RAV4 · DXB A 48291");
    expect(out).toContain("Convertible");
    expect(out).toContain("SEAT-0001");
    expect(out).toContain("Omar Haddad");
    expect(out).toContain("Deadline · Asia/Dubai");
  });

  it("should write a dash, never an invented value, for the job number, the partner and the deadline", () => {
    const out = render({ jobs: [job()] });

    expect(out).toContain("Partner");
    expect(out).not.toContain("Emirates");
    expect(out).not.toContain("JOB-2026");
    expect(out).not.toContain("15:15");
    expect(out.match(/>—</g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("should write a dash for what the job does not have", () => {
    const out = render({
      jobs: [job({ seat: null, required_category: null, vehicle: null, vehicle_bay: null, flight: null, airport: null })],
    });

    expect(out).not.toContain("Terminal");
    expect(out.match(/>—</g)?.length).toBeGreaterThanOrEqual(7);
  });
});

describe("Today's Jobs flight card and banner", () => {
  it("should show the flight, its status, the terminal, the times in the zone of the airport and the sync", () => {
    const out = render({ jobs: [job()] });

    expect(out).toContain("EK 203 · Dubai arrival");
    expect(out).toContain("Early 45 min");
    expect(out).toContain("Terminal 3");
    expect(out).toContain("Scheduled · Asia/Dubai");
    expect(out).toContain("16:30 · 24 Oct 2026");
    expect(out).toContain("15:45 · 24 Oct 2026");
    expect(out).toContain("Installation deadline");
    expect(out).toContain("Provider sync 14:02 GST · Updated 3 min ago");
  });

  it("should show the priority banner for a flight that arrives early", () => {
    const out = render({ jobs: [job()] });

    expect(out).toContain('data-slot="priority-banner"');
    expect(out).toContain("Priority · EK 203 arriving 45 minutes early");
  });

  it("should show no banner and no flight card when no flight is early or linked", () => {
    const onTime = render({ jobs: [job({ flight: { ...job().flight!, timing: "on_time", offset_minutes: 0 } })] });
    const none = render({ jobs: [job({ flight: null })] });

    expect(onTime).not.toContain('data-slot="priority-banner"');
    expect(onTime).toContain("On time");
    expect(none).not.toContain("Dubai arrival");
  });

  it("should say a flight is late with its minutes", () => {
    const out = render({ jobs: [job({ flight: { ...job().flight!, timing: "delayed", offset_minutes: 50 } })] });

    expect(out).toContain("Delayed 50 min");
  });
});

describe("Today's Jobs button and next jobs", () => {
  it("should open the installation of the first job with a button of at least 44 px", () => {
    const out = render({ jobs: [job({ id: "abc" })] });

    expect(out).toContain('href="/jobs/abc/installation"');
    expect(out).toContain("Open installation job");
    expect(out).toContain("min-h-11");
  });

  it("should list the other jobs as records that open their job, in the order given", () => {
    const out = render({
      jobs: [job({ id: "first" }), job({ id: "second", booking_number: "BK-2026-000124", seat: "SEAT-0008" }), job({ id: "third" })],
    });

    expect(out).toContain("Next jobs");
    expect(out).toContain("BK-2026-000124");
    expect(out).toContain("Vehicle / seat: Toyota RAV4 · DXB A 48291 · SEAT-0008");
    expect(out).toContain("Status: ● Assigned");
    expect(out.indexOf("/jobs/second")).toBeLessThan(out.indexOf("/jobs/third"));
    expect(out).not.toContain('href="/jobs/first"');
  });

  it("should not show the next jobs card when there is only one job", () => {
    expect(render({ jobs: [job()] })).not.toContain("Next jobs");
  });
});

describe("Today's Jobs empty state", () => {
  it("should say there are no jobs today, with the time of the next job when there is one", () => {
    expect(render({ next_pickup_at: "2026-10-30T08:00:00Z" })).toContain("No jobs today. Next job: 30 Oct, 08:00 UTC.");
  });

  it("should say there are no jobs today, with no next time when none is left", () => {
    const out = render();

    expect(out).toContain("No jobs today.");
    expect(out).not.toContain("Next job");
  });

  it("should not show the partner or any price", () => {
    const out = render({ jobs: [job()] });

    expect(out).not.toContain("AED");
    expect(out).not.toContain("Emirates Rent A Car");
  });
});
