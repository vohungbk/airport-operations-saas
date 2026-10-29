import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { listSourceFiles } from "@/lib/accessibility/source-files";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme-script";
import { createThemeStore } from "@/lib/theme/theme-store";

/**
 * One device: the storage lives on after each visit. A visit is a new page, with its own script
 * run and its own store, as after a reload or in a new tab.
 */
function device(options: { dark?: boolean } = {}) {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
  const deviceDark = options.dark ?? false;

  return {
    data,
    /** The page before anything is drawn: only the script has run. */
    firstPaint() {
      let dark = false;
      runInNewContext(THEME_INIT_SCRIPT, {
        localStorage: storage,
        window: { matchMedia: () => ({ matches: deviceDark }) },
        document: { documentElement: { classList: { toggle: (_: string, f: boolean) => void (dark = f) } } },
      });
      return dark;
    },
    /** The page once it is running: the store of that visit. */
    open() {
      const classes = new Set<string>();
      const listeners = new Set<() => void>();
      const media = {
        matches: deviceDark,
        addEventListener: (_: "change", l: () => void) => void listeners.add(l),
        removeEventListener: (_: "change", l: () => void) => void listeners.delete(l),
      };
      const store = createThemeStore({
        storage,
        media,
        root: { classList: { toggle: (t: string, f: boolean) => void (f ? classes.add(t) : classes.delete(t)) } },
      });
      return {
        store,
        isDark: () => classes.has("dark"),
        /** The device setting changes while the page is open. */
        changeDevice(dark: boolean) {
          media.matches = dark;
          listeners.forEach((l) => l());
        },
      };
    },
  };
}

const STEP_DRAFT_FILES = new Set([
  join("features", "jobs", "lib", "step-draft.ts"),
  join("features", "jobs", "hooks", "use-step-draft.ts"),
]);

describe("remembering the theme between visits", () => {
  it("should start the next visit with the theme that was selected", () => {
    const d = device();
    d.open().store.setTheme("dark");

    expect(d.firstPaint()).toBe(true);
    const next = d.open();
    expect(next.store.getState().theme).toBe("dark");
    expect(next.isDark()).toBe(true);
  });

  it("should keep Light on a dark device after Light was selected", () => {
    const d = device({ dark: true });
    d.open().store.setTheme("light");

    expect(d.firstPaint()).toBe(false);
    expect(d.open().isDark()).toBe(false);
  });

  it("should remember the last choice after several changes", () => {
    const d = device();
    const first = d.open();
    first.store.setTheme("dark");
    first.store.setTheme("light");
    first.store.setTheme("dark");

    expect(d.firstPaint()).toBe(true);
  });

  it("should give the script and the store the same answer for every saved value", () => {
    for (const saved of [null, "light", "dark", "system", "purple", ""]) {
      for (const dark of [true, false]) {
        const d = device({ dark });
        if (saved !== null) d.data.set(THEME_STORAGE_KEY, saved);

        const paint = d.firstPaint();
        expect(d.open().isDark(), `saved=${JSON.stringify(saved)} deviceDark=${dark}`).toBe(paint);
      }
    }
  });
});

describe("a saved value that is invalid", () => {
  it("should be replaced by system on first paint, with no theme control on the page", () => {
    const d = device({ dark: true });
    d.data.set(THEME_STORAGE_KEY, "purple");

    expect(d.firstPaint()).toBe(true);
    expect(d.data.get(THEME_STORAGE_KEY)).toBe("system");
  });

  it("should leave nothing saved when the value is missing", () => {
    const d = device();

    d.firstPaint();
    d.open();

    expect(d.data.has(THEME_STORAGE_KEY)).toBe(false);
  });
});

describe("a visitor who is signed out", () => {
  it("should keep the choice made on the sign-in page after signing in", () => {
    const d = device();
    // On the sign-in page: the visitor presses the toggle.
    d.open().store.setTheme("dark");

    // After signing in the next page is a new page on the same device.
    expect(d.firstPaint()).toBe(true);
    expect(d.open().store.getState().theme).toBe("dark");
  });

  it("should not touch the saved theme anywhere else in the application", () => {
    const srcDir = join(process.cwd(), "src");
    const touching = listSourceFiles(srcDir)
      .filter((file) => !relative(srcDir, file).startsWith(join("lib", "theme")))
      .filter((file) => {
        const text = readFileSync(file, "utf8");

        // The draft of a step form (UI-F07-S04) uses sessionStorage only, never the localStorage of the theme.
        return STEP_DRAFT_FILES.has(relative(srcDir, file))
          ? /\blocalStorage\b/.test(text)
          : /\b(?:localStorage|sessionStorage)\b/.test(text);
      })
      .map((file) => relative(srcDir, file));

    // Sign-in and sign-out must not clear what the theme saved.
    expect(touching).toEqual([]);
  });
});

describe("the device setting changes while System is in use", () => {
  it("should change the theme at once, without a reload", () => {
    const d = device({ dark: false });
    const page = d.open();
    page.store.subscribe(() => {});
    expect(page.isDark()).toBe(false);

    page.changeDevice(true);
    expect(page.isDark()).toBe(true);

    page.changeDevice(false);
    expect(page.isDark()).toBe(false);
  });

  it("should stop following the device once the visitor has pressed the toggle", () => {
    const d = device({ dark: false });
    const page = d.open();
    page.store.subscribe(() => {});

    page.store.setTheme("light");
    page.changeDevice(true);

    expect(page.isDark()).toBe(false);
  });
});
