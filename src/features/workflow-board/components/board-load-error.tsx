"use client";

import { useRouter } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** The board could not be read: the message and Retry, which reads the page again. The filters stay above it. */
export function BoardLoadError() {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-background p-8">
      <Alert role="alert" className="min-h-[104px] w-[500px] max-w-full rounded-md border-border bg-primary-subtle px-4 py-3 text-foreground">
        <TriangleAlertIcon aria-hidden="true" />
        <AlertTitle className="font-semibold">The board could not be loaded.</AlertTitle>
      </Alert>
      <Button type="button" variant="outline" className="min-h-11 w-60 rounded-md font-semibold" onClick={() => router.refresh()}>
        Retry
      </Button>
    </div>
  );
}
