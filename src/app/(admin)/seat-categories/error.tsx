"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface SeatCategoriesErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SeatCategoriesError({
  reset,
}: SeatCategoriesErrorProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Alert variant="destructive">
        <AlertTitle>Could not load seat categories</AlertTitle>
        <AlertDescription>
          Something went wrong. Please try again.
        </AlertDescription>
      </Alert>
      <div>
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
