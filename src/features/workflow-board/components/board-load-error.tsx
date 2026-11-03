"use client";

import { useRouter } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** The board could not be read: the message and Retry, which reads the page again. The filters stay above it. */
export function BoardLoadError() {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/40 p-8">
      <Alert role="alert" className="max-w-xl bg-info-bg text-info-fg">
        <TriangleAlertIcon aria-hidden="true" />
        <AlertTitle className="font-semibold">The board could not be loaded.</AlertTitle>
      </Alert>
      <Button type="button" variant="outline" className="min-h-11 px-8 font-semibold" onClick={() => router.refresh()}>
        Retry
      </Button>
    </div>
  );
}
