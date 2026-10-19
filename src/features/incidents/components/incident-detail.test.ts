import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IncidentDetail } from "@/features/incidents/components/incident-detail";
import type { IncidentDetailItem } from "@/features/incidents/types";

function incident(
  overrides: Partial<IncidentDetailItem> = {},
): IncidentDetailItem {
  return {
    id: "i-1",
    type: "Damaged strap",
    severity: "critical",
    status: "investigating",
    description: "The harness strap is torn.",
    created_at: "2026-10-16T08:05:00Z",
    updated_at: "2026-10-17T09:00:00Z",
    resolved_at: null,
    technician_job_id: "j-1",
    partner: { name: "Emirates Rent A Car" },
    seat: { serial_number: "SN-2" },
    booking: { booking_number: "BK-00002" },
    reporter: { full_name: "Ahmed" },
    resolver: null,
    ...overrides,
  };
}

function render(item: IncidentDetailItem = incident()) {
  return renderToStaticMarkup(
    createElement(IncidentDetail, { incident: item }),
  );
}

describe("IncidentDetail", () => {
  it("should show the incident with its severity and status as text", () => {
    const html = render();

    expect(html).toContain("Damaged strap");
    expect(html).toContain("Critical");
    expect(html).toContain("Investigating");
    expect(html).toContain("The harness strap is torn.");
  });

  it("should show what the incident refers to and who reported it", () => {
    const html = render();

    expect(html).toContain("Emirates Rent A Car");
    expect(html).toContain("SN-2");
    expect(html).toContain("BK-00002");
    expect(html).toContain("Ahmed");
    expect(html).toContain('href="/jobs/j-1"');
  });

  it("should link back to the incident list", () => {
    const html = render();

    expect(html).toContain('href="/incidents"');
    expect(html).toContain("Back to incidents");
  });

  it("should show a dash for what is missing and no job link without a job", () => {
    const html = render(
      incident({
        partner: null,
        seat: null,
        booking: null,
        reporter: null,
        technician_job_id: null,
      }),
    );

    expect(html).not.toContain('href="/jobs/');
    expect(html.match(/>-</g)).toHaveLength(7);
  });

  it("should show who resolved the incident and when", () => {
    const html = render(
      incident({
        status: "resolved",
        resolved_at: "2026-10-18T10:00:00Z",
        resolver: { full_name: "Fatima" },
      }),
    );

    expect(html).toContain("Fatima");
    expect(html).toContain("Resolved");
  });

  it("should render the description as text and not as markup", () => {
    const html = render(incident({ description: "<script>alert(1)</script>" }));

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("should not offer to change the status on this screen", () => {
    expect(render()).not.toContain("Update status");
  });
});
