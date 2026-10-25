/**
 * UI-F02-S02 (spec R3): the breadcrumb of the top bar, from the path of the page. Pure; the path
 * is the only input, so there is no query for a booking number or a seat name: a page that
 * belongs to one record shows "Details".
 */
export interface Crumb {
  label: string;
  /** Where the crumb leads, or `null` for the current page and for a place that has no page. */
  href: string | null;
}

interface NavLabel {
  href: string;
  label: string;
}

const KNOWN_SEGMENTS: Record<string, string> = {
  new: "New",
  edit: "Edit",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A segment that names one record: an id, a number or a long token. */
function isRecordSegment(segment: string): boolean {
  return UUID.test(segment) || /^\d+$/.test(segment) || (segment.length >= 20 && /\d/.test(segment));
}

/** `seat-categories` becomes `Seat categories`. */
function humanize(segment: string): string {
  const words = segment.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function labelOf(segment: string): string {
  if (KNOWN_SEGMENTS[segment]) return KNOWN_SEGMENTS[segment];
  return isRecordSegment(segment) ? "Details" : humanize(segment);
}

/**
 * The crumbs of a path, first the area (named as in the menu), then each step below it. The
 * last one is the current page and has no link. Every other crumb links to its own path, except
 * when the area is not in the menu: then nothing is known about its pages, so nothing links.
 */
export function buildBreadcrumb(pathname: string, menu: NavLabel[]): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  const areaHref = `/${segments[0]}`;
  const area = menu.find((item) => item.href === areaHref);

  return segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isLast = index === segments.length - 1;
    return {
      label: index === 0 ? (area?.label ?? humanize(segment)) : labelOf(segment),
      href: isLast || !area ? null : href,
    };
  });
}
