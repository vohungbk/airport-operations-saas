import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/incidents",
}));

vi.mock("@/features/incidents/actions/change-incident-status.action", () => ({
  changeIncidentStatusAction: vi.fn(),
}));

import { IncidentDetail } from "@/features/incidents/components/incident-detail";
import { IncidentHistoryTimeline } from "@/features/incidents/components/incident-history-timeline";
import { IncidentsFilters } from "@/features/incidents/components/incidents-filters";
import { IncidentsPagination } from "@/features/incidents/components/incidents-pagination";
import { IncidentsStatusChips } from "@/features/incidents/components/incidents-status-chips";
import { IncidentsTable } from "@/features/incidents/components/incidents-table";
import type {
  IncidentDetailItem,
  IncidentHistoryItem,
} from "@/features/incidents/types";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);

const query = {
  sort: "created_at",
  order: "desc",
  page: 1,
  page_size: 20,
} as const;

const LONG = "The harness strap is torn near the buckle and ".repeat(8);

const row = (description = "Torn strap") => ({
  id: "i-1",
  type: "Damaged strap",
  severity: "high",
  status: "open",
  description,
  created_at: "2026-10-24T10:20:00Z",
  seat: { serial_number: "SEAT-0018", status: "quarantine" },
  booking: { booking_number: "BK-2026-000118" },
  reporter: { full_name: "Omar Haddad" },
});

const table = (description?: string) =>
  html(
    createElement(IncidentsTable, {
      incidents: [row(description)],
      timeZone: "Asia/Dubai",
    } as never),
  );

describe("incidents table", () => {
  it("should become cards on a phone and label every cell", () => {
    const out = table();
    const cells = out.match(/<td /g)?.length ?? 0;
    const labelled = out.match(/<td [^>]*data-label="[^"]+"/g)?.length ?? 0;

    expect(out).toContain('data-stacked=""');
    expect(cells).toBe(8);
    expect(labelled).toBe(cells);
  });

  it("should open the incident from the type and from a View button", () => {
    const out = table();

    expect(out.match(/href="\/incidents\/i-1"/g)).toHaveLength(2);
    expect(out).toContain("View");
  });

  it("should write the reported time in the airport time zone", () => {
    expect(table()).toContain("24 Oct 2026 14:20 GST");
  });

  it("should show severity and status with an icon and text", () => {
    const out = table();

    expect(out).toContain("High");
    expect(out).toContain("Open");
    expect(out.match(/<svg/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("should render the type with markup as text, never as markup", () => {
    const out = html(
      createElement(IncidentsTable, {
        incidents: [{ ...row(), type: "<script>alert(1)</script>" }],
        timeZone: "UTC",
      } as never),
    );

    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("&lt;script&gt;");
  });
});

describe("incidents pagination, chips and filters", () => {
  it("should say which rows are shown", () => {
    const out = html(
      createElement(IncidentsPagination, {
        query: { ...query, page: 3 },
        total: 45,
      } as never),
    );

    expect(out).toContain("41-45 of 45");
  });

  it("should mark the chip of the chosen status and keep All for none", () => {
    const all = html(createElement(IncidentsStatusChips, { query } as never));
    const open = html(
      createElement(IncidentsStatusChips, {
        query: { ...query, status: "open" },
      } as never),
    );

    expect(all.match(/aria-current="page"/g)).toHaveLength(1);
    expect(all).toMatch(/aria-current="page"[^>]*>All</);
    expect(open).toMatch(/aria-current="page"[^>]*>Open</);
    expect(open).toContain("Investigating");
    expect(open).toContain("Resolved");
  });

  it("should keep the other filters when a chip is chosen", () => {
    const out = html(
      createElement(IncidentsStatusChips, {
        query: { ...query, severity: "high", page: 4 },
      } as never),
    );

    expect(out).toContain("severity=high");
    expect(out).toContain("status=resolved");
    expect(out).toContain("page=1");
  });

  it("should show the airport time zone under the date range", () => {
    const out = html(
      createElement(IncidentsFilters, {
        query,
        seats: [],
        timeZone: "Asia/Dubai",
        clearHref: "/incidents",
      } as never),
    );

    expect(out).toContain("Airport time zone: GST");
    expect(out).toContain("Clear filters");
  });
});

describe("incident detail and history", () => {
  const detail: IncidentDetailItem = {
    id: "i-1",
    type: "Damaged strap",
    severity: "high",
    status: "open",
    description: LONG,
    created_at: "2026-10-24T10:20:00Z",
    updated_at: "2026-10-24T10:25:00Z",
    resolved_at: null,
    technician_job_id: "j-1",
    partner: { name: "Emirates Rent A Car" },
    seat: { serial_number: "SEAT-0018", status: "quarantine" },
    booking: {
      booking_number: "BK-2026-000118",
      airport: { code: "DXB", timezone: "Asia/Dubai" },
    },
    reporter: { full_name: "Omar Haddad" },
    resolver: null,
  };
  const entry: IncidentHistoryItem = {
    id: "h-1",
    from_status: "open",
    to_status: "investigating",
    notes: "Assigned for investigation",
    created_at: "2026-10-24T10:25:00Z",
    actor_name: "Priya Nair",
  };
  const render = (history: IncidentHistoryItem[] | null) =>
    html(
      createElement(IncidentDetail, {
        incident: detail,
        history,
        historyTruncated: false,
        showStaffDetails: true,
        showJobLink: false,
        allowedStatuses: [],
        accessLabel: "Admin - Full access",
        timeZone: "Asia/Dubai",
      }),
    );

  it("should show the details in an Incident card that wraps a long text", () => {
    const out = render(null);

    expect(out).toContain(">Incident<");
    expect(out).toContain("break-words");
  });

  it("should list the status history with who, when, from, to and the note for a manager", () => {
    const out = render([entry]);

    expect(out).toContain("Status history");
    expect(out).toContain("Priya Nair");
    expect(out).toContain("24 Oct 2026 14:25 GST");
    expect(out).toContain("Assigned for investigation");
  });

  it("should not show the history to someone who may not read it", () => {
    expect(render(null)).not.toContain("History");
  });

  it("should say so when no change is recorded", () => {
    const out = html(
      createElement(IncidentHistoryTimeline, {
        history: [],
        timeZone: "Asia/Dubai",
      }),
    );

    expect(out).toContain("No changes recorded.");
  });
});
