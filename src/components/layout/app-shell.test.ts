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

  it("should render the app bar and the bottom navigation only below the md breakpoint", () => {
    expect(read("mobile-app-bar.tsx")).toMatch(/<header className="[^"]*md:hidden/);
    expect(read("bottom-nav.tsx")).toMatch(/<nav[\s\S]*md:hidden/);
    expect(shell).toContain("<MobileAppBar");
    expect(shell).toContain("<BottomNav");
  });

  it("should let main shrink so wide content cannot push the page sideways", () => {
    expect(shell).toMatch(/<main className="[^"]*min-w-0/);
  });
});

describe("more sheet accessibility", () => {
  const sheet = read("more-sheet.tsx");

  it("should be a dialog that says it is one, from a button of the bar", () => {
    expect(sheet).toContain('aria-haspopup="dialog"');
    expect(sheet).toContain("<DialogTrigger");
  });

  it("should provide a dialog title for the sheet", () => {
    expect(sheet).toContain("<DialogTitle");
  });

  it("should keep sign out and the theme control reachable inside the sheet", () => {
    expect(sheet).toContain("<LogoutButton");
    expect(sheet).toContain("<ThemeControl");
  });
});
