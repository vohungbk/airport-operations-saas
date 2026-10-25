import type { Role } from "@/lib/auth/roles";

/**
 * UI-F02-S03 (spec R5, R6): the bottom navigation of a phone has five slots: four items of the
 * role and More. This picks the four and leaves the rest for the More sheet. Which four is spec
 * question Q3; the lists below are the proposal, one list per role, in the order they show.
 * A role that cannot open an item skips it, so these lists never grant anything: the menu given
 * to this function is already the menu of the role.
 */
export const MAX_BOTTOM_ITEMS = 4;

export const MOBILE_NAV_PRIORITY: Record<Role, readonly string[]> = {
  admin: ["/dashboard", "/bookings", "/jobs", "/incidents"],
  operations_manager: ["/dashboard", "/bookings", "/jobs", "/incidents"],
  technician: ["/technician", "/jobs", "/incidents", "/dashboard"],
  // /dashboard is left out: it sends a partner user on to /partner.
  partner_user: ["/partner", "/bookings", "/incidents", "/settlements"],
};

export interface MobileNavSplit<T> {
  /** The items of the bar, in the order of the priority list. */
  bottom: T[];
  /** The other items, in the order of the menu. */
  more: T[];
}

/**
 * Splits the menu of a role into the bar and the More sheet. If the priority list gives fewer
 * than four items the bar is filled from the rest of the menu, in menu order.
 */
export function splitMobileNav<T extends { href: string }>(
  menu: T[],
  role: Role,
): MobileNavSplit<T> {
  const byHref = new Map(menu.map((item) => [item.href, item]));
  const bottom = MOBILE_NAV_PRIORITY[role].flatMap((href) => byHref.get(href) ?? []);

  const chosen = new Set(bottom.slice(0, MAX_BOTTOM_ITEMS).map((item) => item.href));
  for (const item of menu) {
    if (chosen.size >= MAX_BOTTOM_ITEMS) break;
    chosen.add(item.href);
  }

  return {
    bottom: [...chosen].map((href) => byHref.get(href)!),
    more: menu.filter((item) => !chosen.has(item.href)),
  };
}
