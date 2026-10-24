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

  it("should show every line as a label and a value", () => {
    const html = render({
      state: "ready",
      caseLabel: "Standard rental",
      notices: [],
      lines: [
        { label: "Gross revenue", value: "450.00" },
        { label: "Partner share", value: "135.00 (30%)" },
      ],
    });

    expect(html).toContain("Gross revenue");
    expect(html).toContain("450.00");
    expect(html).toContain("135.00 (30%)");
  });

  it("should show each notice", () => {
    const html = render({
      state: "ready",
      caseLabel: "Cancelled",
      notices: ["This booking was cancelled, so it is not charged."],
      lines: [{ label: "Case", value: "Cancelled" }],
    });

    expect(html).toContain("so it is not charged");
  });

  it("should show Add adjustment when given where it leads, and not otherwise (VI-F04-S09)", () => {
    const view: BookingRevenueView = { state: "ready", caseLabel: "Standard rental", notices: [], lines: [{ label: "Case", value: "Standard rental" }] };

    const withLink = renderToStaticMarkup(createElement(BookingRevenueBreakdown, { view, adjustmentHref: "/bookings/b-1/adjustment" }));

    expect(withLink).toContain('href="/bookings/b-1/adjustment"');
    expect(withLink).toContain(">Add adjustment<");
    expect(render(view)).not.toContain("Add adjustment");
  });

  it("should not show Add adjustment in the empty state", () => {
    const html = renderToStaticMarkup(createElement(BookingRevenueBreakdown, { view: { state: "empty", message: "No." }, adjustmentHref: "/x" }));

    expect(html).not.toContain("Add adjustment");
  });

  it("should be read only: no field, button or form", () => {
    const html = render({ state: "ready", caseLabel: "Standard rental", notices: [], lines: [{ label: "Case", value: "Standard rental" }] });

    expect(html).not.toMatch(/<input|<button|<form|<textarea/);
  });
});
