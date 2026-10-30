import { describe, expect, it } from "vitest";

import { getVisibleNavItems, NAV_ITEMS, ROLE_MENUS } from "@/config/nav";
import { ROLES } from "@/lib/auth/roles";
import {
  MAX_BOTTOM_ITEMS,
  MOBILE_NAV_PRIORITY,
  splitMobileNav,
} from "@/lib/layout/mobile-nav";

const menuOf = (role: Parameters<typeof getVisibleNavItems>[0]) =>
  getVisibleNavItems(role).map(({ href, label, planned }) => ({ href, label, planned }));

describe("splitMobileNav", () => {
  it("should put at most four items in the bar, so five slots with More", () => {
    for (const role of ROLES) {
      expect(splitMobileNav(menuOf(role), role).bottom.length).toBeLessThanOrEqual(MAX_BOTTOM_ITEMS);
    }
    expect(MAX_BOTTOM_ITEMS).toBe(4);
  });

  it("should give the operations manager the bar of the priority list and the rest in More", () => {
    const { bottom, more } = splitMobileNav(menuOf("operations_manager"), "operations_manager");

    expect(bottom.map((i) => i.href)).toEqual(["/dashboard", "/bookings", "/jobs", "/incidents"]);
    expect(more.map((i) => i.href)).toEqual([
      "/admin",
      "/seats",
      "/seat-categories",
      "/airports",
      "/partners",
      "/technicians",
      "/return-queue",
      "/flights",
      "/settlements",
      "/invoices",
      "/reports",
      "/import",
      "/settings",
    ]);
  });

  it("should put every item of the menu in the bar or in More, once", () => {
    for (const role of ROLES) {
      const menu = menuOf(role);
      const { bottom, more } = splitMobileNav(menu, role);
      const all = [...bottom, ...more].map((i) => i.href);

      expect([...all].sort()).toEqual(menu.map((i) => i.href).sort());
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it("should keep My History, whose page is not built yet, out of the bar of a technician and in More", () => {
    const { bottom, more } = splitMobileNav(menuOf("technician"), "technician");

    expect(bottom.map((i) => i.href)).toEqual(["/technician", "/technician/scan", "/incidents"]);
    expect(more.map((i) => i.href)).toEqual(["/technician/history"]);
  });

  it("should not fill a free slot of the bar with an item whose page is not built yet", () => {
    const menu = [
      { href: "/bookings", label: "Bookings" },
      { href: "/flights", label: "Flights", planned: true as const },
      { href: "/seats", label: "Seats" },
    ];
    const { bottom, more } = splitMobileNav(menu, "operations_manager");

    expect(bottom.map((i) => i.href)).toEqual(["/bookings", "/seats"]);
    expect(more.map((i) => i.href)).toEqual(["/flights"]);
  });

  it("should put the first four items of the partner menu in the bar and the rest in More", () => {
    const { bottom, more } = splitMobileNav(menuOf("partner_user"), "partner_user");

    expect(bottom.map((i) => i.href)).toEqual(["/partner", "/bookings", "/partner/seats", "/partner/finance"]);
    expect(more.map((i) => i.href)).toEqual(["/invoices", "/partner/kpi", "/partner/roi", "/partner/assistant"]);
  });

  it("should skip a priority item that the menu does not have", () => {
    const menu = [
      { href: "/bookings", label: "Bookings" },
      { href: "/seats", label: "Seats" },
    ];
    const { bottom, more } = splitMobileNav(menu, "operations_manager");

    expect(bottom.map((i) => i.href)).toEqual(["/bookings", "/seats"]);
    expect(more).toEqual([]);
  });

  it("should fill the bar from the menu in menu order when the priority list gives too few", () => {
    const menu = [
      { href: "/airports", label: "Airports" },
      { href: "/bookings", label: "Bookings" },
      { href: "/seats", label: "Seats" },
      { href: "/partners", label: "Partners" },
      { href: "/technicians", label: "Technicians" },
    ];
    const { bottom, more } = splitMobileNav(menu, "operations_manager");

    expect(bottom.map((i) => i.href)).toEqual(["/bookings", "/airports", "/seats", "/partners"]);
    expect(more.map((i) => i.href)).toEqual(["/technicians"]);
  });

  it("should give nothing for an empty menu", () => {
    expect(splitMobileNav([], "admin")).toEqual({ bottom: [], more: [] });
  });
});

describe("MOBILE_NAV_PRIORITY", () => {
  it("should have a list for every role", () => {
    expect(Object.keys(MOBILE_NAV_PRIORITY).sort()).toEqual([...ROLES].sort());
  });

  it("should only name pages that the menu of the role has", () => {
    for (const role of ROLES) {
      const hrefs = new Set((ROLE_MENUS[role] ?? NAV_ITEMS).map((item) => item.href));

      for (const href of MOBILE_NAV_PRIORITY[role]) expect(hrefs.has(href), `${role}: ${href}`).toBe(true);
    }
  });

  it("should name at most four pages for each role", () => {
    for (const list of Object.values(MOBILE_NAV_PRIORITY)) {
      expect(list.length).toBeLessThanOrEqual(MAX_BOTTOM_ITEMS);
    }
  });
});
