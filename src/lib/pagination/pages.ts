/**
 * Pure page-list logic for the Pagination component (UI-F03-S03): which page numbers to show,
 * with an ellipsis where a run of pages is left out. The first and last page always show.
 */

export type PageItem = number | "ellipsis-start" | "ellipsis-end";

export function buildPageItems(current: number, total: number, siblings = 1): PageItem[] {
  const last = Math.max(1, Math.floor(total));
  const page = Math.min(Math.max(1, Math.floor(current)), last);

  // first + last + current + 2 siblings + 2 ellipsis slots
  const slots = siblings * 2 + 5;
  if (last <= slots) return Array.from({ length: last }, (_, i) => i + 1);

  const showStartEllipsis = page - siblings > 3;
  const showEndEllipsis = page + siblings < last - 2;
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const edge = 3 + siblings * 2; // pages shown next to an end, so the list keeps the same length

  if (!showStartEllipsis) return [...range(1, edge), "ellipsis-end", last];
  if (!showEndEllipsis) return [1, "ellipsis-start", ...range(last - edge + 1, last)];
  return [1, "ellipsis-start", ...range(page - siblings, page + siblings), "ellipsis-end", last];
}
