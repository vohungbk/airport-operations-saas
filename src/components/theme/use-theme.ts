"use client";

import { useSyncExternalStore } from "react";

import { SERVER_THEME_STATE, getBrowserThemeStore } from "@/lib/theme/browser-theme-store";
import type { Theme } from "@/lib/theme/theme";

const subscribe = (listener: () => void) => getBrowserThemeStore().subscribe(listener);
const getSnapshot = () => getBrowserThemeStore().getState();
const getServerSnapshot = () => SERVER_THEME_STATE;

/**
 * The theme of the page for a client component. `ready` is false until the browser has read the
 * saved choice, which is the Loading state of the theme control.
 */
export function useTheme() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    ...state,
    ready: state !== SERVER_THEME_STATE,
    setTheme: (theme: Theme) => getBrowserThemeStore().setTheme(theme),
  };
}
