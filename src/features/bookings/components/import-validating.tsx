import { FileText, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/features/bookings/lib/csv-file";

interface ImportValidatingProps {
  partnerLabel: string;
  file: Pick<File, "name" | "size">;
}

/** CO-F07-S03 (design "Import bookings, Validating"): the card while the server checks the file. Nothing can be changed meanwhile. */
export function ImportValidating({ partnerLabel, file }: ImportValidatingProps) {
  return (
    <section
      aria-labelledby="import-validating-title"
      aria-busy="true"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="import-validating-title" className="text-base font-medium text-foreground">
          Validate your booking file
        </h2>
        <p className="text-sm text-muted-foreground">We&apos;re checking the CSV structure and the booking details.</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm leading-none font-medium text-foreground">Partner *</p>
        <div className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-muted px-3 text-sm text-foreground sm:w-80">
          <span className="truncate">{partnerLabel}</span>
          <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-xs text-muted-foreground">Rows will be created for this partner only</p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted px-4 py-3">
        <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-sm font-medium text-foreground" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)} · Checking file</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3">
        <p className="text-sm font-medium text-foreground">Validating rows...</p>
        <div role="progressbar" aria-label="Validating rows" className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
        </div>
        <p className="text-xs text-muted-foreground">Checking all rows · No bookings have been created</p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" disabled className="min-h-11 min-w-[94px] bg-surface dark:bg-surface">
          Cancel
        </Button>
        <Button type="button" disabled className="min-h-11 min-w-[130px]">
          Validate file
        </Button>
      </div>
    </section>
  );
}
