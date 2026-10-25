import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { blend, findLowContrastClasses } from "./class-contrast";
import { listSourceFiles } from "./source-files";
import { resolveColors, type ThemeName } from "./token-css";

const SRC_DIR = join(process.cwd(), "src");
const css = readFileSync(join(SRC_DIR, "app", "globals.css"), "utf8");
const themes: ThemeName[] = ["light", "dark"];

describe.each(themes)("text colors written in components, %s theme", (theme) => {
  it("should reach 4.5:1 on the background they sit on", () => {
    const colors = resolveColors(css, theme);
    const findings = listSourceFiles(SRC_DIR)
      // The test support in this folder names tokens such as "text-muted"; they are not classes.
      .filter((file) => !relative(SRC_DIR, file).startsWith(join("lib", "accessibility")))
      .flatMap((file) =>
        findLowContrastClasses(readFileSync(file, "utf8"), colors, theme).map(
          (f) => `${relative(SRC_DIR, file)}: "${f.classes}" ${f.text} on ${f.background} is ${f.ratio.toFixed(2)}:1`,
        ),
      );

    expect(findings).toEqual([]);
  });
});

describe("resolveColors", () => {
  it("should follow a legacy name to its design token", () => {
    const light = resolveColors(css, "light");

    expect(light.get("destructive")).toBe(light.get("danger"));
    expect(light.get("muted-foreground")).toBe(light.get("text-muted"));
  });

  it("should give the dark value of a name that .dark redefines", () => {
    const [light, dark] = [resolveColors(css, "light"), resolveColors(css, "dark")];

    expect(light.get("success-foreground")).toBe(light.get("text"));
    expect(dark.get("success-foreground")).toBe(dark.get("primary-foreground"));
  });

  it("should leave out a value that is not a hex color", () => {
    expect(resolveColors(css, "light").has("overlay")).toBe(false);
  });
});

describe("the classes this check was added for", () => {
  it("should flag the old destructive button and the old error text in Light", () => {
    const light = resolveColors(css, "light");

    expect(findLowContrastClasses('"bg-destructive/10 text-destructive"', light, "light")).toHaveLength(1);
    expect(findLowContrastClasses('"text-destructive"', light, "light").length).toBeGreaterThan(0);
  });

  it("should pass the classes that replaced them in both themes", () => {
    for (const theme of themes) {
      const colors = resolveColors(css, theme);

      expect(findLowContrastClasses('"bg-danger-bg text-danger-fg"', colors, theme)).toEqual([]);
      expect(findLowContrastClasses('"text-danger-fg"', colors, theme)).toEqual([]);
    }
  });
});

describe("findLowContrastClasses", () => {
  const colors = new Map([
    ["background", "#FFFFFF"],
    ["card", "#FFFFFF"],
    ["popover", "#FFFFFF"],
    ["pale", "#DDDDDD"],
    ["ink", "#111111"],
    ["red", "#FF0000"],
  ]);
  const find = (source: string, theme: ThemeName = "light") =>
    findLowContrastClasses(source, colors, theme);

  it("should flag text that is too close to its own background", () => {
    const [finding] = find('const c = "bg-pale text-pale";');

    expect(finding).toMatchObject({ text: "text-pale", background: "bg-pale" });
    expect(finding.ratio).toBeCloseTo(1, 1);
  });

  it("should pass dark text on a light background", () => {
    expect(find('const c = "bg-pale text-ink";')).toEqual([]);
  });

  it("should check plain text on the page, a card and a popover", () => {
    const names = find('const c = "text-pale";').map((f) => f.background);

    expect(names).toEqual(["bg-background", "bg-card", "bg-popover"]);
  });

  it("should count a tint over the page when the background has an opacity", () => {
    // Red at 10% over white is a pale pink; red text on it is about 3.4:1.
    const [finding] = find('const c = "bg-red/10 text-red";');

    expect(finding.ratio).toBeGreaterThan(3);
    expect(finding.ratio).toBeLessThan(4);
  });

  it("should use a dark: class in Dark only", () => {
    const source = 'const c = "bg-pale text-ink dark:text-pale";';

    expect(find(source, "light")).toEqual([]);
    expect(find(source, "dark")).toHaveLength(1);
  });

  it("should ignore classes that are not colors and states such as hover:", () => {
    expect(find('const c = "text-sm text-center hover:text-pale bg-transparent";')).toEqual([]);
  });

  it("should read class strings in single quotes and template literals", () => {
    expect(find("const c = 'bg-pale text-pale';")).toHaveLength(1);
    expect(find("const c = `bg-pale text-pale`;")).toHaveLength(1);
  });

  it("should throw when the page background is not a color", () => {
    expect(() => findLowContrastClasses('"text-ink"', new Map(), "light")).toThrow(/--background/);
  });
});

describe("blend", () => {
  it("should give the top color at full opacity and the one below at none", () => {
    expect(blend("#FF0000", "#FFFFFF", 1)).toBe("#ff0000");
    expect(blend("#FF0000", "#FFFFFF", 0)).toBe("#ffffff");
  });

  it("should mix halfway at 50%", () => {
    expect(blend("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });
});
