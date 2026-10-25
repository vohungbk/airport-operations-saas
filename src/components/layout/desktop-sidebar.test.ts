import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const LAYOUT_DIR = join(process.cwd(), "src", "components", "layout");
const read = (name: string) => readFileSync(join(LAYOUT_DIR, name), "utf8");

describe("desktop sidebar", () => {
  const sidebar = read("desktop-sidebar.tsx");

  it("should show only from the md breakpoint and stay off the printed page", () => {
    expect(sidebar).toMatch(/"hidden [^"]*md:flex print:hidden"/);
  });

  it("should be 256 px expanded and 72 px collapsed", () => {
    expect(sidebar).toContain("SIDEBAR_WIDTH_CLASS.collapsed");
    expect(sidebar).toContain("SIDEBAR_WIDTH_CLASS.expanded");
  });

  it("should have a collapse button that says what it does and whether the sidebar is open", () => {
    expect(sidebar).toContain('collapsed ? "Expand sidebar" : "Collapse sidebar"');
    expect(sidebar).toContain("aria-label={label}");
    expect(sidebar).toContain("aria-expanded={!collapsed}");
    expect(sidebar).toContain("onClick={toggle}");
  });

  it("should pass the collapsed state to the menu", () => {
    expect(sidebar).toContain("<SidebarNav items={items} collapsed={collapsed}");
  });

  it("should not hold the account menu, the theme control or sign out: they are in the top bar", () => {
    expect(sidebar).not.toMatch(/ThemeControl|LogoutButton|UserMenu|user\./);
  });

  it("should start from the width the server read, so the first paint is right", () => {
    expect(sidebar).toContain("useSidebarCollapsed(initialCollapsed)");
  });

  it("should give tooltips a provider", () => {
    expect(sidebar).toContain("<TooltipProvider>");
  });

  it("should show the name of the product only while expanded", () => {
    expect(sidebar).toMatch(/!collapsed && \(\s*<span[^>]*>\s*Airport Operations/);
  });
});

describe("app shell and the saved sidebar width", () => {
  const shell = read("app-shell.tsx");

  it("should read the cookie on the server and hand the choice to the sidebar", () => {
    expect(shell).toContain("(await cookies()).get(SIDEBAR_COOKIE)?.value");
    expect(shell).toContain("parseSidebarCollapsed(");
    expect(shell).toContain("initialCollapsed={initialCollapsed}");
  });

  it("should keep the phone navigation apart from the sidebar: it never gets the collapsed state", () => {
    expect(read("bottom-nav.tsx")).not.toContain("collapsed");
    expect(read("more-sheet.tsx")).not.toContain("collapsed");
  });
});

describe("collapse hook", () => {
  const hook = read("use-sidebar-collapsed.ts");

  it("should write the cookie when the choice changes", () => {
    expect(hook).toContain("document.cookie = sidebarCookie(next)");
  });
});
