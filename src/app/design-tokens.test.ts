import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const SRC_DIR = join(process.cwd(), "src");
const GLOBALS_CSS = join(SRC_DIR, "app", "globals.css");

const RAW_COLOR_PATTERNS: RegExp[] = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\brgba?\(/,
  /\bhsla?\(/,
  /\boklch\(/,
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline)-(?:red|green|blue|yellow|gray|slate|zinc|neutral|stone|amber|orange|emerald|sky|white|black)(?:-\d+)?\b/,
];

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    const isSource = /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name);
    return isSource ? [full] : [];
  });
}

function readBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("\n}", start);
  return css.slice(start, end);
}

describe("design tokens", () => {
  const css = readFileSync(GLOBALS_CSS, "utf8");

  it("should not contain raw color values outside globals.css", () => {
    const offenders = listSourceFiles(SRC_DIR).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) =>
          RAW_COLOR_PATTERNS.some((p) => p.test(line))
            ? [`${relative(SRC_DIR, file)}:${index + 1}`]
            : [],
        ),
    );

    expect(offenders).toEqual([]);
  });

  it("should define every registered theme color in :root and .dark", () => {
    const theme = readBlock(css, "@theme inline");
    const registered = [...theme.matchAll(/--color-([a-z0-9-]+):/g)].map(
      (m) => m[1],
    );
    const root = readBlock(css, ":root");
    const dark = readBlock(css, ".dark");

    const missing = registered.flatMap((name) =>
      [root, dark].every((block) => block.includes(`--${name}:`))
        ? []
        : [name],
    );

    expect(registered.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it("should define a foreground pair for success, warning and info", () => {
    const root = readBlock(css, ":root");

    for (const name of ["success", "warning", "info"]) {
      expect(root).toContain(`--${name}:`);
      expect(root).toContain(`--${name}-foreground:`);
    }
  });
});
