import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const LAYOUT_DIR = join(process.cwd(), "src", "components", "layout");
const read = (name: string) => readFileSync(join(LAYOUT_DIR, name), "utf8");

describe("app shell responsive layout", () => {
  const shell = read("app-shell.tsx");

  it("should hide the fixed sidebar below the md breakpoint", () => {
    const sidebar = read("desktop-sidebar.tsx");

    expect(shell).toContain("<DesktopSidebar");
    expect(sidebar).toMatch(/<aside[\s\S]*"hidden [^"]*md:flex/);
  });

  it("should render the mobile top bar only below the md breakpoint", () => {
    expect(shell).toMatch(/<header className="[^"]*md:hidden/);
    expect(shell).toContain("<MobileNav");
  });

  it("should let main shrink so wide content cannot push the page sideways", () => {
    expect(shell).toMatch(/<main className="[^"]*min-w-0/);
  });
});

describe("mobile nav accessibility", () => {
  const mobileNav = read("mobile-nav.tsx");

  it("should label the menu button for assistive technology", () => {
    expect(mobileNav).toContain('aria-label="Open navigation menu"');
  });

  it("should provide a dialog title for the drawer", () => {
    expect(mobileNav).toContain("<DialogTitle");
  });

  it("should keep sign out reachable inside the drawer", () => {
    expect(mobileNav).toContain("<LogoutButton");
  });
});
