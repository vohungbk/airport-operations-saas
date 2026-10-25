import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { findRawColorLines } from "@/lib/accessibility/raw-colors";
import { listSourceFiles } from "@/lib/accessibility/source-files";
import { readBlock, readDeclarations } from "@/lib/accessibility/token-css";

const SRC_DIR = join(process.cwd(), "src");
const GLOBALS_CSS = join(SRC_DIR, "app", "globals.css");

// Names and hex values from the design file, frame "Foundations / Exact source tokens".
const DESIGN_COLORS: Record<string, { light: string; dark: string }> = {
  background: { light: "#F5F7FA", dark: "#0B1220" },
  surface: { light: "#FFFFFF", dark: "#111A2B" },
  "surface-elevated": { light: "#FFFFFF", dark: "#17233A" },
  "surface-muted": { light: "#EEF2F7", dark: "#152036" },
  border: { light: "#E2E8F0", dark: "#2A3A55" },
  "border-input": { light: "#74839A", dark: "#6F819C" },
  text: { light: "#172033", dark: "#E8EDF7" },
  "text-muted": { light: "#586A80", dark: "#9AA8BF" },
  primary: { light: "#0F4C81", dark: "#5AA2E8" },
  "primary-hover": { light: "#0B3558", dark: "#7DB6EE" },
  "primary-foreground": { light: "#FFFFFF", dark: "#06192E" },
  "primary-subtle": { light: "#E6EFF7", dark: "#12304F" },
  "primary-subtle-foreground": { light: "#0B3558", dark: "#BBD9F7" },
  secondary: { light: "#2F6B8A", dark: "#5B9DBF" },
  "focus-ring": { light: "#0284C7", dark: "#38BDF8" },
  success: { light: "#16A34A", dark: "#4ADE80" },
  "success-bg": { light: "#DCFCE7", dark: "#0F2A1A" },
  "success-fg": { light: "#166534", dark: "#86EFAC" },
  warning: { light: "#D97706", dark: "#FBBF24" },
  "warning-bg": { light: "#FEF3C7", dark: "#33240A" },
  "warning-fg": { light: "#92400E", dark: "#FCD34D" },
  danger: { light: "#DC2626", dark: "#F87171" },
  "danger-bg": { light: "#FEE2E2", dark: "#3A1313" },
  "danger-fg": { light: "#991B1B", dark: "#FCA5A5" },
  info: { light: "#0284C7", dark: "#38BDF8" },
  "info-bg": { light: "#E0F2FE", dark: "#0A2A3D" },
  "info-fg": { light: "#075985", dark: "#7DD3FC" },
  "neutral-bg": { light: "#EEF2F7", dark: "#1B2842" },
  "neutral-fg": { light: "#334155", dark: "#CBD5E1" },
  "chart-1": { light: "#0F4C81", dark: "#5AA2E8" },
  "chart-2": { light: "#2F6B8A", dark: "#6AB0D4" },
  "chart-3": { light: "#D97706", dark: "#FBBF24" },
  "chart-4": { light: "#16A34A", dark: "#4ADE80" },
  "chart-5": { light: "#DC2626", dark: "#F87171" },
  "chart-6": { light: "#64748B", dark: "#9AA8BF" },
  "chart-grid": { light: "#E2E8F0", dark: "#2A3A55" },
};

describe("design tokens", () => {
  const css = readFileSync(GLOBALS_CSS, "utf8");
  const light = readDeclarations(readBlock(css, ":root"));
  const dark = readDeclarations(readBlock(css, ".dark"));
  const shared = readDeclarations(readBlock(css, ":root, .dark"));
  const theme = readDeclarations(readBlock(css, "@theme inline"));

  it("should not contain raw color values outside globals.css", () => {
    const offenders = listSourceFiles(SRC_DIR).flatMap((file) =>
      findRawColorLines(readFileSync(file, "utf8")).map(
        (line) => `${relative(SRC_DIR, file)}:${line}`,
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("should define every color token of the design in both Light and Dark", () => {
    const names = Object.keys(DESIGN_COLORS);
    const missing = names.flatMap((name) =>
      [light, dark].every((theme) => theme.has(name)) ? [] : [name],
    );

    expect(names).toHaveLength(36);
    expect(missing).toEqual([]);
  });

  it("should use the hex values of the design in each theme", () => {
    const wrong = Object.entries(DESIGN_COLORS).flatMap(([name, value]) => [
      ...(light.get(name) === value.light ? [] : [`light ${name}`]),
      ...(dark.get(name) === value.dark ? [] : [`dark ${name}`]),
    ]);

    expect(wrong).toEqual([]);
  });

  it("should register every design color as a Tailwind color", () => {
    const unregistered = Object.keys(DESIGN_COLORS).filter(
      (name) => theme.get(`color-${name}`) !== `var(--${name})`,
    );

    expect(unregistered).toEqual([]);
  });

  it("should define solid, bg and fg for success, warning, danger and info in both themes", () => {
    const missing = ["success", "warning", "danger", "info"].flatMap((status) =>
      [status, `${status}-bg`, `${status}-fg`].flatMap((name) =>
        [light, dark].every((t) => /^#[0-9A-F]{6}$/.test(t.get(name) ?? ""))
          ? []
          : [name],
      ),
    );

    expect(missing).toEqual([]);
  });

  it("should define six chart colors and a grid color in both themes", () => {
    const names = [1, 2, 3, 4, 5, 6].map((n) => `chart-${n}`).concat("chart-grid");
    const missing = names.filter((name) => !light.has(name) || !dark.has(name));

    expect(missing).toEqual([]);
    expect(theme.has("color-chart-6")).toBe(true);
    expect(theme.has("color-chart-grid")).toBe(true);
  });

  it("should give every chart color a different value within each theme", () => {
    for (const t of [light, dark]) {
      const colors = [1, 2, 3, 4, 5, 6].map((n) => t.get(`chart-${n}`));
      expect(new Set(colors).size).toBe(6);
    }
  });

  it("should have the same token names in Light and Dark", () => {
    const onlyLight = [...light.keys()].filter((name) => !dark.has(name));
    const onlyDark = [...dark.keys()].filter((name) => !light.has(name));

    expect(onlyLight).toEqual([]);
    expect(onlyDark).toEqual([]);
  });

  it("should resolve every legacy shadcn color to a defined token", () => {
    const defined = new Set([...light.keys(), ...dark.keys(), ...shared.keys()]);
    const legacy = [...theme.entries()]
      .filter(([name]) => name.startsWith("color-"))
      .map(([name, value]) => [name, value.match(/^var\(--([a-z0-9-]+)\)$/)?.[1]]);
    const broken = legacy.flatMap(([name, target]) =>
      target && defined.has(target) ? [] : [name],
    );

    expect(legacy.length).toBeGreaterThan(0);
    expect(broken).toEqual([]);
  });

  it("should define the type scale, spacing grid and radius steps of the design", () => {
    const type = {
      display: ["30px", "36px"],
      h1: ["24px", "32px"],
      h2: ["20px", "28px"],
      h3: ["16px", "24px"],
      body: ["14px", "20px"],
      small: ["12px", "16px"],
      caption: ["11px", "16px"],
    };
    const wrongType = Object.entries(type).flatMap(([name, [size, height]]) =>
      theme.get(`text-${name}`) === size &&
      theme.get(`text-${name}--line-height`) === height
        ? []
        : [name],
    );

    expect(wrongType).toEqual([]);
    expect(theme.get("spacing")).toBe("0.25rem");
    expect(theme.get("radius-sm")).toBe("4px");
    expect(theme.get("radius-md")).toBe("8px");
    expect(theme.get("radius-lg")).toBe("12px");
    expect(theme.get("radius-xl")).toBe("16px");
    expect(theme.get("radius-full")).toBe("9999px");
  });

  it("should apply the dark theme only outside print", () => {
    const outsidePrint = readBlock(css.slice(css.indexOf("\n@media not print {")), "@media not print");

    expect(readDeclarations(outsidePrint).has("background")).toBe(true);
    expect(outsidePrint).toContain(".dark {");
    // Only one .dark rule in the whole file, and it is the one inside @media not print.
    expect(css.match(/^[ \t]*\.dark \{/gm)).toHaveLength(1);
  });

  it("should not apply dark: utilities in print", () => {
    const variant = readBlock(css, "@custom-variant dark");

    expect(variant).toContain("@media not print");
    expect(variant).toContain("&:is(.dark *)");
  });

  it("should run the token checks before every build", () => {
    const { scripts } = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    const files = [
      "src/app/design-tokens.test.ts",
      "src/lib/accessibility/token-contrast.test.ts",
      "src/lib/accessibility/class-contrast.test.ts",
    ];

    expect(scripts.prebuild).toContain("vitest run");
    for (const file of files) {
      expect(scripts.prebuild).toContain(file);
      expect(existsSync(join(process.cwd(), file))).toBe(true);
    }
  });

  it("should use the Light tokens when no script has added the dark class", () => {
    // The device setting is read by the theme script, not by the CSS. With no script (JavaScript
    // off) the page keeps the :root tokens, which are Light (UI-F01-S04, E1).
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(light.get("background")).toBe("#F5F7FA");
  });
});
