import { CircleAlert, Download, FileText } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { BOOKING_IMPORT_TEMPLATE_HREF } from "@/features/bookings/lib/booking-import-template";
import { IMPORT_FILE_ERRORS, type ImportFileErrorCode } from "@/features/bookings/lib/booking-import-file";
import { formatFileSize } from "@/features/bookings/lib/csv-file";

interface ImportFileErrorProps {
  file: Pick<File, "name" | "size">;
  code: ImportFileErrorCode;
}

/**
 * CO-F07-S02 (design frames File too large, Wrong CSV header, Unsupported encoding): the file that
 * was refused, why, and what to do before trying again. One layout for every refusal of the file.
 */
export function ImportFileError({ file, code }: ImportFileErrorProps) {
  const copy = IMPORT_FILE_ERRORS[code];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted px-4 py-3">
        <FileText className="size-5 shrink-0 text-danger-fg" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm font-medium text-foreground" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)} · Could not validate</p>
        </div>
        <CircleAlert className="size-4 shrink-0 text-danger-fg" aria-hidden="true" />
      </div>

      <Alert variant="destructive">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>{copy.title}</AlertTitle>
        <AlertDescription>{copy.message}</AlertDescription>
      </Alert>

      <div className="flex flex-col gap-2 rounded-lg bg-muted px-4 py-3">
        <p className="text-sm font-medium text-foreground">Before you try again</p>
        <p className="text-xs text-muted-foreground">{copy.tips}</p>
        <a
          href={BOOKING_IMPORT_TEMPLATE_HREF}
          download
          className={buttonVariants({ variant: "link", className: "min-h-11 w-fit gap-1.5 px-0" })}
        >
          <Download aria-hidden="true" />
          Download template
        </a>
      </div>
    </div>
  );
}
