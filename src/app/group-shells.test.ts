import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const APP_DIR = join(process.cwd(), "src", "app");
const read = (...parts: string[]) => readFileSync(join(APP_DIR, ...parts), "utf8");

/** The route groups that show the shell: each has one layout that provides it. */
const SHELL_GROUPS = ["(admin)", "(dashboard)", "(partner)", "(technician)"];

function layoutsUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return layoutsUnder(full);
    return name === "layout.tsx" ? [full] : [];
  });
}

describe("the shell of each group (UI-F02-S04, spec E4)", () => {
  it.each(SHELL_GROUPS)("should have %s provide the shell after a sign-in check", (group) => {
    const layout = read(group, "layout.tsx");

    expect(layout).toContain("await requireAuth()");
    expect(layout).toContain("<AppShell user={user}>{children}</AppShell>");
  });

  it.each(SHELL_GROUPS)("should have %s show the 403 page inside its shell", (group) => {
    const forbidden = read(group, "forbidden.tsx");

    expect(forbidden).toContain("<PageForbidden />");
  });

  it("should have a fallback for a 403 that happens outside every group", () => {
    expect(read("forbidden.tsx")).toContain("<PageForbidden />");
  });

  it("should use the shell only once on the way to any page, so shells never nest", () => {
    const withShell = layoutsUnder(APP_DIR)
      .filter((file) => readFileSync(file, "utf8").includes("<AppShell"))
      .map((file) => relative(APP_DIR, file).split(sep));

    // One layout per group provides it, at the top of the group.
    expect(
      withShell.map((parts) => parts.join("/")).sort(),
      "Only the layout at the top of each group may provide <AppShell>: a second one nests shells. " +
        "A new group with a shell must also be added to SHELL_GROUPS, with a forbidden.tsx.",
    ).toEqual(SHELL_GROUPS.map((group) => `${group}/layout.tsx`).sort());
  });

  it("should leave the guard layouts of the areas with the permission check only", () => {
    const areaLayouts = layoutsUnder(APP_DIR).filter((file) => {
      const parts = relative(APP_DIR, file).split(sep);
      return parts.length > 2 && SHELL_GROUPS.includes(parts[0]);
    });

    expect(areaLayouts.length).toBeGreaterThanOrEqual(8);
    for (const file of areaLayouts) {
      const source = readFileSync(file, "utf8");

      expect(source, relative(APP_DIR, file)).toMatch(/require(Any)?Permission/);
      expect(source, relative(APP_DIR, file)).not.toContain("<AppShell");
    }
  });

  it("should keep /forbidden, with only Sign out, for a user with no profile or no partner", () => {
    expect(existsSync(join(APP_DIR, "forbidden", "page.tsx"))).toBe(true);
    expect(read("forbidden", "page.tsx")).not.toContain("AppShell");
  });
});

describe("the 403 of Next.js", () => {
  it("should be switched on, since forbidden() is an experimental option", () => {
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

    expect(config).toMatch(/authInterrupts:\s*true/);
  });

  it("should be what the permission guards call, not a redirect", () => {
    const guards = readFileSync(join(process.cwd(), "src", "lib", "auth", "current-user.ts"), "utf8");

    expect(guards.match(/forbidden\(\);/g)).toHaveLength(3);
  });
});
