import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { blocksZoom, findFixedWideWidths, findInflexibleSearchInputs, hasRawTable } from "@/lib/responsive/audit";

/**
 * VI-F08-S05 (spec R5): desktop and mobile layouts are checked. How each page
 * looks at 375, 768 and desktop widths is recorded from the screen in
 * docs/responsive-review.md. These checks keep from coming back the defects that
 * review found: a control with a fixed width that is wider than a phone, which
 * widens the whole page, and a table that is not in a box that scrolls. No
 * device list is claimed (spec Q3 is open).
 */
const src = join(process.cwd(), "src");
const files = (readdirSync(src, { recursive: true }) as string[])
  // The app's own source: not the tests, nor this audit, whose patterns would match themselves.
  .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && !file.startsWith("lib/responsive/"))
  .map((file) => ({ file, text: readFileSync(join(src, file), "utf8") }));

describe("fixed widths (spec R5)", () => {
  it("should leave no width of 256 px or more that applies on the smallest screens", () => {
    const wide = files.flatMap(({ file, text }) =>
      findFixedWideWidths(text).map((classes) => `${file}: ${classes.slice(0, 60)}`),
    );

    expect(wide).toEqual([]);
  });

  it.each([
    ['className="w-72"'],
    ['className="rounded w-64 px-2"'],
    ['className="w-[300px]"'],
    ['className="min-w-0 w-80 sm:w-auto"'],
  ])("should find a wide width that applies from the smallest screen: %s", (source) => {
    expect(findFixedWideWidths(source)).toHaveLength(1);
  });

  it.each([
    ['className="w-full sm:w-72"'],
    ['className="min-w-0 flex-1 sm:w-64 sm:flex-none"'],
    ['className="w-72 max-w-[85vw]"'],
    ['className="hidden w-64 shrink-0 md:flex"'],
    ['className="w-40"'],
    ['className="w-[200px]"'],
    ['className="w-(--anchor-width)"'],
  ])("should accept a width that is small, capped, behind a breakpoint or hidden: %s", (source) => {
    expect(findFixedWideWidths(source)).toEqual([]);
  });
});

describe("search boxes (spec R5)", () => {
  it("should let every search box grow and shrink with its row, with no fixed width on the smallest screens", () => {
    const stiff = files.flatMap(({ file, text }) =>
      findInflexibleSearchInputs(text).map((input) => `${file}: ${input}`),
    );

    expect(stiff).toEqual([]);
  });

  it.each([
    ['<Input aria-label="Search seats" className="w-60" />'],
    ['<Input aria-label="Search seats" />'],
    ['<Input aria-label="Search seats" className="flex-1 w-60" />'],
    ['<input aria-label="Search jobs" className="min-w-0 w-[240px]" />'],
  ])("should find a search box with a width of its own: %s", (source) => {
    expect(findInflexibleSearchInputs(`const A = () => ${source};`)).toHaveLength(1);
  });

  it.each([
    ['<Input aria-label="Search seats" className="min-w-0 flex-1 sm:w-72 sm:flex-none" />'],
    ['<Input aria-label="Search seats" className="w-full sm:w-72" />'],
    ['<Input aria-label="Booking number" className="w-40" />'],
  ])("should accept a search box that flexes, and an input that is not a search box: %s", (source) => {
    expect(findInflexibleSearchInputs(`const A = () => ${source};`)).toEqual([]);
  });
});

describe("tables (spec R5)", () => {
  it("should use a table only through the shared Table component, which scrolls sideways", () => {
    const raw = files.filter(({ file }) => file !== "components/ui/table.tsx" && hasRawTable(readFileSync(join(src, file), "utf8")));

    expect(raw.map(({ file }) => file)).toEqual([]);
  });

  it("should have the shared Table scroll sideways inside its own box", () => {
    const table = readFileSync(join(src, "components", "ui", "table.tsx"), "utf8");

    expect(table).toContain("overflow-x-auto");
  });

  it("should find a raw table", () => {
    expect(hasRawTable("<table><tbody /></table>")).toBe(true);
    expect(hasRawTable("<Table><TableBody /></Table>")).toBe(false);
  });
});

describe("zoom (spec R5)", () => {
  it("should let the person zoom: no viewport setting stops it", () => {
    expect(files.filter(({ text }) => blocksZoom(text)).map(({ file }) => file)).toEqual([]);
  });

  it.each([
    ["maximum-scale=1"],
    ["user-scalable=no"],
    ["userScalable: false"],
    ["export const viewport = { maximumScale: 1 };"],
  ])("should find a viewport that stops zoom: %s", (source) => {
    expect(blocksZoom(source)).toBe(true);
  });

  it("should accept a plain viewport", () => {
    expect(blocksZoom('export const viewport = { width: "device-width", initialScale: 1 };')).toBe(false);
  });
});

describe("the shell (spec R5)", () => {
  const shell = readFileSync(join(src, "components", "layout", "app-shell.tsx"), "utf8");

  it("should show a menu header below the md breakpoint and the side bar from it", () => {
    const sidebar = readFileSync(join(src, "components", "layout", "desktop-sidebar.tsx"), "utf8");

    expect(shell).toMatch(/<header[^>]*md:hidden/);
    expect(sidebar).toMatch(/<aside[\s\S]*"hidden [^"]*md:flex/);
  });

  it("should let the page content shrink, so a wide child cannot widen the page", () => {
    expect(shell).toMatch(/<main[^>]*min-w-0/);
  });
});
