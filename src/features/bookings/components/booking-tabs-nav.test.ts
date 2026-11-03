import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BookingTabsNav } from "@/features/bookings/components/booking-tabs-nav";

describe("BookingTabsNav", () => {
  it("should show the four tabs in order and mark only the open one as current", () => {
    const html = renderToStaticMarkup(createElement(BookingTabsNav, { bookingId: "b1", active: "workflow" }));

    expect(html.indexOf("Overview")).toBeLessThan(html.indexOf("Workflow"));
    expect(html.indexOf("Workflow")).toBeLessThan(html.indexOf("Flight"));
    expect(html.indexOf("Flight")).toBeLessThan(html.indexOf("Timeline"));
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="page"[^>]*>Workflow</);
  });

  it("should link each tab to its page", () => {
    const html = renderToStaticMarkup(createElement(BookingTabsNav, { bookingId: "b1", active: "workflow" }));

    expect(html).toContain('href="/bookings/b1"');
    expect(html).toContain('href="/bookings/b1/workflow"');
    expect(html).toContain('href="/bookings/b1?tab=flight"');
    expect(html).toContain('href="/bookings/b1?tab=timeline"');
  });
});
