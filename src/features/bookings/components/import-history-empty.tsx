import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/** CO-F07-S07 (Empty state of the design): no import yet, or none that the filters match. */
export function ImportHistoryEmpty() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-6 py-8 text-center">
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-foreground">No imports yet</h3>
        <p className="text-xs text-muted-foreground">Upload a booking CSV to start your import history.</p>
      </div>
      <Link href="/bookings/import" className={buttonVariants({ className: "min-h-11 px-8" })}>
        New import
      </Link>
    </div>
  );
}
