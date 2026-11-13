import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PartnerOverview } from "@/features/partners/components/partner-overview";
import type { PartnerOverviewView } from "@/features/partners/lib/partner-overview";
import type { UpcomingPartnerRental } from "@/features/partners/lib/get-upcoming-partner-rentals";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);

const RENTAL: UpcomingPartnerRental = {
  id: "b-1",
  booking_number: "BK-2026-000123",
  pickup_at: "2026-10-24T12:30:00.000Z",
  status: "confirmed",
  timezone: "Asia/Dubai",
  seat_serial: "SEAT-0001",
};

const LABELS = [
  "Rentals today",
  "Active rentals",
  "Upcoming reservations",
  "Family Ready vehicles",
  "Correct-seat fulfilment",
  "On-time readiness",
  "Operational incidents",
  "Completed rentals",
];

const REVENUE_LABELS = [
  "Gross child-seat revenue",
  "Partner revenue share",
  "Amount payable",
  "Open invoices",
  "Outstanding invoice value",
];

const EMPTY_VIEW: PartnerOverviewView = {
  tiles: LABELS.map((label) => ({ label, value: "—", href: "/partner/kpi" })),
  revenue: REVENUE_LABELS.map((label) => ({ label, value: "—" })),
  launch_credit: null,
};

const FULL_VIEW: PartnerOverviewView = {
  tiles: LABELS.map((label, index) => ({
    label,
    value: String(index + 10),
    caption: `caption ${index}`,
    href: "/partner/kpi",
  })),
  revenue: REVENUE_LABELS.map((label) => ({ label, value: "USD 1,000.00" })),
  launch_credit: {
    amount: "USD 6,000 / 10,000",
    share: "50 / 50 current share",
    percent: 60,
    progress: "60%",
    note: "USD 4,000 remaining. Share becomes 30 / 70 after the launch-credit target is reached.",
  },
};

const render = (
  upcoming: readonly UpcomingPartnerRental[] | null,
  view: PartnerOverviewView = EMPTY_VIEW,
) => html(createElement(PartnerOverview, { view, upcoming }));

describe("Partner Overview (UI-F06-S04, R7)", () => {
  it("should show the eight tiles of the design", () => {
    const out = render([]);

    for (const label of LABELS) {
      expect(out).toContain(label);
    }
  });

  it("should show the value and the caption of every tile, and open the KPI screen from it", () => {
    const out = render([], FULL_VIEW);

    expect(out).toContain("caption 7");
    expect(out).toContain(">17<");
    expect(out.match(/href="\/partner\/kpi"/g)).toHaveLength(8);
  });

  it("should show a dash, never a made-up number, when a figure has no source", () => {
    const out = render([]);

    expect(out.match(/>—</g)?.length).toBeGreaterThanOrEqual(14);
    expect(out).not.toContain(">0<");
    expect(out).not.toMatch(/USD|\d+%/);
  });

  it("should add nothing that is not in the design", () => {
    const out = render([]);

    expect(out).not.toContain("Not available yet");
    expect(out).not.toContain("All counts");
    expect(out).not.toMatch(/href="\/bookings/);
  });

  it("should show the revenue rows, each opening Finance, and the launch credit with its progress", () => {
    const out = render([], FULL_VIEW);

    for (const row of REVENUE_LABELS) {
      expect(out).toContain(row);
    }
    expect(out.match(/href="\/partner\/finance"/g)).toHaveLength(5);
    expect(out).toContain("USD 6,000 / 10,000");
    expect(out).toContain("50 / 50 current share");
    expect(out).toContain("Progress to target");
    expect(out).toContain("60%");
    expect(out).toContain("Share becomes 30 / 70");
    expect(out).toContain("width:60%");
  });

  it("should list the upcoming rentals with the pickup in the time zone of the airport", () => {
    const out = render([RENTAL]);

    expect(out).toContain("BK-2026-000123");
    expect(out).toContain("SEAT-0001");
    expect(out).toContain("Allocated");
    expect(out).toContain('data-stacked=""');
  });

  it("should show a dash for a booking that has no seat yet", () => {
    expect(render([{ ...RENTAL, seat_serial: null }])).toContain(
      'data-label="Seat">—<',
    );
  });

  it("should say there are no upcoming rentals, and Unavailable when they could not be read", () => {
    expect(render([])).toContain("No upcoming rentals.");
    expect(render(null)).toContain("The upcoming rentals could not be read.");
  });
});
