import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "@/lib/theme/theme";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme-script";

/** Runs the script as a browser would and says whether the dark class ended up on the root. */
function run(options: { saved?: string | null; deviceDark?: boolean; blocked?: boolean }) {
  let dark = false;
  const sandbox = {
    localStorage: {
      getItem: (key: string) => {
        if (options.blocked) throw new Error("blocked");
        return key === THEME_STORAGE_KEY ? (options.saved ?? null) : null;
      },
    },
    window: { matchMedia: () => ({ matches: options.deviceDark ?? false }) },
    document: {
      documentElement: { classList: { toggle: (_: string, force: boolean) => void (dark = force) } },
    },
  };

  runInNewContext(THEME_INIT_SCRIPT, sandbox);
  return dark;
}

describe("theme init script", () => {
  it("should apply a saved Dark before the first paint", () => {
    expect(run({ saved: "dark", deviceDark: false })).toBe(true);
  });

  it("should keep Light on a dark device when Light is saved", () => {
    expect(run({ saved: "light", deviceDark: true })).toBe(false);
  });

  it("should follow the device when System is saved", () => {
    expect(run({ saved: "system", deviceDark: true })).toBe(true);
    expect(run({ saved: "system", deviceDark: false })).toBe(false);
  });

  it("should follow the device when nothing is saved", () => {
    expect(run({ saved: null, deviceDark: true })).toBe(true);
  });

  it("should follow the device when the saved value is invalid", () => {
    expect(run({ saved: "purple", deviceDark: true })).toBe(true);
  });

  it("should not throw when storage is blocked", () => {
    expect(() => run({ blocked: true })).not.toThrow();
    expect(run({ blocked: true, deviceDark: true })).toBe(false);
  });
});
