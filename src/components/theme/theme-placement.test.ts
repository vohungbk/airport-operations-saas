import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const APP_DIR = join(process.cwd(), "src", "app");

/**
 * Pages that have no theme control on purpose. The spec puts the control in the top bar, the user
 * menu and the sign-in pages (NAV-1, NAV-2); these are state pages and a stub, and they follow
 * the theme through the tokens only.
 */
const WITHOUT_CONTROL = new Set(["page.tsx", join("forbidden", "page.tsx")]);

function pagesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return pagesUnder(full);
    return name === "page.tsx" ? [full] : [];
  });
}

/** The layouts above a page, from its own folder up to the app folder (the root one is last). */
function layoutsAbove(page: string): string[] {
  const layouts: string[] = [];
  for (let dir = dirname(page); dir.startsWith(APP_DIR); dir = dirname(dir)) {
    const layout = join(dir, "layout.tsx");
    if (existsSync(layout)) layouts.push(layout);
    if (dir === APP_DIR) break;
  }
  return layouts;
}

/** Whether the layouts hand the page a theme control: through the shell, or directly. */
export function hasThemeControl(layouts: string[], read: (file: string) => string): boolean {
  return layouts.some((file) => /<AppShell\b|<ThemeControl\b/.test(read(file)));
}

describe("the theme control is above every page", () => {
  const pages = pagesUnder(APP_DIR);
  const read = (file: string) => readFileSync(file, "utf8");
  const relativePage = (page: string) => relative(APP_DIR, page);

  it("should find the route groups of the application", () => {
    const groups = new Set(
      pages.map((p) => relativePage(p).split(sep)[0]).filter((part) => part.startsWith("(")),
    );

    expect([...groups].sort()).toEqual(["(admin)", "(auth)", "(dashboard)", "(partner)", "(technician)"]);
  });

  it("should give every page a layout with the control, except the listed state pages", () => {
    const missing = pages
      .filter((page) => !WITHOUT_CONTROL.has(relativePage(page)))
      .filter((page) => !hasThemeControl(layoutsAbove(page), read))
      .map(relativePage);

    expect(missing).toEqual([]);
  });

  it("should show the control on every sign-in page, which are signed-out pages", () => {
    const signIn = pages.filter((page) => relativePage(page).startsWith("(auth)"));

    expect(signIn.map(relativePage).sort()).toEqual([
      join("(auth)", "forgot-password", "page.tsx"),
      join("(auth)", "login", "page.tsx"),
      join("(auth)", "reset-password", "page.tsx"),
      join("(auth)", "signup", "page.tsx"),
    ]);
    for (const page of signIn) {
      expect(read(join(APP_DIR, "(auth)", "layout.tsx"))).toContain("<ThemeControl />");
      expect(layoutsAbove(page)).toContain(join(APP_DIR, "(auth)", "layout.tsx"));
    }
  });

  it("should not need a sign-in for the control: it has no user or role check", () => {
    const control = read(join(process.cwd(), "src", "components", "theme", "theme-control.tsx"));

    expect(control).not.toMatch(/getCurrentUser|hasPermission|user\.role/);
  });
});

describe("hasThemeControl", () => {
  const files: Record<string, string> = {
    shell: "export default () => <AppShell>{children}</AppShell>",
    direct: "export default () => <div><ThemeControl /></div>",
    bare: "export default () => <div>{children}</div>",
  };
  const read = (file: string) => files[file];

  it("should accept a layout with the shell or the control", () => {
    expect(hasThemeControl(["shell"], read)).toBe(true);
    expect(hasThemeControl(["direct"], read)).toBe(true);
  });

  it("should accept a page when any layout above it has the control", () => {
    expect(hasThemeControl(["bare", "shell"], read)).toBe(true);
  });

  it("should reject a page whose layouts have no control", () => {
    expect(hasThemeControl(["bare"], read)).toBe(false);
    expect(hasThemeControl([], read)).toBe(false);
  });
});
