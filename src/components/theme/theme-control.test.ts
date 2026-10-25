import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("theme control", () => {
  const control = read("src", "components", "theme", "theme-control.tsx");

  it("should be one button, not a menu of choices", () => {
    expect(control).toContain("<Button");
    expect(control).not.toMatch(/DropdownMenu|THEMES\.map/);
  });

  it("should show the moon on a light page and the sun on a dark page", () => {
    expect(control).toContain('<Moon aria-hidden="true" className="dark:hidden" />');
    expect(control).toContain('<Sun aria-hidden="true" className="hidden dark:block" />');
  });

  it("should switch to the opposite of the look on screen", () => {
    expect(control).toContain("oppositeTheme(resolved)");
    expect(control).toContain("setTheme(next)");
  });

  it("should name the button for the theme it switches to", () => {
    expect(control).toContain("`Switch to ${next} theme`");
    expect(control).toContain("aria-label={label}");
  });

  it("should stay disabled while the saved choice is being read", () => {
    expect(control).toContain("disabled={!ready}");
    expect(control).toContain("aria-busy={!ready}");
  });

  it("should announce the result after a press and tell when the choice was not saved", () => {
    expect(control).toContain('role="status"');
    expect(control).toContain("ready && pressed ? themeStatusMessage(next, saved)");
  });

  it("should not check a role, since every user and a signed-out visitor may use it", () => {
    expect(control).not.toMatch(/hasPermission|getCurrentUser|user\.role/);
  });
});

describe("where the theme control is placed", () => {
  it("should be in the mobile top bar and the desktop sidebar of the shell", () => {
    const shell = read("src", "components", "layout", "app-shell.tsx");
    const sidebar = read("src", "components", "layout", "desktop-sidebar.tsx");

    expect(shell).toMatch(/<header[\s\S]*<ThemeControl \/>[\s\S]*<\/header>/);
    expect(sidebar).toMatch(/<aside[\s\S]*<ThemeControl \/>[\s\S]*<\/aside>/);
  });

  it("should be on the sign-in pages and stay off the printed page", () => {
    const auth = read("src", "app", "(auth)", "layout.tsx");

    expect(auth).toContain("<ThemeControl />");
    expect(auth).toContain("print:hidden");
  });
});

describe("theme before the first paint", () => {
  const layout = read("src", "app", "layout.tsx");

  it("should run the theme script in the head", () => {
    expect(layout).toMatch(/<head>[\s\S]*THEME_INIT_SCRIPT[\s\S]*<\/head>/);
  });

  it("should allow the script to change the class of html before React loads", () => {
    expect(layout).toContain("suppressHydrationWarning");
  });
});
