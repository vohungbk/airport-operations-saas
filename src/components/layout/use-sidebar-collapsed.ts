"use client";

import { useState } from "react";

import { sidebarCookie } from "@/lib/layout/sidebar-preference";

/**
 * Whether the desktop sidebar is collapsed. It starts from what the server read from the cookie,
 * so the first paint is already at the right width, and writes the cookie when the choice changes.
 */
export function useSidebarCollapsed(initial: boolean) {
  const [collapsed, setCollapsed] = useState(initial);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = sidebarCookie(next);
  };

  return { collapsed, toggle };
}
