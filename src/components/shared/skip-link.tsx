/** The id of the main landmark, which the skip link leads to. */
export const MAIN_CONTENT_ID = "main-content";

/**
 * UI-F02-S05 (spec R12): the first thing a keyboard user can reach on a page. It stays out of
 * sight until it has focus, then moves focus to the main content so the menus can be skipped.
 */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-2 focus:outline-offset-2 focus:outline-ring"
    >
      Skip to content
    </a>
  );
}
