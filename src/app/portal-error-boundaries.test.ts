import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const APP_DIR = join(process.cwd(), "src", "app");

/** The pages under src/app, as { route (route groups left out), directory }. */
function pages(dir = APP_DIR, route = ""): { route: string; dir: string }[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) {
      const segment = /^\(.*\)$/.test(name) ? "" : `/${name}`;
      return pages(path, route + segment);
    }

    return name === "page.tsx" ? [{ route: route || "/", dir }] : [];
  });
}

/** What a partner user can open: the portal and the lists it shares. */
const PORTAL = /^\/(partner|bookings|incidents|dashboard)(\/|$)/;

/** The nearest error boundary below the app root, from a page up. */
function segmentBoundary(dir: string): string | null {
  for (let current = dir; current !== APP_DIR; current = dirname(current)) {
    if (existsSync(join(current, "error.tsx"))) {
      return join(current, "error.tsx");
    }
  }

  return null;
}

describe("error boundaries of the partner portal (VI-F03-S08, spec E4)", () => {
  const portalPages = pages().filter((page) => PORTAL.test(page.route));

  it("should find the portal pages, so the checks below are not empty", () => {
    expect(portalPages.map((page) => page.route)).toEqual(
      expect.arrayContaining(["/partner", "/partner/seats", "/bookings", "/dashboard"]),
    );
  });

  it.each(portalPages.map((page) => [page.route, page.dir] as const))(
    "should have an error boundary of its own segment for %s",
    (_route, dir) => {
      const boundary = segmentBoundary(dir);

      expect(boundary, `no error.tsx for ${relative(APP_DIR, dir)}`).not.toBeNull();
    },
  );

  it("should have, for every portal boundary, a client component that offers a retry and never prints the error message", () => {
    const boundaries = new Set(
      portalPages.map((page) => segmentBoundary(page.dir)).filter((b): b is string => b !== null),
    );

    for (const boundary of boundaries) {
      const source = readFileSync(boundary, "utf8");
      const name = relative(APP_DIR, boundary).split(sep).join("/");

      expect(source, name).toContain('"use client"');
      expect(source, name).toMatch(/reset/);
      expect(source, name).not.toMatch(/error\.message/);
    }
  });

  it("should have a boundary above the layouts, which catches a failed profile read", () => {
    expect(existsSync(join(APP_DIR, "error.tsx"))).toBe(true);
  });
});
