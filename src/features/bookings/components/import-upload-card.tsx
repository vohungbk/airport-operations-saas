"use client";

import Link from "next/link";
import { CircleAlert, Download, Upload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImportPermissionDenied } from "@/features/bookings/components/import-permission-denied";
import { ImportFileError } from "@/features/bookings/components/import-file-error";
import { ImportSuccess } from "@/features/bookings/components/import-success";
import { ImportValidating } from "@/features/bookings/components/import-validating";
import { ImportValidationReport } from "@/features/bookings/components/import-validation-report";
import { useImportUpload } from "@/features/bookings/hooks/use-import-upload";
import { IMPORT_FILE_ERRORS } from "@/features/bookings/lib/booking-import-file";
import { BOOKING_IMPORT_TEMPLATE_HREF } from "@/features/bookings/lib/booking-import-template";
import { CSV_FILE_ACCEPT, formatFileSize } from "@/features/bookings/lib/csv-file";
import { cn } from "@/lib/utils";

interface ImportUploadCardProps {
  partners: Array<{ value: string; label: string }>;
}

const FILE_INPUT_ID = "import-file";
const FILE_HINT = "CSV only, max size to be confirmed";
const OUTLINE_BUTTON = "min-h-11 min-w-[94px] bg-surface dark:bg-surface";

/**
 * CO-F07-S01, S02, S03 (design "Import bookings": Empty, file errors, Validating, the report): the card
 * where a partner is chosen and a CSV is dropped on the area or picked with a click. "Validate file"
 * checks the partner and the file (V1, V2), asks the server for the encoding, the header and every row,
 * and then shows the report. "Download template" (R3) is live. The file input stays in the same place
 * of the tree for every view, so a file can be picked again from the report.
 */
export function ImportUploadCard({ partners }: ImportUploadCardProps) {
  const {
    file,
    errorCode,
    partnerId,
    partnerMissing,
    isDragging,
    isPending,
    isImporting,
    importFailure,
    submitFailure,
    forbidden,
    confirmed,
    confirm,
    report,
    reportFile,
    canValidate,
    bindArea,
    onFileChange,
    onPartnerChange,
    submit,
    clearReport,
  } = useImportUpload();

  const replaceFile = () => {
    clearReport();
    document.getElementById(FILE_INPUT_ID)?.click();
  };

  if (forbidden) return <ImportPermissionDenied />;

  return (
    <div className="group/upload flex flex-col gap-4">
      <Input
        id={FILE_INPUT_ID}
        type="file"
        accept={CSV_FILE_ACCEPT}
        aria-label="Choose a CSV file"
        className="sr-only"
        onChange={onFileChange}
      />

      {confirmed ? (
        <ImportSuccess result={confirmed} />
      ) : report && reportFile ? (
        <ImportValidationReport
          file={reportFile}
          report={report}
          onReplaceFile={replaceFile}
          onConfirm={confirm}
          importing={isImporting}
          failureCode={importFailure}
        />
      ) : isPending && file ? (
        <ImportValidating partnerLabel={partners.find((partner) => partner.value === partnerId)?.label ?? ""} file={file} />
      ) : (
        <section
          aria-labelledby="import-upload-title"
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground md:p-6"
        >
          <div className="flex flex-col gap-1">
            <h2 id="import-upload-title" className="text-base font-medium text-foreground">
              Upload a booking file
            </h2>
            <p className="text-sm text-muted-foreground">
              Choose a partner and upload their bookings using the CSV template.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="import-partner">Partner *</Label>
            <Select items={partners} value={partnerId === "" ? null : partnerId} onValueChange={onPartnerChange}>
              <SelectTrigger
                id="import-partner"
                aria-invalid={partnerMissing}
                aria-describedby="import-partner-note"
                className="h-11 w-full bg-card px-3 data-[size=default]:h-11 sm:w-80"
              >
                <SelectValue placeholder="Select a partner" />
              </SelectTrigger>
              <SelectContent>
                {partners.map((partner) => (
                  <SelectItem key={partner.value} value={partner.value}>
                    {partner.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {partnerMissing ? (
              <p id="import-partner-note" role="alert" className="text-xs text-danger-fg">
                {IMPORT_FILE_ERRORS.PARTNER_REQUIRED.title}
              </p>
            ) : (
              <p id="import-partner-note" className="text-xs text-muted-foreground">
                Rows will be created for this partner only
              </p>
            )}
          </div>

          {file && errorCode ? (
            <ImportFileError file={file} code={errorCode} />
          ) : (
            <label
              htmlFor={FILE_INPUT_ID}
              data-slot="csv-dropzone"
              data-dragging={isDragging || undefined}
              ref={bindArea}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center transition-colors group-has-[input:focus-visible]/upload:border-ring group-has-[input:focus-visible]/upload:ring-3 group-has-[input:focus-visible]/upload:ring-ring/50",
                "data-dragging:border-primary data-dragging:bg-accent",
              )}
            >
              <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Upload className="size-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-foreground">Drop a CSV file here or browse</p>
              <p className="text-xs text-muted-foreground">
                {file ? `${file.name} · ${formatFileSize(file.size)}` : FILE_HINT}
              </p>
              <a
                href={BOOKING_IMPORT_TEMPLATE_HREF}
                download
                className={buttonVariants({ variant: "link", className: "min-h-11 gap-1.5 px-2" })}
              >
                <Download aria-hidden="true" />
                Download template
              </a>
            </label>
          )}

          {submitFailure ? (
            <Alert variant="destructive" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>{IMPORT_FILE_ERRORS[submitFailure].title}</AlertTitle>
              <AlertDescription>{IMPORT_FILE_ERRORS[submitFailure].message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {errorCode ? <p className="mr-auto text-xs text-muted-foreground">{FILE_HINT}</p> : null}
            <Link href="/bookings" className={buttonVariants({ variant: "outline", className: OUTLINE_BUTTON })}>
              Cancel
            </Link>
            {errorCode ? (
              <Button type="button" className="min-h-11 min-w-[130px]" onClick={replaceFile}>
                Replace file
              </Button>
            ) : (
              <Button type="button" className="min-h-11 min-w-[130px]" disabled={!canValidate} onClick={submit}>
                Validate file
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
