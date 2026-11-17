"use client";

import { Button } from "@/components/ui/button";
import { PartnerDetailBackLink } from "@/features/partners/components/partner-detail-back-link";

interface PartnerDetailErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Never renders `error.message`: a raw error must not reach the client. */
export default function PartnerDetailError({ reset }: PartnerDetailErrorProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-8">
      <PartnerDetailBackLink />
      <div
        role="alert"
        className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border bg-card px-6 py-12 text-center"
      >
        <p className="text-xs font-medium text-danger-fg">Connection error</p>
        <h1 className="text-lg font-semibold text-foreground">
          Unable to load this partner
        </h1>
        <p className="max-w-md text-xs text-muted-foreground">
          Check your connection, then try again.
        </p>
        <Button onClick={reset} className="mt-2 min-h-11 px-4">
          Try again
        </Button>
      </div>
    </div>
  );
}
