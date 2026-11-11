"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InspectionDiscardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}

/** Cancel with something entered: nothing is saved, so the user confirms the loss. */
export function InspectionDiscardDialog({
  open,
  onOpenChange,
  onDiscard,
}: InspectionDiscardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Discard this inspection?
          </DialogTitle>
          <DialogDescription>
            What you entered will not be saved.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-11 flex-1 bg-surface sm:flex-none"
          >
            Keep editing
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onDiscard}
            className="min-h-11 flex-1 sm:flex-none"
          >
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
