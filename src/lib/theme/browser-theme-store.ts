import { DARK_MEDIA_QUERY } from "@/lib/theme/theme";
import { createThemeStore, type ThemeState, type ThemeStorage, type ThemeStore } from "@/lib/theme/theme-store";

let store: ThemeStore | null = null;

/** The storage of the device, or null when the browser blocks it. */
function deviceStorage(): ThemeStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The one theme store of this page, made on first use. Browser only. */
export function getBrowserThemeStore(): ThemeStore {
  if (!store) {
    store = createThemeStore({
      storage: deviceStorage(),
      media: window.matchMedia(DARK_MEDIA_QUERY),
      root: document.documentElement,
    });
    window.addEventListener("storage", (event) => store?.handleStorageEvent(event));
  }
  return store;
}

/** What the server renders: nothing is known about the device yet. */
export const SERVER_THEME_STATE: ThemeState = { theme: "system", resolved: "light", saved: true };
