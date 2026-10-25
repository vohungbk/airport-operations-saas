import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  THEMES,
  THEME_LABELS,
  oppositeTheme,
  parseStoredTheme,
  resolveTheme,
  themeStatusMessage,
} from "@/lib/theme/theme";

describe("parseStoredTheme", () => {
  it.each(THEMES)("should accept the saved value %s", (theme) => {
    expect(parseStoredTheme(theme)).toBe(theme);
  });

  it.each([null, undefined, "", "Dark", "blue", "dark ", 1, {}])(
    "should use System when the saved value is %j",
    (raw) => {
      expect(parseStoredTheme(raw)).toBe(DEFAULT_THEME);
      expect(DEFAULT_THEME).toBe("system");
    },
  );
});

describe("resolveTheme", () => {
  it("should ignore the device when Light or Dark is chosen", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("should follow the device when System is chosen", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("themeStatusMessage", () => {
  it("should name the chosen theme", () => {
    expect(themeStatusMessage("dark", true)).toBe("Theme: Dark.");
  });

  it("should say the choice was not saved when saving failed", () => {
    expect(themeStatusMessage("light", false)).toContain("could not be saved");
  });

  it("should have a label for every theme", () => {
    expect(THEMES.map((t) => THEME_LABELS[t])).toEqual(["Light", "Dark", "System"]);
  });
});

describe("oppositeTheme", () => {
  it("should switch a light page to dark and a dark page to light", () => {
    expect(oppositeTheme("light")).toBe("dark");
    expect(oppositeTheme("dark")).toBe("light");
  });
});
