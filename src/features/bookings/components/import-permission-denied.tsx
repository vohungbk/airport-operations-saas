import Link from "next/link";
import { Lock } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

/** CO-F07-S01 (spec E8): what a user without the import permission sees on the import screen. */
export function ImportPermissionDenied() {
  return (
    <section
      aria-labelledby="import-denied-title"
      className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card px-6 py-12 text-center"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Lock className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 id="import-denied-title" className="text-base font-medium text-foreground">
          You do not have permission to import bookings
        </h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          Contact your administrator to request booking import access. Your current role does not
          allow you to upload or create bookings from a file.
        </p>
      </div>
      <Link
        href="/bookings"
        className={buttonVariants({ variant: "outline", className: "min-h-11 bg-surface px-4 dark:bg-surface" })}
      >
        Back to bookings
      </Link>
    </section>
  );
}
