"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deactivatePartnerAction } from "@/features/partners/actions/deactivate-partner.action";
import type { PartnerActionError } from "@/features/partners/lib/partner-errors";

interface DeactivatePartnerButtonProps {
  partnerId: string;
  /** Kept for callers; the dialog of the design does not repeat the name. */
  partnerName?: string;
}

/**
 * Deactivation goes through the dedicated `deactivatePartnerAction`
 * (never the generic update action) and only ever sets
 * `status = 'inactive'`. `router.refresh()` re-runs the Server Component
 * data fetch on success so the detail page's status badge can't show a
 * stale `'active'` value after this succeeds — there is no client cache
 * to invalidate otherwise.
 */
export function DeactivatePartnerButton({
  partnerId,
}: DeactivatePartnerButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<PartnerActionError | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deactivatePartnerAction({ partner_id: partnerId });

      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? null);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="min-h-11 border-destructive bg-surface px-4 text-danger-fg hover:bg-danger-bg dark:bg-surface"
          />
        }
      >
        Deactivate
      </DialogTrigger>
      <DialogContent className="w-[358px] max-w-[calc(100%-1rem)] sm:w-[480px] sm:max-w-[480px] gap-6 p-6">
        <DialogHeader>
          <DialogTitle className="text-base leading-6 font-semibold text-foreground">
            Deactivate partner?
          </DialogTitle>
          <DialogDescription className="text-foreground">
            The partner will become inactive. All historical records are kept.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not deactivate partner</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="m-0 grid grid-cols-2 gap-3 border-0 bg-transparent p-0">
          <Button
            variant="outline"
            className="min-h-11 w-full rounded-lg bg-surface px-4 dark:bg-surface"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            className="min-h-11 w-full rounded-lg bg-danger px-4 text-surface hover:bg-danger/90"
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending ? "Deactivating..." : "Deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
