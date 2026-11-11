import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/jobs",
}));

import { JobDetail } from "@/features/jobs/components/job-detail";
import { JobEventsTimeline } from "@/features/jobs/components/job-events-timeline";
import { JobsDeadlineChips } from "@/features/jobs/components/jobs-deadline-chips";
import { JobsFilters } from "@/features/jobs/components/jobs-filters";
import { JobsPagination } from "@/features/jobs/components/jobs-pagination";
import { JobsTable } from "@/features/jobs/components/jobs-table";
import type { JobDetailItem, JobEventItem } from "@/features/jobs/types";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);

const query = {
  sort: "assigned_at",
  order: "desc",
  page: 1,
  page_size: 20,
} as const;

const LONG_NAME = "Mohammed Abdulrahman Al Mansoori bin Khalifa ".repeat(3);

const job = (technicianName: string | null = "Omar Haddad") => ({
  id: "j-1",
  job_number: "JOB-2026-000123",
  job_type: "cleaning",
  status: "assigned",
  assigned_at: "2026-10-24T11:15:00Z",
  started_at: null,
  completed_at: null,
  vehicle_bay: null,
  deadline_at: null as string | null,
  booking: {
    id: "b-1",
    booking_number: "BK-2026-000123",
    airport: { timezone: "Asia/Dubai" },
    seat: { id: "s-1", serial_number: "SEAT-0001" },
  },
  technician: technicianName ? { id: "t-1", full_name: technicianName } : null,
});

const NOW = new Date("2026-11-04T10:00:00Z");

const table = (technicianName?: string | null, deadlineAt: string | null = null) =>
  html(
    createElement(JobsTable, {
      jobs: [{ ...job(technicianName), deadline_at: deadlineAt }],
      now: NOW,
    } as never),
  );

describe("jobs table (UI-F06-S04, R5, R10)", () => {
  it("should become cards on a phone", () => {
    expect(table()).toContain('data-stacked=""');
  });

  it("should label every cell with its column", () => {
    const out = table();
    const cells = out.match(/<td /g)?.length ?? 0;
    const labelled = out.match(/<td [^>]*data-label="[^"]+"/g)?.length ?? 0;

    expect(cells).toBe(8);
    expect(labelled).toBe(cells);
  });

  it("should list the columns of the design in order", () => {
    const out = table();
    const columns = ["Job number", "Type", "Seat", "Booking", "Technician", "Deadline", "Status", "Row action"];
    const positions = columns.map((column) => out.indexOf(`>${column}</th>`));

    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((x, y) => x - y)).toEqual(positions);
  });

  it("should show the type and the seat of the job", () => {
    const out = table();

    expect(out).toContain("Cleaning");
    expect(out).toContain("SEAT-0001");
  });

  it("should open the job from the job number and from a View button of at least 44 px", () => {
    const out = table();

    expect(out).toMatch(/<a [^>]*href="\/jobs\/j-1"[^>]*>View<\/a>/);
    expect(out).toMatch(/<a [^>]*min-h-11[^>]*>View<\/a>/);
  });

  it("should show the job number first, as the link to the job, and the booking number as plain text", () => {
    const out = table();

    expect(out.indexOf("Job number")).toBeLessThan(out.indexOf("Booking"));
    expect(out).toMatch(/<a [^>]*href="\/jobs\/j-1"[^>]*>JOB-2026-000123<\/a>/);
    expect(out).not.toMatch(/<a [^>]*>BK-2026-000123<\/a>/);
    expect(out).toContain("BK-2026-000123");
  });

  it("should show a long technician name in full as a title", () => {
    expect(table(LONG_NAME)).toContain(`title="${LONG_NAME}"`);
  });

  it("should say Unassigned when the job has no technician", () => {
    expect(table(null)).toContain("Unassigned");
  });
});

describe("jobs table Deadline column (UI-F06-T01, AC01, AC04, AC06)", () => {
  it("should put the Deadline column after Technician and before Status", () => {
    const out = table();

    expect(out.indexOf("Technician")).toBeLessThan(out.indexOf(">Deadline<"));
    expect(out.indexOf(">Deadline<")).toBeLessThan(out.indexOf(">Status<"));
  });

  it("should write the deadline in the time zone of the airport", () => {
    expect(table("Omar Haddad", "2026-11-04T10:30:00Z")).toContain("04 Nov 2026 14:30 GST");
  });

  it("should show No deadline, and no Overdue mark, when the job has no deadline", () => {
    const out = table();

    expect(out).toContain("No deadline");
    expect(out).not.toContain("Overdue");
  });

  it("should mark an open job past its deadline as overdue with an icon, the words and the date", () => {
    const out = table("Priya Nair", "2026-11-04T05:00:00Z");

    expect(out).toContain("Overdue</span>");
    expect(out).toContain("Overdue: 04 Nov 2026 09:00 GST");
    expect(out).toContain("bg-warning-bg");
    expect(out).toContain("text-warning-fg");
    expect(out).toContain("text-danger-fg");
    expect(out).toContain('aria-hidden="true"');
  });

  it("should show the Overdue badge in the Status column too, instead of the status", () => {
    const out = table("Priya Nair", "2026-11-04T05:00:00Z");

    expect(out.match(/>Overdue</g)?.length).toBe(2);
    expect(out).not.toContain(">Assigned<");
  });

  it("should not mark a job as overdue while its deadline has not passed", () => {
    expect(table("Omar Haddad", "2026-11-04T10:30:00Z")).not.toContain("Overdue");
  });
});

describe("jobs deadline chips (UI-F06-T01, AC02)", () => {
  const chips = (deadline?: "today" | "overdue", unassigned?: "1") =>
    html(createElement(JobsDeadlineChips, { query: { ...query, deadline, unassigned } } as never));

  it("should offer All, Today, Overdue and Unassigned as links that keep the rest of the filters", () => {
    const out = chips();

    for (const label of ["All", "Today", "Overdue", "Unassigned"]) {
      expect(out).toContain(`>${label}</a>`);
    }
    expect(out).toContain("deadline=today");
    expect(out).toContain("deadline=overdue");
    expect(out).toContain("unassigned=1");
    expect(out).toContain('aria-label="Deadline"');
  });

  it("should mark the chip in use and no other", () => {
    expect(chips("overdue").match(/aria-current="page"/g)?.length).toBe(1);
    expect(chips("overdue")).toMatch(/aria-current="page"[^>]*>Overdue</);
    expect(chips()).toMatch(/aria-current="page"[^>]*>All</);
    expect(chips(undefined, "1")).toMatch(/aria-current="page"[^>]*>Unassigned</);
  });

  it("should send the All chip to a list with no deadline filter, back on page 1", () => {
    const all = chips("overdue").match(/<a [^>]*href="([^"]+)"[^>]*>All</)?.[1] ?? "";

    expect(all).not.toContain("deadline=");
    expect(all).not.toContain("unassigned=");
    expect(all).toContain("page=1");
  });
});

describe("jobs pagination", () => {
  it("should say which rows are shown", () => {
    const out = html(
      createElement(JobsPagination, {
        query: { ...query, page: 2, page_size: 20 },
        total: 45,
      } as never),
    );

    expect(out).toContain("21-40 of 45");
  });

  it("should say 0 of 0 when there is nothing to show", () => {
    const out = html(
      createElement(JobsPagination, { query, total: 0 } as never),
    );

    expect(out).toContain("0-0 of 0");
  });
});

describe("jobs filters", () => {
  const filters = (override: Record<string, unknown> = {}, technicians: unknown = null) =>
    html(
      createElement(JobsFilters, {
        query: { ...query, ...override },
        technicians,
        airports: [{ id: "a-1", code: "DXB", timezone: "Asia/Dubai" }],
        timeZone: "Asia/Dubai",
        clearHref: "/jobs",
      } as never),
    );

  it("should show the labelled fields of the design and the airport time zone", () => {
    const out = filters({}, [{ id: "t-1", full_name: "Omar Haddad" }]);

    for (const label of ["Search", "Status", "Type", "Technician", "Airport", "Date range"]) {
      expect(out).toContain(`>${label}</`);
    }
    expect(out).toContain("Job, seat or booking");
    expect(out).toContain("Airport time zone: GST");
  });

  it("should always offer Clear filters, as the design does", () => {
    expect(filters()).toContain("Clear filters");
    expect(filters()).not.toMatch(/<button[^>]* disabled=""[^>]*>Clear filters</);
  });

  it("should show the date range in one field, written as the design does", () => {
    const out = filters({ from: "2026-11-01", to: "2026-11-04" });

    expect(out).toContain("01-04 Nov 2026 GST");
    expect(out).not.toContain(">From<");
  });

  it("should say All dates when no range is set", () => {
    expect(filters()).toContain("All dates");
  });

  it("should not show the technician filter to a technician", () => {
    expect(filters()).not.toContain("Filter by technician");
  });
});

describe("job detail and timeline", () => {
  const detail: JobDetailItem = {
    id: "j-1",
    job_number: "JOB-2026-000123",
    status: "in_progress",
    job_type: "cleaning",
    assigned_at: "2026-10-16T08:00:00Z",
    started_at: null,
    completed_at: null,
    created_at: "2026-10-16T07:00:00Z",
    vehicle_bay: null,
    installation_notes: null,
    deadline_at: null,
    technician: { id: "t-1", full_name: "Ahmed" },
    booking: null,
  };

  it("should show the job in a card, with no booking card when there is no booking", () => {
    const out = html(
      createElement(JobDetail, {
        job: detail,
        events: [],
        eventsTruncated: false,
        allowedStatuses: [],
        workRecordHref: null,
      }),
    );

    expect(out).toContain('data-slot="card"');
    expect(out).not.toContain(">Booking</h2>");
  });

  it("should head the job detail with the job number and list it first in the Job card", () => {
    const out = html(
      createElement(JobDetail, {
        job: detail,
        events: [],
        eventsTruncated: false,
        allowedStatuses: [],
        workRecordHref: null,
      }),
    );

    expect(out).toMatch(/<h1[^>]*>JOB-2026-000123<\/h1>/);
    expect(out.indexOf("Job number")).toBeGreaterThan(-1);
    expect(out.indexOf("Job number")).toBeLessThan(out.indexOf(">Type<"));
  });

  it("should draw the history with the shared timeline and say when it was cut short", () => {
    const event: JobEventItem = {
      id: "e-1",
      from_status: "assigned",
      to_status: "in_progress",
      status_changed: true,
      technician_changed: false,
      from_technician_name: null,
      to_technician_name: null,
      notes: "Started early",
      created_at: "2026-10-16T08:00:00Z",
      actor_name: "Priya Nair",
    };
    const out = html(
      createElement(JobEventsTimeline, { events: [event], truncated: true }),
    );

    expect(out).toContain('data-slot="timeline"');
    expect(out).toContain("Priya Nair");
    expect(out).toContain("Reason: Started early");
    expect(out).toContain("Showing latest");
  });

  it("should say so when no change is recorded", () => {
    const out = html(createElement(JobEventsTimeline, { events: [] }));

    expect(out).toContain("No changes recorded.");
  });
});

describe("job detail layout of the design", () => {
  const detail: JobDetailItem = {
    id: "j-1",
    job_number: "JOB-2026-000123",
    status: "assigned",
    job_type: "cleaning",
    assigned_at: "2026-11-04T04:00:00Z",
    started_at: null,
    completed_at: null,
    created_at: "2026-11-04T04:00:00Z",
    vehicle_bay: null,
    installation_notes: null,
    deadline_at: "2026-11-04T10:30:00Z",
    technician: { id: "t-1", full_name: "Omar Haddad" },
    booking: {
      id: "b-1",
      booking_number: "BK-2026-000123",
      partner: { name: "Emirates Rent A Car" },
      pickup_at: "2026-11-05T05:00:00Z",
      return_at: "2026-11-08T05:00:00Z",
      vehicle: null,
      vehicle_bay: null,
      child_age_band: null,
      child_height: null,
      flight_number: null,
      flight_lookup_status: null,
      airport: { code: "DXB", name: "Dubai International", city: "Dubai", timezone: "Asia/Dubai" },
      flight: null,
      seat: { id: "s-1", serial_number: "SEAT-0001", status: "available", category: null },
    },
  };

  const render = (links?: { seat: boolean; booking: boolean; technician: boolean }) =>
    html(
      createElement(JobDetail, {
        job: detail,
        events: [],
        eventsTruncated: false,
        allowedStatuses: [],
        workRecordHref: null,
        links,
      }),
    );

  it("should show the Job, Seat, Booking and Technician cards, the Job steps and the Timeline", () => {
    const out = render();

    for (const title of ["Job", "Seat", "Booking", "Technician", "Job steps", "Timeline"]) {
      expect(out).toContain(`>${title}</h2>`);
    }
  });

  it("should write every time in the time zone of the airport", () => {
    const out = render();

    expect(out).toContain("04 Nov 2026 14:30 GST");
    expect(out).toContain("05 Nov 2026 09:00 GST");
  });

  it("should show the partner and the seat status", () => {
    const out = render();

    expect(out).toContain("Emirates Rent A Car");
    expect(out).toContain("Available");
  });

  it("should link the names to their pages only when the user may open them", () => {
    const linked = render({ seat: true, booking: true, technician: true });
    const plain = render();

    expect(linked).toContain('href="/seats/s-1"');
    expect(linked).toContain('href="/bookings/b-1"');
    expect(linked).toContain('href="/technicians/t-1"');
    expect(plain).not.toContain('href="/seats/s-1"');
    expect(plain).not.toContain('href="/bookings/b-1"');
    expect(plain).not.toContain('href="/technicians/t-1"');
  });

  it("should mark the current step", () => {
    expect(render()).toMatch(/data-state="current"[^>]*aria-current="step"/);
  });

  it("should show the tabs Cleaning, Inspection and Return with the tab of the job selected", () => {
    const out = render();

    expect(out).toContain('role="tablist"');
    for (const label of ["Cleaning", "Inspection", "Return"]) {
      expect(out).toMatch(new RegExp(`role="tab"[^>]*>${label}</button>`));
    }
    expect(out).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>Cleaning</);
    expect(out).toMatch(/role="tab"[^>]*aria-selected="false"[^>]*>Inspection</);
  });

  it("should show the seat, what to do and the Start cleaning button in the Cleaning panel", () => {
    const out = html(
      createElement(JobDetail, {
        job: detail,
        events: [],
        eventsTruncated: false,
        allowedStatuses: [],
        workRecordHref: "/jobs/j-1/cleaning",
        lastWork: { cleaning: { at: "2026-11-03T13:20:00Z", outcome: "Success" }, inspection: null },
      }),
    );

    expect(out).toContain("Start cleaning after confirming there is no conflicting booking.");
    expect(out).toMatch(/<a [^>]*href="\/jobs\/j-1\/cleaning"[^>]*>Start cleaning<\/a>/);
    expect(out).toContain("Last cleaning: 03 Nov 2026 17:20 GST · Success");
  });
});
