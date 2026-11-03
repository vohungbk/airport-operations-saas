import { describe, expect, it } from "vitest";

import { BOOKING_TABS, buildBookingTabHref, resolveBookingPageTab } from "@/features/bookings/lib/booking-tabs";

describe("BOOKING_TABS", () => {
  it("should list the tabs in the order of the design", () => {
    expect(BOOKING_TABS).toEqual(["overview", "workflow", "flight", "timeline"]);
  });
});

describe("buildBookingTabHref", () => {
  it.each([
    ["overview", "/bookings/b1"],
    ["workflow", "/bookings/b1/workflow"],
    ["flight", "/bookings/b1?tab=flight"],
    ["timeline", "/bookings/b1?tab=timeline"],
  ] as const)("should give the address of the %s tab", (tab, href) => {
    expect(buildBookingTabHref("b1", tab)).toBe(href);
  });
});

describe("resolveBookingPageTab", () => {
  it.each(["flight", "timeline"])("should open the %s tab named in the address", (tab) => {
    expect(resolveBookingPageTab(tab)).toBe(tab);
  });

  it.each([undefined, "", "overview", "workflow", "revenue", "<script>"])(
    "should open Overview for %s",
    (value) => {
      expect(resolveBookingPageTab(value)).toBe("overview");
    },
  );

  it("should read the first value when the tab is repeated", () => {
    expect(resolveBookingPageTab(["timeline", "flight"])).toBe("timeline");
  });
});
