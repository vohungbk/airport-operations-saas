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
import { setSeatCategoryActiveAction } from "@/features/seat-categories/actions/set-seat-category-active.action";
import type { SeatCategoryActionError } from "@/features/seat-categories/lib/seat-category-errors";

interface SetSeatCategoryActiveButtonProps {
  seatCategoryId: string;
  seatCategoryName: string;
  isActive: boolean;
}

/**
 * Toggles `is_active` through the dedicated action (soft only, never a
 * delete). `router.refresh()` re-runs the Server Component fetch so the
 * status badge cannot go stale.
 */
export function SetSeatCategoryActiveButton({
  seatCategoryId,
  seatCategoryName,
  isActive,
}: SetSeatCategoryActiveButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<SeatCategoryActionError | null>(null);

  const verb = isActive ? "Deactivate" : "Activate";
  const pendingVerb = isActive ? "Deactivating..." : "Activating...";

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await setSeatCategoryActiveAction({
        seat_category_id: seatCategoryId,
        is_active: !isActive,
      });

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
        render={<Button variant={isActive ? "destructive" : "outline"} />}
      >
        {verb}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {verb} {seatCategoryName}?
          </DialogTitle>
          <DialogDescription>
            {isActive
              ? "This marks the category as inactive. It does not delete any data and can be reversed later."
              : "This marks the category as active again."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>
              Could not {verb.toLowerCase()} seat category
            </AlertTitle>
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
            variant={isActive ? "destructive" : "default"}
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending ? pendingVerb : verb}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
