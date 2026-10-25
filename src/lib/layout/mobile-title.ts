import { DASHBOARD_ROUTE } from "@/lib/constants/routes";
import type { Crumb } from "@/lib/layout/breadcrumb";

export interface MobileAppBar {
  title: string;
  /** Where the back arrow goes, or `null` on a top-level page, which has no arrow. */
  backHref: string | null;
}

/**
 * UI-F02-S03 (spec R7): the app bar of a phone, from the crumbs of the page. The title is the last
 * crumb; a page below an area (a detail, a new or an edit page) also gets a back arrow to the
 * crumb above it, or to the dashboard when that crumb has no page of its own.
 */
export function buildMobileAppBar(crumbs: Crumb[]): MobileAppBar {
  const last = crumbs.at(-1);
  if (!last) return { title: "Airport Operations", backHref: null };
  if (crumbs.length < 2) return { title: last.label, backHref: null };

  return { title: last.label, backHref: crumbs[crumbs.length - 2].href ?? DASHBOARD_ROUTE };
}
