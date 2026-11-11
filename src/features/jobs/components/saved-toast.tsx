"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { toast } from "@/components/ui/toast";

/**
 * Tells the person that a step was saved, once, and takes the `saved` mark off the address so a reload or
 * a shared link does not say it again.
 */
export function SavedToast({ message }: { message: string }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    toast(message, "success");
    router.replace(pathname, { scroll: false });
  }, [message, pathname, router]);

  return null;
}
