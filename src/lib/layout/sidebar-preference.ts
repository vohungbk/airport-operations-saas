import { z } from "zod";

/**
 * UI-F02-S01 (spec R2): whether the desktop sidebar is collapsed to icons is kept in a cookie,
 * so the server can draw the page at the right width on the first paint. It holds `1` or `0`
 * and nothing else; it is a look, not a permission, and the server checks access on every request.
 */
export const SIDEBAR_COOKIE = "sidebar_collapsed";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

const sidebarCookieSchema = z.enum(["1", "0"]);

/**
 * Expanded (256 px) and collapsed (72 px: 18 steps of the 4 px spacing grid). Both apply from
 * the md breakpoint, where the sidebar shows; below it the sidebar is hidden.
 */
export const SIDEBAR_WIDTH_CLASS = {
  expanded: "md:w-64",
  collapsed: "md:w-18",
} as const;

/** The saved choice. A missing or invalid value means expanded. */
export function parseSidebarCollapsed(raw: string | null | undefined): boolean {
  const parsed = sidebarCookieSchema.safeParse(raw);
  return parsed.success && parsed.data === "1";
}

/** The `document.cookie` string that keeps the choice for a year, on every page of the site. */
export function sidebarCookie(collapsed: boolean): string {
  return `${SIDEBAR_COOKIE}=${collapsed ? "1" : "0"}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`;
}
