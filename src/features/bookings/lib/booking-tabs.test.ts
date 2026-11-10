import { describe, expect, it } from "vitest";

import {
  BOOKING_TABS,
  buildBookingRevenueHref,
  buildBookingTabHref,
  getBookingPageTitle,
  getBookingTabBar,
  resolveBookingPageTab,
} from "@/features/bookings/lib/booking-tabs";

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
  it.each(["flight", "timeline", "photos"])("should open the %s tab named in the address", (tab) => {
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

describe("getBookingPageTitle", () => {
  it("should name the Flight tab in the heading, as the design does", () => {
    expect(getBookingPageTitle("flight")).toBe("Booking detail · Flight");
  });

  it("should keep the plain heading for the other tabs", () => {
    expect(getBookingPageTitle("overview")).toBe("Booking detail");
    expect(getBookingPageTitle("timeline")).toBe("Booking detail");
  });
});

describe("getBookingTabBar", () => {
  it("should list Overview, Flight, Revenue, Timeline and Photos in order when revenue is allowed", () => {
    expect(getBookingTabBar(true).map((tab) => tab.label)).toEqual(["Overview", "Flight", "Revenue", "Timeline", "Photos"]);
  });

  it("should leave out Revenue when the role may not see the revenue", () => {
    expect(getBookingTabBar(false).map((tab) => tab.value)).toEqual(["overview", "flight", "timeline", "photos"]);
  });

  it("should give the revenue page of the booking", () => {
    expect(buildBookingRevenueHref("b1")).toBe("/bookings/b1/revenue");
  });
});
