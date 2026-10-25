import { z } from "zod";

/**
 * UI-F01-S03: the three choices of the theme control and what they mean. The choice is kept on
 * the device (spec OOS-1: nothing is stored on the server).
 */
export const THEMES = ["light", "dark", "system"] as const;
export const themeSchema = z.enum(THEMES);

export type Theme = z.infer<typeof themeSchema>;
export type ResolvedTheme = "light" | "dark";

/** What a visitor gets before any choice, and when the saved value is missing or invalid (E2). */
export const DEFAULT_THEME: Theme = "system";

export const THEME_STORAGE_KEY = "theme";
export const DARK_CLASS = "dark";
export const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/** A saved value as a theme; anything that is not one of the three gives the default. */
export function parseStoredTheme(raw: unknown): Theme {
  const parsed = themeSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_THEME;
}

/** The look to draw: System follows the device. */
export function resolveTheme(theme: Theme, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === "system") return systemPrefersDark ? "dark" : "light";
  return theme;
}

/** The sentence a screen reader hears after a choice (Success), or why it was not kept (Error). */
export function themeStatusMessage(theme: Theme, saved: boolean): string {
  const base = `Theme: ${THEME_LABELS[theme]}.`;
  return saved ? base : `${base} It could not be saved on this device.`;
}

/** What the toggle switches to: the opposite of the look on screen. */
export function oppositeTheme(resolved: ResolvedTheme): ResolvedTheme {
  return resolved === "dark" ? "light" : "dark";
}
