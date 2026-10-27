import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { UI_MIN_RATIO, contrastRatio } from "@/lib/accessibility/contrast";
import { readBlock, readDeclarations } from "@/lib/accessibility/token-css";

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
const light = readDeclarations(readBlock(css, ":root"));
const dark = readDeclarations(readBlock(css, ".dark"));
const themes = { Light: light, Dark: dark } as const;

const SERIES = [1, 2, 3, 4, 5, 6].map((n) => `chart-${n}`);

/**
 * The marks cut into a patterned fill are drawn in the grid color (UI-F05-S04, spec R7, R8, E7), so the
 * grid color has to show against every series color, not only against the surface.
 */
const PATTERN_MARK_MIN_RATIO = 2.5;
/**
 * The grid is a quiet rule, not information, so it has no WCAG minimum; these floors are what the
 * design has today. A change to the grid token that makes it fainter fails here.
 */
const GRID_MIN_RATIO = { Light: 1.2, Dark: 1.5 } as const;

const colorOf = (colors: Map<string, string>, token: string) => {
  const value = colors.get(token);
  if (!value) throw new Error(`Token --${token} is not defined`);
  return value;
};
const ratio = (colors: Map<string, string>, top: string, below: string) => contrastRatio(colorOf(colors, top), colorOf(colors, below));

describe.each(Object.entries(themes))("chart colors in %s", (theme, colors) => {
  it.each(SERIES)("should keep %s visible against the card and the tooltip", (token) => {
    expect(ratio(colors, token, "surface")).toBeGreaterThanOrEqual(UI_MIN_RATIO);
    expect(ratio(colors, token, "surface-elevated")).toBeGreaterThanOrEqual(UI_MIN_RATIO);
  });

  it("should keep the grid visible against the card", () => {
    expect(ratio(colors, "chart-grid", "surface")).toBeGreaterThanOrEqual(GRID_MIN_RATIO[theme as keyof typeof GRID_MIN_RATIO]);
  });

  it.each(SERIES)("should keep the marks of a pattern visible on %s", (token) => {
    expect(ratio(colors, "chart-grid", token)).toBeGreaterThanOrEqual(PATTERN_MARK_MIN_RATIO);
  });
});

describe("the grid in Dark against Light", () => {
  it("should not make the grid fainter in Dark than it is in Light", () => {
    expect(ratio(dark, "chart-grid", "surface")).toBeGreaterThanOrEqual(ratio(light, "chart-grid", "surface"));
  });
});
