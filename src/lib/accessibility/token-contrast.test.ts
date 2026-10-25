import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  TEXT_MIN_RATIO,
  TEXT_PAIRS,
  UI_MIN_RATIO,
  UI_PAIRS,
  contrastRatio,
  measurePairs,
  type ColorPair,
} from "./contrast";
import { readBlock, readDeclarations } from "./token-css";

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
const themes = {
  Light: readDeclarations(readBlock(css, ":root")),
  Dark: readDeclarations(readBlock(css, ".dark")),
};

describe.each(Object.entries(themes))("token contrast in %s", (theme, colors) => {
  const groups: [string, ColorPair[], number][] = [
    ["text", TEXT_PAIRS, TEXT_MIN_RATIO],
    ["UI part", UI_PAIRS, UI_MIN_RATIO],
  ];

  describe.each(groups)("%s pairs", (_kind, pairs, minimum) => {
    it.each(measurePairs(colors, pairs))(
      `should reach ${minimum}:1 for $foreground on $background`,
      ({ ratio }) => {
        // The ratio is in the failure message, so a red run lists what to fix.
        expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimum);
      },
    );
  });

  it("should list every ratio", () => {
    const rows = [...measurePairs(colors, TEXT_PAIRS), ...measurePairs(colors, UI_PAIRS)].map(
      (r) => `${r.foreground} on ${r.background}: ${r.ratio.toFixed(2)}:1`,
    );

    console.info(`Contrast ratios (${theme}):\n${rows.join("\n")}`);
    expect(rows).toHaveLength(TEXT_PAIRS.length + UI_PAIRS.length);
  });
});

describe("contrast helpers", () => {
  it("should give 21:1 for black on white and 1:1 for the same color", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  });

  it("should give the same ratio whichever color is on top", () => {
    expect(contrastRatio("#172033", "#F5F7FA")).toBeCloseTo(contrastRatio("#F5F7FA", "#172033"), 10);
  });

  it("should find a pair below the limit", () => {
    const colors = new Map([
      ["text", "#777777"],
      ["background", "#888888"],
    ]);
    const [result] = measurePairs(colors, [{ foreground: "text", background: "background" }]);

    expect(result.ratio).toBeLessThan(TEXT_MIN_RATIO);
  });

  it("should reject a token that is not defined", () => {
    const colors = new Map([["text", "#000000"]]);

    expect(() => measurePairs(colors, [{ foreground: "text", background: "surface" }])).toThrow(
      /--surface/,
    );
  });

  it("should reject a value that is not a 6-digit hex color", () => {
    expect(() => contrastRatio("var(--text)", "#FFFFFF")).toThrow(/hex/);
    expect(() => contrastRatio("#FFF", "#000000")).toThrow(/hex/);
  });

  it("should define every listed token in both themes", () => {
    const names = new Set([...TEXT_PAIRS, ...UI_PAIRS].flatMap((p) => [p.foreground, p.background]));
    const missing = [...names].filter((n) => !themes.Light.has(n) || !themes.Dark.has(n));

    expect(missing).toEqual([]);
  });
});
