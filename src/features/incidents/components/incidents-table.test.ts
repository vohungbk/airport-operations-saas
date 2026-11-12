import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IncidentsTable } from "@/features/incidents/components/incidents-table";
import type { IncidentListItem } from "@/features/incidents/types";

function incident(overrides: Partial<IncidentListItem> = {}): IncidentListItem {
  return {
    id: "i-1",
    type: "Damaged strap",
    severity: "critical",
    status: "investigating",
    description: "Torn",
    created_at: "2026-10-16T08:05:00Z",
    seat: { serial_number: "SN-2", status: "available" },
    booking: { booking_number: "BK-00002" },
    reporter: { full_name: "Ahmed" },
    ...overrides,
  };
}

function render(incidents: IncidentListItem[]) {
  return renderToStaticMarkup(
    createElement(IncidentsTable, { incidents, timeZone: "Asia/Dubai" }),
  );
}

describe("IncidentsTable", () => {
  it("should link each incident to its detail page", () => {
    const html = render([incident({ id: "i-9" })]);

    expect(html).toContain('href="/incidents/i-9"');
  });

  it("should show severity and status as text, not only as color", () => {
    const html = render([incident()]);

    expect(html).toContain("Critical");
    expect(html).toContain("Investigating");
  });

  it("should show the seat and the booking in their own columns", () => {
    const html = render([incident()]);

    expect(html).toContain("SN-2");
    expect(html).toContain("BK-00002");
  });

  it("should keep the seat in the list and say it is retired when the seat was retired", () => {
    const html = render([
      incident({ seat: { serial_number: "SN-2", status: "retired" } }),
    ]);

    expect(html).toContain("SN-2 (Retired)");
  });

  it("should show a dash when the seat, booking or reporter is missing", () => {
    const bare = render([
      incident({ seat: null, booking: null, reporter: null }),
    ]);

    expect(bare.match(/—/g)).toHaveLength(3);
  });

  it("should write the reported time in the airport time zone", () => {
    expect(render([incident()])).toContain("16 Oct 2026 12:05 GST");
  });

  it("should render the incident type as text and not as markup", () => {
    const html = render([incident({ type: "<script>alert(1)</script>" })]);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
