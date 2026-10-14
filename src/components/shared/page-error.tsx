"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface PageErrorProps {
  title: string;
  description?: string;
  reset?: () => void;
}

/**
 * Shared error state for `error.tsx` boundaries. Never renders
 * `error.message` — raw errors must not reach the client.
 */
export function PageError({
  title,
  description = "Something went wrong. Please try again.",
  reset,
}: PageErrorProps) {
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
