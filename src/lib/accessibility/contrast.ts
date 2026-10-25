/**
 * UI-F01-S02 (spec R7): contrast of the colors the application draws with. Test support only;
 * nothing in the app imports it. It reads the hex values of the tokens in
 * `src/app/globals.css` and checks the pairs below against WCAG 2.2: 4.5:1 for text and 3:1 for
 * the parts of a control or a chart.
 */

export const TEXT_MIN_RATIO = 4.5;
export const UI_MIN_RATIO = 3;

export interface ColorPair {
  /** Token name of the color drawn on top, without `--`. */
  foreground: string;
  /** Token name of the color it sits on. */
  background: string;
}

const pair = (foreground: string, background: string): ColorPair => ({ foreground, background });

/**
 * Text on its background. A pair that no component draws is not listed: the alias
 * `info-foreground` on `info` is 4.1:1 in Light and is left out because nothing uses it, and the
 * other `*-foreground` aliases are left out for the same reason. `border` and `chart-grid` are
 * plain rules, not information, and are not checked.
 */
export const TEXT_PAIRS: ColorPair[] = [
  pair("text", "background"),
  pair("text", "surface"),
  pair("text", "surface-elevated"),
  pair("text", "surface-muted"),
  pair("text-muted", "background"),
  pair("text-muted", "surface"),
  pair("text-muted", "surface-elevated"),
  pair("text-muted", "surface-muted"),
  pair("primary", "background"),
  pair("primary", "surface"),
  pair("primary-foreground", "primary"),
  pair("primary-foreground", "primary-hover"),
  pair("primary-foreground", "secondary"),
  pair("primary-subtle-foreground", "primary-subtle"),
  pair("success-fg", "success-bg"),
  pair("warning-fg", "warning-bg"),
  pair("danger-fg", "danger-bg"),
  pair("info-fg", "info-bg"),
  pair("neutral-fg", "neutral-bg"),
  pair("success-fg", "surface"),
  pair("warning-fg", "surface"),
  pair("danger-fg", "surface"),
  pair("info-fg", "surface"),
];

/** Control borders, the focus ring, status marks and chart colors on a card. */
export const UI_PAIRS: ColorPair[] = [
  pair("border-input", "background"),
  pair("border-input", "surface"),
  pair("focus-ring", "background"),
  pair("focus-ring", "surface"),
  pair("success", "surface"),
  pair("warning", "surface"),
  pair("danger", "surface"),
  pair("info", "surface"),
  pair("chart-1", "surface"),
  pair("chart-2", "surface"),
  pair("chart-3", "surface"),
  pair("chart-4", "surface"),
  pair("chart-5", "surface"),
  pair("chart-6", "surface"),
];

function channels(hex: string): [number, number, number] {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`Not a 6-digit hex color: ${hex}`);
  }
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** Relative luminance as WCAG defines it, from 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio of two colors, from 1 (same color) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export interface PairResult extends ColorPair {
  ratio: number;
}

/** The ratio of each pair, in the order given. A token that is missing throws. */
export function measurePairs(colors: Map<string, string>, pairs: ColorPair[]): PairResult[] {
  const colorOf = (token: string) => {
    const hex = colors.get(token);
    if (!hex) throw new Error(`Token --${token} is not defined as a color`);
    return hex;
  };
  return pairs.map((p) => ({
    ...p,
    ratio: contrastRatio(colorOf(p.foreground), colorOf(p.background)),
  }));
}
