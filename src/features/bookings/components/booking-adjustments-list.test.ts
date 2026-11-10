import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BookingAdjustmentsList } from "@/features/bookings/components/booking-adjustments-list";
import type { BookingAdjustmentRow } from "@/features/bookings/lib/get-booking-adjustments";

const adjustment = (overrides: Partial<BookingAdjustmentRow> = {}): BookingAdjustmentRow => ({
  id: "a-1",
  type: "partial_refund",
  amount: 20,
  reason: "Early return refund",
  created_at: "2026-10-24T12:15:00.000Z",
  after_settlement: false,
  creator: { full_name: "Priya Nair" },
  ...overrides,
});

const render = (adjustments: BookingAdjustmentRow[]) =>
  renderToStaticMarkup(createElement(BookingAdjustmentsList, { adjustments, timeZone: "Asia/Dubai", action: "ADD_BUTTON" }));

describe("BookingAdjustmentsList", () => {
  it("should say no adjustment has been recorded when there is none (AC05)", () => {
    const html = render([]);

    expect(html).toContain("No adjustment has been recorded");
    expect(html).toContain("ADD_BUTTON");
  });

  it("should show the date in the airport time zone, the type label, a negative amount, the reason and who created it (AC04)", () => {
    const html = render([adjustment()]);

    expect(html).toContain("24 Oct 2026 · 16:15 GST · Asia/Dubai");
    expect(html).toContain(">Refund<");
    expect(html).toMatch(/text-danger-fg[^>]*>-20\.00</);
    expect(html).toContain("Early return refund");
    expect(html).toContain("Priya Nair");
  });

  it("should show the net of all adjustments in the heading and group the two refunds as Refund", () => {
    const html = render([adjustment(), adjustment({ id: "a-2", type: "full_refund", amount: 5 }), adjustment({ id: "a-3", type: "chargeback", amount: 10 })]);

    expect(html).toContain("Adjustments · Net -USD 35.00");
    expect(html.match(/>Refund</g)).toHaveLength(2);
    expect(html).toContain(">Chargeback<");
  });

  it("should name the currency in the Amount column", () => {
    expect(render([adjustment()])).toContain("Amount (USD)");
  });

  it("should show a dash when the user who recorded it was removed", () => {
    expect(render([adjustment({ creator: null })])).toMatch(/data-label="Created by"[^>]*>-</);
  });
});
