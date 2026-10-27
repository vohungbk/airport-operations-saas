"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageMessage } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";

interface PageErrorProps {
  title: string;
  description?: string;
  reset?: () => void;
  /**
   * For a page with no shell around it (the error at the root): the message is centered like the
   * forbidden and not-found pages. Inside a shell the alert stays at the top of the content.
   */
  centered?: boolean;
}

/**
 * Shared error state for `error.tsx` boundaries. Never renders
 * `error.message` — raw errors must not reach the client.
 */
export function PageError({
  title,
  description = "Something went wrong. Please try again.",
  reset,
  centered = false,
}: PageErrorProps) {
  if (centered) {
    return (
      <PageMessage role="alert" title={title} description={description}>
        {reset ? (
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        ) : null}
      </PageMessage>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Alert variant="destructive">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
      {reset ? (
        <div>
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
