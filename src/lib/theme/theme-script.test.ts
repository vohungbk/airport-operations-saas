import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "@/lib/theme/theme";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme-script";

interface RunOptions {
  saved?: string | null;
  deviceDark?: boolean;
  /** Reading the saved value throws. */
  blocked?: boolean;
  /** Writing the saved value throws. */
  readOnly?: boolean;
}

/** Runs the script as a browser would and says what it did to the page and to the storage. */
function run(options: RunOptions) {
  let dark = false;
  const writes: [string, string][] = [];
  const sandbox = {
    localStorage: {
      getItem: (key: string) => {
        if (options.blocked) throw new Error("blocked");
        return key === THEME_STORAGE_KEY ? (options.saved ?? null) : null;
      },
      setItem: (key: string, value: string) => {
        if (options.readOnly) throw new Error("full");
        writes.push([key, value]);
      },
    },
    window: { matchMedia: () => ({ matches: options.deviceDark ?? false }) },
    document: {
      documentElement: { classList: { toggle: (_: string, force: boolean) => void (dark = force) } },
    },
  };

  runInNewContext(THEME_INIT_SCRIPT, sandbox);
  return { dark, writes };
}

describe("theme init script", () => {
  it("should apply a saved Dark before the first paint", () => {
    expect(run({ saved: "dark", deviceDark: false }).dark).toBe(true);
  });

  it("should keep Light on a dark device when Light is saved", () => {
    expect(run({ saved: "light", deviceDark: true }).dark).toBe(false);
  });

  it("should follow the device when System is saved", () => {
    expect(run({ saved: "system", deviceDark: true }).dark).toBe(true);
    expect(run({ saved: "system", deviceDark: false }).dark).toBe(false);
  });

  it("should follow the device and write nothing when nothing is saved", () => {
    const result = run({ saved: null, deviceDark: true });

    expect(result.dark).toBe(true);
    expect(result.writes).toEqual([]);
  });

  it("should write nothing when the saved value is already valid", () => {
    expect(run({ saved: "dark" }).writes).toEqual([]);
    expect(run({ saved: "system" }).writes).toEqual([]);
  });
});

describe("theme init script: a saved value that is not valid", () => {
  it.each(["purple", "Dark", "", "dark ", "null", "undefined"])(
    "should follow the device and replace %j with system",
    (saved) => {
      const result = run({ saved, deviceDark: true });

      expect(result.dark).toBe(true);
      expect(result.writes).toEqual([[THEME_STORAGE_KEY, "system"]]);
    },
  );

  it("should still apply the theme when the replacement cannot be written", () => {
    expect(run({ saved: "purple", deviceDark: true, readOnly: true }).dark).toBe(true);
  });
});

describe("theme init script: storage that fails", () => {
  it("should not throw and keep the default look when reading is blocked", () => {
    expect(() => run({ blocked: true })).not.toThrow();
    expect(run({ blocked: true, deviceDark: true }).dark).toBe(false);
  });
});

describe("theme init script: where it runs", () => {
  const layout = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");

  it("should be the first thing in the head, before any other element", () => {
    expect(layout).toMatch(/<head>\s*<script dangerouslySetInnerHTML=\{\{ __html: THEME_INIT_SCRIPT \}\} \/>\s*<\/head>/);
    expect(layout.indexOf("<head>")).toBeLessThan(layout.indexOf("<body"));
  });

  it("should run at once, not after the page: no async and no defer", () => {
    const tag = layout.match(/<script[^>]*THEME_INIT_SCRIPT[^>]*\/>/)?.[0] ?? "";

    expect(tag).not.toMatch(/\b(async|defer)\b/);
    expect(tag).not.toContain("src=");
  });
});
