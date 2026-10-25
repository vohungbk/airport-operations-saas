import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

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
      const store = createThemeStore({
        storage,
        media: { matches: deviceDark, addEventListener: () => {}, removeEventListener: () => {} },
        root: { classList: { toggle: (t: string, f: boolean) => void (f ? classes.add(t) : classes.delete(t)) } },
      });
      return { store, isDark: () => classes.has("dark") };
    },
  };
}

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
