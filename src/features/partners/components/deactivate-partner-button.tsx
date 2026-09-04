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
  partnerName: string;
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
  partnerName,
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
      <DialogTrigger render={<Button variant="destructive" />}>
        Deactivate
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate {partnerName}?</DialogTitle>
          <DialogDescription>
            This sets the partner&apos;s status to &quot;inactive&quot;. It
            does not delete any data and can be reversed later from the edit
            form.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not deactivate partner</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
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
