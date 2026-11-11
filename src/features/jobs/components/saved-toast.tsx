"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { toast } from "@/components/ui/toast";

/**
 * Tells the person that a step was saved, once, and takes the `saved` mark off the address so a reload or
 * a shared link does not say it again. The ref keeps it to one toast when React runs the effect twice (Strict
 * Mode in development) or again after the address changes.
 */
export function SavedToast({ message }: { message: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast(message, "success");
    router.replace(pathname, { scroll: false });
  }, [message, pathname, router]);

  return null;
}
