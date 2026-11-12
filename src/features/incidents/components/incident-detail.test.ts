import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/features/incidents/actions/change-incident-status.action", () => ({
  changeIncidentStatusAction: vi.fn(),
}));

import { IncidentDetail } from "@/features/incidents/components/incident-detail";
import type {
  IncidentDetailItem,
  IncidentHistoryItem,
} from "@/features/incidents/types";
import type { IncidentStatus } from "@/features/incidents/lib/incident-status";

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
    seat: { serial_number: "SN-2", status: "available" },
    booking: {
      booking_number: "BK-00002",
      airport: { code: "DXB", timezone: "Asia/Dubai" },
    },
    reporter: { full_name: "Ahmed" },
    resolver: null,
    ...overrides,
  };
}

function render(
  item: IncidentDetailItem = incident(),
  options: {
    history?: IncidentHistoryItem[] | null;
    historyTruncated?: boolean;
    allowedStatuses?: IncidentStatus[];
    showStaffDetails?: boolean;
    showJobLink?: boolean;
    accessLabel?: string | null;
  } = {},
) {
  return renderToStaticMarkup(
    createElement(IncidentDetail, {
      incident: item,
      history: options.history === undefined ? [] : options.history,
      historyTruncated: options.historyTruncated ?? false,
      showStaffDetails: options.showStaffDetails ?? true,
      showJobLink: options.showJobLink ?? false,
      allowedStatuses: options.allowedStatuses ?? [],
      accessLabel: options.accessLabel === undefined ? null : options.accessLabel,
      timeZone: "Asia/Dubai",
    }),
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

  it("should show the seat, booking, reporter and time of the incident", () => {
    const html = render();

    expect(html).toContain("SN-2");
    expect(html).toContain("BK-00002");
    expect(html).toContain("Ahmed");
    expect(html).toContain("16 Oct 2026 12:05 GST");
  });

  it("should show the airport and the reported time under the title", () => {
    expect(render()).toContain("DXB - 16 Oct 2026, 12:05 GST");
  });

  it("should show the access line only when it is given", () => {
    expect(render(incident(), { accessLabel: "Admin - Full access" })).toContain(
      "Admin - Full access",
    );
    expect(render()).not.toContain("Full access");
  });

  it("should show a dash for what is missing", () => {
    const html = render(
      incident({ seat: null, booking: null, reporter: null }),
    );

    expect(html.match(/>-</g)).toHaveLength(3);
  });

  it("should link to the job only when the job link is asked for", () => {
    expect(render(incident(), { showJobLink: true })).toContain(
      'href="/jobs/j-1"',
    );
    expect(render()).not.toContain('href="/jobs/');
  });

  it("should show the read-only photos section", () => {
    expect(render()).toContain("Photos - read only");
  });

  it("should render the description as text and not as markup", () => {
    const html = render(incident({ description: "<script>alert(1)</script>" }));

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("should keep the seat of the incident and say it is retired when the seat was retired", () => {
    const html = render(
      incident({ seat: { serial_number: "SN-2", status: "retired" } }),
    );

    expect(html).toContain("SN-2 (Retired)");
  });

  it("should show the serial number alone while the seat is in use", () => {
    const html = render();

    expect(html).toContain("SN-2");
    expect(html).not.toContain("Retired");
  });

  it("should leave out the staff names and the job link for a partner user", () => {
    const html = render(incident(), { showStaffDetails: false });

    expect(html).toContain("SN-2");
    expect(html).not.toContain("Ahmed");
    expect(html).not.toContain("Reported by");
    expect(html).not.toContain('href="/jobs/');
  });

  it("should leave out the history when the user may not read it", () => {
    const html = render(incident(), { history: null });

    expect(html).not.toContain("History");
    expect(html).not.toContain("No changes recorded.");
  });

  it("should offer Change status when the user has a permitted transition", () => {
    expect(render(incident(), { allowedStatuses: ["resolved"] })).toContain(
      "Change status",
    );
  });

  it("should not offer Change status when there is no permitted transition", () => {
    expect(render(incident({ status: "closed" }))).not.toContain(
      "Change status",
    );
  });

  it("should show the history of the incident", () => {
    const html = render(incident(), {
      history: [
        {
          id: "h-1",
          from_status: "open",
          to_status: "investigating",
          notes: "Looking into it",
          created_at: "2026-10-17T09:00:00Z",
          actor_name: "Fatima",
        },
      ],
    });

    expect(html).toContain("Status history");
    expect(html).toContain("History retained permanently. No delete action.");
    expect(html).toContain("Fatima");
    expect(html).toContain("Looking into it");
  });
});
