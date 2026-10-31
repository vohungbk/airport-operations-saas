"use client";

import type { LucideIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface DownloadActionButtonProps {
  icon: LucideIcon;
  label: string;
  pendingLabel: string;
  errorTitle: string;
  variant?: "default" | "outline";
  download: () => void;
  isPending: boolean;
  error: string | null;
}

/** A download button of the invoice detail. A failure shows an alert with Retry; the invoice is not touched. */
export function DownloadActionButton({
  icon: Icon,
  label,
  pendingLabel,
  errorTitle,
  variant = "default",
  download,
  isPending,
  error,
}: DownloadActionButtonProps) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button type="button" variant={variant} className="min-h-11 px-4" disabled={isPending} onClick={download}>
          <Icon aria-hidden="true" />
          {isPending ? pendingLabel : label}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            {error}
            <Button type="button" variant="outline" className="min-h-11 px-4" disabled={isPending} onClick={download}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
