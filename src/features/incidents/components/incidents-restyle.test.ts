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
      query,
    } as never),
  );

describe("incidents table (UI-F06-S04, R6, R10)", () => {
  it("should become cards on a phone and label every cell", () => {
    const out = table();
    const cells = out.match(/<td /g)?.length ?? 0;
    const labelled = out.match(/<td [^>]*data-label="[^"]+"/g)?.length ?? 0;

    expect(out).toContain('data-stacked=""');
    expect(cells).toBe(7);
    expect(labelled).toBe(cells);
  });

  it("should open the incident from a link stretched over the whole row", () => {
    const out = table();

    expect(out).toContain('href="/incidents/i-1"');
    expect(out).toContain("after:absolute after:inset-0");
  });

  it("should cut a long description short and keep it whole as a title", () => {
    const out = table(LONG);

    expect(out).toContain("truncate");
    expect(out).toContain(`title="${LONG}"`);
  });

  it("should render a description with markup as text, never as markup", () => {
    const out = table("<script>alert(1)</script>");

    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("&lt;script&gt;");
  });
});

describe("incidents pagination and filters", () => {
  it("should say which rows are shown", () => {
    const out = html(
      createElement(IncidentsPagination, {
        query: { ...query, page: 3 },
        total: 45,
      } as never),
    );

    expect(out).toContain("Showing 41–45 of 45");
  });

  it("should offer Clear all only once a filter is set", () => {
    const plain = html(createElement(IncidentsFilters, { query } as never));
    const filtered = html(
      createElement(IncidentsFilters, {
        query: { ...query, severity: "high" },
      } as never),
    );

    expect(plain).not.toContain("Clear all");
    expect(filtered).toContain("Clear all");
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
    booking: { booking_number: "BK-2026-000118" },
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
        allowedStatuses: [],
      }),
    );

  it("should show the description and the details in cards that wrap a long text", () => {
    const out = render(null);

    expect(out).toContain('data-slot="card"');
    expect(out).toContain("break-words");
  });

  it("should draw the history as a timeline for a manager", () => {
    const out = render([entry]);

    expect(out).toContain('data-slot="timeline"');
    expect(out).toContain("Note: Assigned for investigation");
  });

  it("should not show the history to someone who may not read it", () => {
    expect(render(null)).not.toContain("History");
  });

  it("should say so when no change is recorded", () => {
    const out = html(createElement(IncidentHistoryTimeline, { history: [] }));

    expect(out).toContain("No changes recorded.");
  });
});
