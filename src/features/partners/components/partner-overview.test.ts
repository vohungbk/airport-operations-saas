import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PartnerOverview } from "@/features/partners/components/partner-overview";
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

const render = (upcoming: readonly UpcomingPartnerRental[] | null) =>
  html(createElement(PartnerOverview, { upcoming }));

describe("Partner Overview (UI-F06-S04, R7)", () => {
  it("should show the eight tiles of the design", () => {
    const out = render([]);

    for (const label of [
      "Rentals today",
      "Active rentals",
      "Upcoming reservations",
      "Family Ready vehicles",
      "Correct-seat fulfilment",
      "On-time readiness",
      "Operational incidents",
      "Completed rentals",
    ]) {
      expect(out).toContain(label);
    }
  });

  it("should show a dash, never a made-up number, in the tiles, the revenue rows and the launch credit", () => {
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

  it("should lay out Revenue and invoices and Launch credit, with no figure made up", () => {
    const out = render([]);

    for (const row of [
      "Gross child-seat revenue",
      "Partner revenue share",
      "Amount payable",
      "Open invoices",
      "Outstanding invoice value",
    ]) {
      expect(out).toContain(row);
    }
    expect(out).toContain("Launch credit");
    expect(out).toContain("Progress to target");
  });

  it("should list the upcoming rentals with the pickup in the time zone of the airport", () => {
    const out = render([RENTAL]);

    expect(out).toContain("BK-2026-000123");
    expect(out).toContain("SEAT-0001");
    expect(out).toContain("Confirmed");
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
