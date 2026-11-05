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
  },
  technician: technicianName ? { id: "t-1", full_name: technicianName } : null,
});

const NOW = new Date("2026-11-04T10:00:00Z");

const table = (technicianName?: string | null, deadlineAt: string | null = null) =>
  html(
    createElement(JobsTable, {
      jobs: [{ ...job(technicianName), deadline_at: deadlineAt }],
      query,
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

    expect(cells).toBe(7);
    expect(labelled).toBe(cells);
  });

  it("should open the job from a link stretched over the whole row", () => {
    const out = table();

    expect(out).toContain('href="/jobs/j-1"');
    expect(out).toContain("after:absolute after:inset-0");
  });

  it("should show the job number first, as the link to the job, and the booking number as plain text", () => {
    const out = table();

    expect(out.indexOf("Job number")).toBeLessThan(out.indexOf("Booking"));
    expect(out).toContain('aria-label="View job JOB-2026-000123"');
    expect(out).toMatch(/<a [^>]*href="\/jobs\/j-1"[^>]*>JOB-2026-000123<\/a>/);
    expect(out).not.toMatch(/<a [^>]*>BK-2026-000123<\/a>/);
    expect(out).toContain("BK-2026-000123");
  });

  it("should keep a long technician name inside its cell and show it in full as a title", () => {
    const out = table(LONG_NAME);

    expect(out).toContain("truncate");
    expect(out).toContain(`title="${LONG_NAME}"`);
  });

  it("should show a dash when the job has no technician", () => {
    expect(table(null)).toContain("—");
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

  it("should not mark a job as overdue while its deadline has not passed", () => {
    expect(table("Omar Haddad", "2026-11-04T10:30:00Z")).not.toContain("Overdue");
  });
});

describe("jobs deadline chips (UI-F06-T01, AC02)", () => {
  const chips = (deadline?: "today" | "overdue") =>
    html(createElement(JobsDeadlineChips, { query: { ...query, deadline } } as never));

  it("should offer All, Today and Overdue as links that keep the rest of the filters", () => {
    const out = chips();

    for (const label of ["All", "Today", "Overdue"]) {
      expect(out).toContain(`>${label}</a>`);
    }
    expect(out).toContain("deadline=today");
    expect(out).toContain("deadline=overdue");
    expect(out).toContain('aria-label="Deadline"');
  });

  it("should mark the chip in use and no other", () => {
    expect(chips("overdue").match(/aria-current="page"/g)?.length).toBe(1);
    expect(chips("overdue")).toMatch(/aria-current="page"[^>]*>Overdue</);
    expect(chips()).toMatch(/aria-current="page"[^>]*>All</);
  });

  it("should send the All chip to a list with no deadline filter, back on page 1", () => {
    const all = chips("overdue").match(/<a [^>]*href="([^"]+)"[^>]*>All</)?.[1] ?? "";

    expect(all).not.toContain("deadline=");
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

    expect(out).toContain("Showing 21–40 of 45");
  });

  it("should say 0 of 0 when there is nothing to show", () => {
    const out = html(
      createElement(JobsPagination, { query, total: 0 } as never),
    );

    expect(out).toContain("Showing 0–0 of 0");
  });
});

describe("jobs filters", () => {
  it("should offer Clear all only once a filter is set", () => {
    const plain = html(
      createElement(JobsFilters, { query, technicians: null } as never),
    );
    const filtered = html(
      createElement(JobsFilters, {
        query: { ...query, status: "assigned" },
        technicians: null,
      } as never),
    );

    expect(plain).not.toContain("Clear all");
    expect(filtered).toContain("Clear all");
  });

  it("should offer Clear all when only the deadline chip is set", () => {
    const out = html(
      createElement(JobsFilters, {
        query: { ...query, deadline: "overdue" },
        technicians: null,
      } as never),
    );

    expect(out).toContain("Clear all");
  });

  it("should not show the technician filter to a technician", () => {
    const out = html(
      createElement(JobsFilters, { query, technicians: null } as never),
    );

    expect(out).not.toContain("Filter by technician");
  });
});

describe("job detail and history", () => {
  const detail: JobDetailItem = {
    id: "j-1",
    job_number: "JOB-2026-000123",
    status: "in_progress",
    job_type: "cleaning",
    assigned_at: "2026-10-16T08:00:00Z",
    started_at: null,
    completed_at: null,
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
    expect(out.indexOf("Job number")).toBeLessThan(out.indexOf("Job type"));
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
