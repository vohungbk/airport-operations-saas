"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface PreviewSheetProps {
  /** The board without the booking: where closing the preview goes. */
  closeHref: string;
  children: ReactNode;
}

/**
 * The side panel of the booking preview. It is open while the address names a booking, and closing it
 * goes back to the board's address without the booking. The content is rendered on the server.
 */
export function PreviewSheet({ closeHref, children }: PreviewSheetProps) {
  const router = useRouter();

  return (
    <Sheet open onOpenChange={(open) => !open && router.push(closeHref)}>
      <SheetContent side="right" className="w-full gap-6 overflow-y-auto p-6 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-2xl font-semibold">Booking preview</SheetTitle>
          <SheetDescription className="sr-only">
            The current step and the step history of the selected booking.
          </SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
