import Link from "next/link";
import { CircleCheck, FileText } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { StatCard } from "@/features/bookings/components/import-validation-report";
import type { ConfirmedImport } from "@/features/bookings/actions/confirm-booking-import.action";
import { formatBookingDateTime, formatTimeZoneLabel } from "@/features/bookings/lib/booking-time";
import { formatFileSize } from "@/features/bookings/lib/csv-file";

interface ImportSuccessProps {
  result: ConfirmedImport;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/**
 * CO-F07-S05 (design "Import bookings, Success"): what a confirmed import did: the bookings created, the rows
 * left out, and the record that was saved. "View import history" opens the history of imports (CO-F07-S07).
 */
export function ImportSuccess({ result }: ImportSuccessProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Source file" value={`${result.total} rows`} note="Total rows in uploaded CSV" />
        <StatCard label="Created" value={`${result.created} created`} note={`${result.created} bookings created`} tone="success" />
        <StatCard
          label="Excluded"
          value={`${result.excluded} with errors`}
          note="Not imported"
          tone={result.excluded > 0 ? "danger" : undefined}
        />
      </div>

      <section
        aria-labelledby="import-success-title"
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground md:p-6"
      >
        <Alert variant="success">
          <CircleCheck aria-hidden="true" />
          <AlertTitle>{result.created} bookings created</AlertTitle>
          <AlertDescription>
            {result.excluded > 0
              ? `The import is complete. ${result.excluded} rows with errors were excluded and no bookings were created for those rows.`
              : "The import is complete."}
          </AlertDescription>
        </Alert>

        <h2 id="import-success-title" className="text-base font-medium text-foreground">
          Import complete
        </h2>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted px-4 py-3">
          <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-sm font-medium text-foreground" title={result.file_name}>
              {result.file_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(result.file_size)} · Imported for {result.partner_name}
            </p>
          </div>
        </div>

        <dl className="grid gap-4 sm:grid-cols-3">
          <Detail label="Partner" value={result.partner_name} />
          <Detail
            label="Completed"
            value={`${formatBookingDateTime(result.completed_at, result.timezone)} · ${formatTimeZoneLabel(result.timezone)}`}
          />
          <Detail label="Imported by" value={result.imported_by} />
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CircleCheck className="size-3.5" aria-hidden="true" />A record of this import has been saved.
          </p>
          <Link
            href="/bookings/import/history"
            className={buttonVariants({ variant: "outline", className: "min-h-11 bg-surface px-4 dark:bg-surface" })}
          >
            View import history
          </Link>
        </div>
      </section>
    </div>
  );
}
