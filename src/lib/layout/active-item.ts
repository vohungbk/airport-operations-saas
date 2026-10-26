/** A page is under an address when it is that address or below it. */
export function isUnderHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * The item of a menu that marks the current page: the one with the longest address that the page
 * is under. `/partner/seats` is under both `/partner` and `/partner/seats`; only the second marks
 * it. `null` when the page is under none of them.
 */
export function findActiveHref(
  pathname: string,
  items: ReadonlyArray<{ href: string }>,
): string | null {
  let active: string | null = null;
  for (const { href } of items) {
    if (isUnderHref(pathname, href) && (active === null || href.length > active.length)) {
      active = href;
    }
  }
  return active;
}
