import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { NAV_ITEMS } from "@/config/nav";
import { findNativeControls, isGalleryPath } from "@/lib/accessibility/library-guard";
import { listSourceFiles } from "@/lib/accessibility/source-files";

const SRC = join(process.cwd(), "src");
const screens = listSourceFiles(SRC).filter((f) => f.endsWith(".tsx") && !relative(SRC, f).startsWith(join("components", "ui")));

/**
 * Native controls written out on purpose. The More slot of the bottom bar is the trigger of a
 * dialog: it takes the style of the bar, which no button size of the library has.
 */
const ALLOWED = new Set([join("components", "layout", "more-sheet.tsx")]);

/**
 * Native controls that screens already had when this guard began: the number in each file. They
 * are debt to move onto the library in later work; the number may only go down. A new file, or a
 * higher number, fails the test, so a new control goes into the library first (E1).
 */
const BASELINE = new Map<string, number>([
  ["features/bookings/components/adjustment-form.tsx", 1],
  ["features/bookings/components/booking-form.tsx", 2],
  ["features/bookings/components/change-booking-status-dialog.tsx", 2],
  ["features/cleaning/components/cleaning-complete-form.tsx", 3],
  ["features/incidents/components/change-incident-status-dialog.tsx", 2],
  ["features/incidents/components/incident-report-form.tsx", 2],
  ["features/inspections/components/inspection-form.tsx", 2],
  ["features/installations/components/installation-form.tsx", 1],
  ["features/jobs/components/change-job-status-dialog.tsx", 2],
  ["features/jobs/components/create-job-form.tsx", 1],
  ["features/seats/components/partner-seats-filters.tsx", 1],
].map(([file, count]) => [join(...(file as string).split("/")), count as number]));

const countsOf = () =>
  new Map(
    screens.flatMap((file) => {
      const path = relative(SRC, file);
      const count = ALLOWED.has(path) ? 0 : findNativeControls(readFileSync(file, "utf8")).length;
      return count > 0 ? [[path, count] as const] : [];
    }),
  );

describe("library use (R13, E1)", () => {
  it("should not let a screen add a native button, input, select or textarea", () => {
    const grown = [...countsOf()].filter(([path, count]) => count > (BASELINE.get(path) ?? 0));

    expect(grown).toEqual([]);
  });

  it("should lower the baseline when a screen moves a control onto the library", () => {
    const counts = countsOf();
    const stale = [...BASELINE].filter(([path, count]) => (counts.get(path) ?? 0) < count);

    expect(stale).toEqual([]);
  });

  it("should still need the one allowed exception, so the list does not go stale", () => {
    for (const path of ALLOWED) {
      expect(findNativeControls(readFileSync(join(SRC, path), "utf8")).length, path).toBeGreaterThan(0);
    }
  });

  it.each([
    ["a native button", "export const A = () => <button type='button'>Go</button>;", 1],
    ["a native text input", "export const A = () => <input type='text' />;", 1],
    ["a native select", "export const A = () => <select><option /></select>;", 1],
    ["a native textarea", "export const A = () => <textarea />;", 1],
  ])("should find %s", (_name, code, count) => {
    expect(findNativeControls(code)).toHaveLength(count);
  });

  it.each([
    ["a hidden input", "export const A = () => <input type='hidden' name='x' />;"],
    ["the shared Button", "export const A = () => <Button>Go</Button>;"],
    ["the shared Input", "export const A = () => <Input />;"],
  ])("should accept %s", (_name, code) => {
    expect(findNativeControls(code)).toEqual([]);
  });
});

describe("component gallery (R12, E4)", () => {
  const routes = (readdirSync(join(SRC, "app"), { recursive: true }) as string[]).filter((p) => /(^|[\\/])(page|route)\.tsx?$/.test(p));

  it("should have no route for a gallery, so the address answers not-found in every build", () => {
    expect(routes.filter(isGalleryPath)).toEqual([]);
  });

  it("should have no menu item that points to a gallery", () => {
    expect(NAV_ITEMS.filter((item) => isGalleryPath(item.href))).toEqual([]);
  });

  it.each(["/gallery", "gallery/page.tsx", "(dashboard)/gallery/layout.tsx", "src\\app\\gallery\\page.tsx"])("should recognise %s as a gallery path", (path) => {
    expect(isGalleryPath(path)).toBe(true);
  });

  it.each(["/galleries-of-art", "/dashboard", "src/app/page.tsx"])("should not take %s for a gallery path", (path) => {
    expect(isGalleryPath(path)).toBe(false);
  });
});
