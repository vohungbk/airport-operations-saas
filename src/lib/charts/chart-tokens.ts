/**
 * The colors a chart may use (UI-F05-S01, spec R7, R8): the six chart tokens and the grid token of
 * `globals.css`, which have a Light and a Dark value. A chart names the token, never a color, so a
 * theme change needs no change here.
 */

export const CHART_COLOR_COUNT = 6;

export const CHART_COLORS = [1, 2, 3, 4, 5, 6].map((n) => `var(--chart-${n})`);

export const CHART_GRID_COLOR = "var(--chart-grid)";

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** The color of a series. After the sixth series the colors start again. */
export function seriesColor(index: number): string {
  return CHART_COLORS[mod(index, CHART_COLOR_COUNT)];
}

export const SERIES_PATTERNS = ["solid", "diagonal", "dots", "cross", "vertical", "horizontal"] as const;
export type SeriesPattern = (typeof SERIES_PATTERNS)[number];

export const SERIES_MARKERS = ["circle", "square", "triangle", "diamond", "cross", "star"] as const;
export type SeriesMarker = (typeof SERIES_MARKERS)[number];

/**
 * A pattern for each series, so neighbouring series differ by more than color (R7). The pattern
 * moves on by one each time the colors start again, so a seventh series does not look like the first.
 */
export function seriesPattern(index: number): SeriesPattern {
  return SERIES_PATTERNS[mod(index + Math.floor(Math.max(index, 0) / CHART_COLOR_COUNT), SERIES_PATTERNS.length)];
}

export function seriesMarker(index: number): SeriesMarker {
  return SERIES_MARKERS[mod(index, SERIES_MARKERS.length)];
}
