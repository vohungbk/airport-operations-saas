"use client";

import { PageError } from "@/components/shared/page-error";
import { StandalonePage } from "@/components/shared/standalone-page";

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * The last boundary before Next's default error page. A layout's own error is
 * not caught by the `error.tsx` of its segment, only by the one above it, so
 * this is what catches a failed profile read in `requireAuth` (the network or
 * the database) and offers a retry. It is not a "forbidden" page.
 */
export default function AppError({ reset }: AppErrorProps) {
  return (
    <StandalonePage>
      <PageError title="Could not load this page" reset={reset} />
    </StandalonePage>
  );
}
