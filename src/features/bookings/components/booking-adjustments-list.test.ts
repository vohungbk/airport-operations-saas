import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BookingAdjustmentsList } from "@/features/bookings/components/booking-adjustments-list";
import type { BookingAdjustmentRow } from "@/features/bookings/lib/get-booking-adjustments";

const row = (id: string, type: BookingAdjustmentRow["type"], amount: number, reason: string): BookingAdjustmentRow => ({
  id,
  type,
  amount,
  reason,
  created_at: "2026-10-24T10:30:00Z",
});

const render = (adjustments: BookingAdjustmentRow[]) =>
  renderToStaticMarkup(createElement(BookingAdjustmentsList, { adjustments }));

describe("BookingAdjustmentsList", () => {
  it("should say no adjustment has been recorded when the list is empty", () => {
    expect(render([])).toContain("No adjustment has been recorded");
  });

  it("should list each adjustment with its type, amount taken off, reason and date", () => {
    const html = render([row("a", "chargeback", 20.5, "The bank took it back"), row("b", "partial_refund", 50, "Worn")]);

    expect(html).toContain("Chargeback: -20.50");
    expect(html).toContain("The bank took it back");
    expect(html).toContain("Partial refund: -50.00");
    expect(html).toContain("2026-10-24");
  });

  it("should be read only: no field, button or form", () => {
    expect(render([row("a", "chargeback", 20, "x")])).not.toMatch(/<input|<button|<form|<textarea/);
  });
});
