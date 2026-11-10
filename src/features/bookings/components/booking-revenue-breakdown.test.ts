import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BookingRevenueBreakdown } from "@/features/bookings/components/booking-revenue-breakdown";
import type { BookingRevenueView } from "@/features/bookings/lib/booking-revenue";

const render = (view: BookingRevenueView) => renderToStaticMarkup(createElement(BookingRevenueBreakdown, { view }));

describe("BookingRevenueBreakdown", () => {
  it("should show the empty state with the reason", () => {
    const html = render({ state: "empty", message: "There is no revenue yet: the rental is not completed." });

    expect(html).toContain("No revenue yet");
    expect(html).toContain("the rental is not completed");
  });

  it("should show the lines in two columns, a negative amount in the danger color, and the formula", () => {
    const html = render({
      state: "ready",
      caseLabel: "Standard rental",
      notices: ["A notice."],
      card: {
        left: [{ label: "Refund", value: "-20.00", negative: true }],
        right: [{ label: "Net revenue", value: "100.00" }],
        formula: ["How this is calculated: min(8, 6) × 20.00 = 100.00"],
      },
    });

    expect(html).toContain("Revenue breakdown · Verified amounts · USD");
    expect(html).toContain("A notice.");
    expect(html).toMatch(/text-danger-fg[^>]*>-20\.00</);
    expect(html).toContain("tabular-nums");
    expect(html).toContain("How this is calculated");
  });
});
