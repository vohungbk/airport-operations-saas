import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PARTNER_FINANCE_HREF,
  PARTNER_FINANCE_RELEASED,
  PARTNER_HOME_ITEMS,
  buildPartnerHomeItems,
  getPartnerHomeItems,
} from "@/features/partners/lib/partner-home-items";
import { hasPermission } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";

const APP_DIR = join(process.cwd(), "src", "app");

/** The routes of the pages under src/app, with the route groups left out. */
function pageRoutes(dir = APP_DIR, route = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) {
      const segment = /^\(.*\)$/.test(name) ? "" : `/${name}`;
      return pageRoutes(path, route + segment);
    }

    return name === "page.tsx" ? [route || "/"] : [];
  });
}

describe("PARTNER_HOME_ITEMS", () => {
  it("should lead to the bookings list, the partner seats view and, not yet, finance", () => {
    expect(PARTNER_HOME_ITEMS.map((item) => [item.id, item.href])).toEqual([
      ["bookings", "/bookings"],
      ["seats", "/partner/seats"],
      ["finance", null],
    ]);
  });

  it("should not link a view to the admin seats area, which a partner user cannot open", () => {
    for (const item of PARTNER_HOME_ITEMS) {
      expect(item.href ?? "").not.toMatch(/^\/seats/);
    }
  });

  it("should not link to any page that does not exist", () => {
    const routes = pageRoutes();

    for (const item of PARTNER_HOME_ITEMS) {
      if (item.href !== null) {
        expect(routes, item.href).toContain(item.href);
      }
    }
  });
});

describe("partner finance (VI-F03-S06)", () => {
  it("should not be released: VI-F04 has no screen yet, so the finance card has no link", () => {
    const finance = PARTNER_HOME_ITEMS.find((item) => item.id === "finance");

    expect(PARTNER_FINANCE_RELEASED).toBe(false);
    expect(finance?.href).toBeNull();
  });

  it("should not have a finance page or route for a partner user to open yet", () => {
    const routes = pageRoutes();

    expect(routes.filter((route) => /finance/i.test(route))).toEqual([]);
  });

  it("should link the finance card, and only then, once finance is released", () => {
    const released = buildPartnerHomeItems({ finance: true });
    const notReleased = buildPartnerHomeItems({ finance: false });

    expect(released.find((item) => item.id === "finance")?.href).toBe(PARTNER_FINANCE_HREF);
    expect(notReleased.find((item) => item.id === "finance")?.href).toBeNull();
  });

  it("should offer the finance card only to a role that holds finance:view_own_partner", () => {
    for (const role of ROLES) {
      const ids = getPartnerHomeItems(role).map((item) => item.id);

      expect(ids.includes("finance"), role).toBe(
        hasPermission(role, "finance:view_own_partner"),
      );
    }
    expect(getPartnerHomeItems("technician")).toEqual([]);
    expect(getPartnerHomeItems("operations_manager")).toEqual([]);
  });
});
