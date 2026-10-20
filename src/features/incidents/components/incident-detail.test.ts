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
    seat: { serial_number: "SN-2" },
    booking: { booking_number: "BK-00002" },
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
  } = {},
) {
  return renderToStaticMarkup(
    createElement(IncidentDetail, {
      incident: item,
      history: options.history === undefined ? [] : options.history,
      historyTruncated: options.historyTruncated ?? false,
      showStaffDetails: options.showStaffDetails ?? true,
      allowedStatuses: options.allowedStatuses ?? [],
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

  it("should leave out the staff names and the job link for a partner user", () => {
    const html = render(
      incident({
        resolver: { full_name: "Fatima" },
        resolved_at: "2026-10-18T10:00:00Z",
      }),
      { showStaffDetails: false },
    );

    expect(html).toContain("Emirates Rent A Car");
    expect(html).toContain("SN-2");
    expect(html).not.toContain("Ahmed");
    expect(html).not.toContain("Fatima");
    expect(html).not.toContain("Reported by");
    expect(html).not.toContain("Resolved by");
    expect(html).not.toContain('href="/jobs/');
  });

  it("should leave out the history when the user may not read it", () => {
    const html = render(incident(), { history: null });

    expect(html).not.toContain("History");
    expect(html).not.toContain("No changes recorded.");
  });

  it("should offer Update status when the user has a permitted transition", () => {
    expect(render(incident(), { allowedStatuses: ["resolved"] })).toContain(
      "Update status",
    );
  });

  it("should not offer Update status when there is no permitted transition", () => {
    expect(render(incident({ status: "closed" }))).not.toContain(
      "Update status",
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

    expect(html).toContain("History");
    expect(html).toContain("Fatima");
    expect(html).toContain("Looking into it");
  });
});
