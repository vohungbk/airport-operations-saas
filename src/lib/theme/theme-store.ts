import {
  DARK_CLASS,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  parseStoredTheme,
  resolveTheme,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme/theme";

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ThemeMedia {
  matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

export interface ThemeRoot {
  classList: { toggle(token: string, force: boolean): unknown };
}

export interface ThemeStoreDeps {
  /** `null` when the browser has no usable storage (blocked, private mode). */
  storage: ThemeStorage | null;
  media: ThemeMedia;
  root: ThemeRoot;
}

export interface ThemeState {
  theme: Theme;
  resolved: ResolvedTheme;
  /** False when the last choice could not be written to the device. */
  saved: boolean;
}

/**
 * UI-F01-S03: the theme of the page. It reads the saved choice, puts the `dark` class on the
 * root, follows the device while System is chosen (E3) and writes each new choice back (R3).
 * Every dependency is passed in, so it runs the same in a test as in the browser. The state is
 * replaced, never changed in place, so a snapshot only differs when the theme did.
 */
export function createThemeStore({ storage, media, root }: ThemeStoreDeps) {
  const listeners = new Set<() => void>();
  let state: ThemeState;

  const read = (): string | null => {
    try {
      return storage?.getItem(THEME_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  };

  const write = (theme: Theme): boolean => {
    try {
      if (!storage) return false;
      storage.setItem(THEME_STORAGE_KEY, theme);
      return true;
    } catch {
      return false;
    }
  };

  const stateOf = (theme: Theme, saved: boolean): ThemeState => ({
    theme,
    resolved: resolveTheme(theme, media.matches),
    saved,
  });

  const apply = (next: ThemeState) => {
    root.classList.toggle(DARK_CLASS, next.resolved === "dark");
    state = next;
    listeners.forEach((listener) => listener());
  };

  const stored = read();
  const initial = parseStoredTheme(stored);
  // A value that is there but not one of the three is replaced (E2).
  const replaced = stored !== null && stored !== initial ? write(DEFAULT_THEME) : true;
  state = stateOf(initial, replaced);
  root.classList.toggle(DARK_CLASS, state.resolved === "dark");

  const onDeviceChange = () => {
    if (state.theme === "system") apply(stateOf("system", state.saved));
  };

  return {
    getState: () => state,

    subscribe(listener: () => void) {
      if (listeners.size === 0) media.addEventListener("change", onDeviceChange);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) media.removeEventListener("change", onDeviceChange);
      };
    },

    setTheme(theme: Theme) {
      apply(stateOf(theme, write(theme)));
    },

    /** The same key changed in another tab: follow it without writing it back. */
    handleStorageEvent(event: { key: string | null; newValue: string | null }) {
      if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
      const theme = parseStoredTheme(event.newValue);
      if (theme !== state.theme) apply(stateOf(theme, true));
    },
  };
}

export type ThemeStore = ReturnType<typeof createThemeStore>;
