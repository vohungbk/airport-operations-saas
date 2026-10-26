import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const SRC_DIR = join(process.cwd(), "src");
const APP_DIR = join(SRC_DIR, "app");
const read = (...parts: string[]) => readFileSync(join(SRC_DIR, ...parts), "utf8");

const SHELL_GROUPS = ["(admin)", "(dashboard)", "(partner)", "(technician)"];

function files(dir: string, test: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return files(full, test);
    return test(name) ? [full] : [];
  });
}

const sourceFiles = () => files(SRC_DIR, (n) => /\.tsx$/.test(n) && !/\.test\.tsx$/.test(n));
const pagesOf = (group: string) => files(join(APP_DIR, group), (n) => n === "page.tsx");

/** The folders from a page up to its group, nearest first, the group folder last. */
function foldersAbove(page: string, group: string): string[] {
  const top = join(APP_DIR, group);
  const folders: string[] = [];
  for (let dir = dirname(page); ; dir = dirname(dir)) {
    folders.push(dir);
    if (dir === top) return folders;
  }
}

describe("one breakpoint for the shell (UI-F02-S05, spec R10)", () => {
  const classOf = (file: string, anchor: RegExp) => {
    const source = read("components", "layout", file);
    const match = anchor.exec(source);
    expect(match, `${file}: ${anchor}`).not.toBeNull();
    return match![0];
  };

  it("should show the sidebar and the top bar from md and the phone bars below it", () => {
    expect(classOf("desktop-sidebar.tsx", /"hidden [^"]*md:flex[^"]*"/)).toContain("md:flex");
    expect(classOf("top-bar.tsx", /"hidden [^"]*md:flex[^"]*"/)).toContain("md:flex");
    expect(classOf("mobile-app-bar.tsx", /className="[^"]*md:hidden[^"]*"/)).toContain("md:hidden");
    expect(classOf("bottom-nav.tsx", /className="fixed[^"]*md:hidden[^"]*"/)).toContain("md:hidden");
  });

  it("should switch at md and at no other breakpoint", () => {
    for (const file of ["desktop-sidebar.tsx", "top-bar.tsx", "mobile-app-bar.tsx", "bottom-nav.tsx"]) {
      const source = read("components", "layout", file);

      expect(source, file).not.toMatch(/(?:^|[\s"])(?:sm|lg|xl|2xl):(?:hidden|flex|block)\b/);
    }
  });

  it("should give the sheet of a phone the same breakpoint", () => {
    expect(read("components", "layout", "more-sheet.tsx")).toContain("md:hidden");
  });
});

describe("landmarks and the skip link (UI-F02-S05, spec R12)", () => {
  it("should have one main landmark in the shell, which the skip link leads to", () => {
    const shell = read("components", "layout", "app-shell.tsx");

    expect(shell.match(/<main\b/g)).toHaveLength(1);
    expect(shell).toContain("id={MAIN_CONTENT_ID}");
    expect(shell).toContain("tabIndex={-1}");
    expect(shell).toContain("<SkipLink />");
  });

  it("should point the skip link at the id of the main landmark", () => {
    const skip = read("components", "shared", "skip-link.tsx");

    expect(skip).toContain('MAIN_CONTENT_ID = "main-content"');
    expect(skip).toContain("href={`#${MAIN_CONTENT_ID}`}");
    expect(skip).toContain("Skip to content");
  });

  it("should hide the skip link until it has focus", () => {
    const skip = read("components", "shared", "skip-link.tsx");

    expect(skip).toContain("sr-only");
    expect(skip).toContain("focus:not-sr-only");
  });

  it("should use <main> only in the shell, the sign-in layout and the page without a shell", () => {
    const withMain = sourceFiles()
      .filter((file) => /<main\b/.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC_DIR, file).split(sep).join("/"))
      .sort();

    expect(withMain).toEqual([
      "app/(auth)/layout.tsx",
      "components/layout/app-shell.tsx",
      "components/shared/standalone-page.tsx",
    ]);
  });

  it.each([
    ["app", "not-found.tsx"],
    ["app", "error.tsx"],
    ["app", "forbidden.tsx"],
    ["app", "page.tsx"],
    ["app", "forbidden", "page.tsx"],
  ])("should give %s/%s a skip link and a main landmark through StandalonePage", (...parts) => {
    expect(read(...parts)).toContain("<StandalonePage");
  });

  it("should give the sign-in pages a skip link and the main landmark", () => {
    const layout = read("app", "(auth)", "layout.tsx");

    expect(layout).toContain("<SkipLink />");
    expect(layout).toContain("id={MAIN_CONTENT_ID}");
  });

  it("should give every navigation landmark a name, also a pagination", () => {
    const unnamed = sourceFiles().flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/<nav\b[^>]*>/g)]
        .filter((tag) => !tag[0].includes("aria-label"))
        .map(() => relative(SRC_DIR, file)),
    );

    expect(unnamed).toEqual([]);
  });

  it("should name the sidebar", () => {
    expect(read("components", "layout", "desktop-sidebar.tsx")).toContain('aria-label="Sidebar"');
  });
});

describe("order of the shell for a keyboard user (UI-F02-S05, spec R13)", () => {
  const shell = read("components", "layout", "app-shell.tsx");
  const at = (text: string) => {
    const index = shell.indexOf(text);
    expect(index, text).toBeGreaterThanOrEqual(0);
    return index;
  };

  it("should reach the skip link, the app bar, the sidebar, the top bar, the content and the bottom bar, in that order", () => {
    const order = ["<SkipLink />", "<MobileAppBar", "<DesktopSidebar", "<TopBar", "<main", "<BottomNav"].map(at);

    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("should give every file of the shell that has a link or a native button a visible focus outline", () => {
    // A coarse check per file. The per-item check is a walk through the shell with the Tab key.
    const layoutDir = join(SRC_DIR, "components", "layout");
    const missing = readdirSync(layoutDir)
      .filter((name) => /\.tsx$/.test(name) && !/\.test\./.test(name))
      .filter((name) => {
        const source = readFileSync(join(layoutDir, name), "utf8");
        return /<(Link|button)\b/.test(source) && !/focus-visible:(-?outline|ring)/.test(source);
      });

    expect(missing).toEqual([]);
  });

  it("should use a solid outline for the buttons of the shell, not the half see-through ring", () => {
    const focus = read("lib", "layout", "focus.ts");

    expect(focus).toContain("focus-visible:outline-solid");
    expect(focus).toContain("focus-visible:outline-ring");
    expect(focus).not.toContain("ring-ring/50");
  });

  it.each(["desktop-sidebar.tsx", "user-menu.tsx"])("should give %s the shell button focus", (file) => {
    expect(read("components", "layout", file)).toContain("SHELL_BUTTON_FOCUS");
  });
});

describe("the shell stays when a page loads or fails (UI-F02-S05, spec E5)", () => {
  it.each(SHELL_GROUPS)("should have %s catch the errors of every page that has no boundary of its own", (group) => {
    const error = read("app", group, "error.tsx");

    expect(error).toContain('"use client"');
    expect(error).toContain("<PageError");
  });

  it.each(SHELL_GROUPS)("should not give %s a loading.tsx of its own, so the 403 of its guards keeps its status", (group) => {
    // A loading.tsx at the top of a group puts every guard layout below it inside a Suspense
    // boundary: the page starts to stream first and a forbidden() that comes later can no
    // longer change the status from 200 to 403 (UI-F02-S04, AC03).
    expect(existsSync(join(APP_DIR, group, "loading.tsx"))).toBe(false);
  });

  it("should give every page of a shell group an error boundary at or above it, inside its group", () => {
    const missing = SHELL_GROUPS.flatMap((group) =>
      pagesOf(group)
        .filter((page) => !foldersAbove(page, group).some((dir) => existsSync(join(dir, "error.tsx"))))
        .map((page) => relative(APP_DIR, page)),
    );

    expect(missing).toEqual([]);
  });

  it("should not render the shell in the error boundary of a group: it only fills the content area", () => {
    for (const group of SHELL_GROUPS) {
      expect(read("app", group, "error.tsx")).not.toContain("AppShell");
    }
  });
});

describe("hiding an item is only cosmetic (UI-F02-S05, spec R9)", () => {
  const GUARD = /require(Permission|AnyPermission|Role|PartnerScope)\b/;

  it("should put every page of the admin, partner and technician areas behind a guard of the server", () => {
    const unguarded = ["(admin)", "(partner)", "(technician)"].flatMap((group) =>
      pagesOf(group)
        .filter((page) => {
          const folders = foldersAbove(page, group);
          const own = GUARD.test(readFileSync(page, "utf8"));
          const above = folders.some((dir) => {
            const layout = join(dir, "layout.tsx");
            return existsSync(layout) && GUARD.test(readFileSync(layout, "utf8"));
          });
          return !own && !above;
        })
        .map((page) => relative(APP_DIR, page)),
    );

    expect(unguarded).toEqual([]);
  });

  it("should put every page of the dashboard group behind a guard, but for the ones open to any signed-in role", () => {
    const unguarded = pagesOf("(dashboard)")
      .filter((page) => {
        const folders = foldersAbove(page, "(dashboard)");
        const own = GUARD.test(readFileSync(page, "utf8"));
        const above = folders.some((dir) => {
          const layout = join(dir, "layout.tsx");
          return existsSync(layout) && GUARD.test(readFileSync(layout, "utf8"));
        });
        return !own && !above;
      })
      .map((page) => relative(APP_DIR, page).split(sep).join("/"));

    // The QR scan page is open to any signed-in role on purpose: it shows only the seats that
    // the row-level security of the user lets through (CO-F04-S13).
    expect(unguarded).toEqual(["(dashboard)/q/[token]/page.tsx"]);
  });
});
