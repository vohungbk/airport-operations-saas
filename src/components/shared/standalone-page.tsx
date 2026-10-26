import type { ReactNode } from "react";

import { MAIN_CONTENT_ID, SkipLink } from "@/components/shared/skip-link";
import { cn } from "@/lib/utils";

interface StandalonePageProps {
  children: ReactNode;
  className?: string;
}

/**
 * UI-F02-S05 (spec R12): a page that has no shell (sign-in, the no-access page, not found, an
 * error at the root) still has a skip link and one main landmark. A page inside the shell does
 * not use this: `AppShell` has its own main.
 */
export function StandalonePage({ children, className }: StandalonePageProps) {
  return (
    <>
      <SkipLink />
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className={cn(
          "flex flex-1 flex-col focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
          className,
        )}
      >
        {children}
      </main>
    </>
  );
}
