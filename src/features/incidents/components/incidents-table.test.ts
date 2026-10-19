import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IncidentsTable } from "@/features/incidents/components/incidents-table";
import type { IncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";
import type { IncidentListItem } from "@/features/incidents/types";

const QUERY: IncidentsQuery = {
  q: undefined,
  sort: "created_at",
  order: "desc",
  page: 1,
  page_size: 20,
};

function incident(overrides: Partial<IncidentListItem> = {}): IncidentListItem {
  return {
    id: "i-1",
    type: "Damaged strap",
    severity: "critical",
    status: "investigating",
    description: "Torn",
    created_at: "2026-10-16T08:05:00Z",
    seat: { serial_number: "SN-2" },
    booking: { booking_number: "BK-00002" },
    reporter: { full_name: "Ahmed" },
    ...overrides,
  };
}

function render(incidents: IncidentListItem[], query = QUERY) {
  return renderToStaticMarkup(
    createElement(IncidentsTable, { incidents, query }),
  );
}

describe("IncidentsTable", () => {
  it("should show severity and status as text, not only as color", () => {
    const html = render([incident()]);

    expect(html).toContain("Critical");
    expect(html).toContain("Investigating");
  });

  it("should show the seat as the related item when there is one", () => {
    const html = render([incident()]);

    expect(html).toContain("SN-2");
    expect(html).not.toContain("BK-00002");
  });

  it("should fall back to the booking number, then to a dash", () => {
    expect(render([incident({ seat: null })])).toContain("BK-00002");

    const bare = render([
      incident({ seat: null, booking: null, reporter: null }),
    ]);
    expect(bare).toContain("—");
  });

  it("should render the description as text and not as markup", () => {
    const html = render([incident({ description: "<script>alert(1)</script>" })]);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("should link the sort headers and flip the order of the current sort", () => {
    const html = render([incident()], { ...QUERY, sort: "severity", order: "asc" });

    expect(html).toContain("sort=severity&amp;order=desc&amp;page=1");
    expect(html).toContain("sort=status&amp;order=asc&amp;page=1");
  });
});
