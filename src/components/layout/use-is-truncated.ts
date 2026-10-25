"use client";

import { useEffect, useRef, useState } from "react";

/** Whether the text of an element is wider than the element, so part of it is cut. */
export function isTruncated(el: { scrollWidth: number; clientWidth: number }): boolean {
  return el.scrollWidth > el.clientWidth;
}

/**
 * Whether the element is cutting its text now, kept up to date as it is resized. Used to show a
 * tooltip with the full text only when something is hidden.
 */
export function useIsTruncated<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The observer calls back once when it starts, so the first value is set there.
    const observer = new ResizeObserver(() => setTruncated(isTruncated(el)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, truncated };
}
