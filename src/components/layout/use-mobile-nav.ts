"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Same breakpoint the shell uses to switch to the fixed sidebar (`md`). */
export const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

/**
 * The More sheet is open only for the route it was opened on, so navigating
 * (or any pathname change) closes it without a state-setting effect.
 */
export function isMobileNavOpen(
  openedAtPath: string | null,
  pathname: string,
): boolean {
  return openedAtPath === pathname;
}

export function useMobileNav() {
  const pathname = usePathname();
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);

  const open = isMobileNavOpen(openedAtPath, pathname);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpenedAtPath(null);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return {
    open,
    setOpen: (next: boolean) => setOpenedAtPath(next ? pathname : null),
    close: () => setOpenedAtPath(null),
  };
}
