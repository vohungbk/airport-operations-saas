"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTimeZoneLabel } from "@/features/bookings/lib/booking-time";
import { formatFileSize } from "@/features/bookings/lib/csv-file";
import {
  filterImportRows,
  type ImportReport,
  type ImportRowFilter,
} from "@/features/bookings/lib/validate-import-rows";
import { cn } from "@/lib/utils";

/** The most rows the table shows at once; the counts above it are always for the whole file. */
export const IMPORT_REPORT_ROW_LIMIT = 50;

const FILTERS: Array<{ value: ImportRowFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "valid", label: "Valid" },
  { value: "error", label: "Errors" },
];

const OUTLINE_BUTTON = "min-h-11 bg-surface px-4 dark:bg-surface";

interface ImportValidationReportProps {
  file: Pick<File, "name" | "size">;
  report: ImportReport;
  onReplaceFile: () => void;
}

interface StatCardProps {
  label: string;
  value: string;
  note: string;
  tone?: "default" | "success" | "danger";
}

function StatCard({ label, value, note, tone = "default" }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold tracking-tight",
          tone === "success" && "text-success-fg",
          tone === "danger" && "text-danger-fg",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function ReportBanner({ report }: { report: ImportReport }) {
  if (report.invalid === 0) {
    return (
      <Alert variant="success">
        <CircleCheck aria-hidden="true" />
        <AlertTitle>All {report.total} rows are valid</AlertTitle>
        <AlertDescription>
          The file is ready. Confirm to create {report.valid} bookings for this partner.
        </AlertDescription>
      </Alert>
    );
  }

  const title =
    report.valid === 0
      ? "Fix the file and upload it again"
      : "Fix the file and upload again, or import valid rows only";
  const description =
    report.valid === 0
      ? "None of the rows passed validation, so no bookings can be created from this file."
      : `Confirm import will create ${report.valid} bookings. The ${report.invalid} rows with errors will be excluded.`;

  return (
    <Alert className="border-warning-fg/30 bg-warning-bg text-warning-fg *:data-[slot=alert-description]:text-warning-fg/90 *:[svg]:text-current">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

/**
 * CO-F07-S03 (design "Import bookings, Validation errors" and "All valid"): what the file holds before
 * anything is saved (R1): the counts, the report with a result for every row, and the way on. "Confirm
 * import" belongs to the story that saves the bookings, so it is shown and stays off.
 */
export function ImportValidationReport({ file, report, onReplaceFile }: ImportValidationReportProps) {
  const [filter, setFilter] = useState<ImportRowFilter>("all");
  const shown = filterImportRows(report.rows, filter, IMPORT_REPORT_ROW_LIMIT);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Source file" value={`${report.total} rows`} note="Total rows in uploaded CSV" />
        <StatCard
          label="Ready to import"
          value={`${report.valid} valid`}
          note="Passed all validation checks"
          tone={report.valid > 0 ? "success" : "default"}
        />
        <StatCard
          label="Needs attention"
          value={`${report.invalid} with errors`}
          note={report.invalid > 0 ? "Correct the file to include these rows" : "No corrections needed"}
          tone={report.invalid > 0 ? "danger" : "default"}
        />
      </div>

      <section
        aria-labelledby="import-report-title"
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground md:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h2 id="import-report-title" className="text-base font-medium text-foreground">
              Validation report
            </h2>
            <p className="text-xs text-muted-foreground">
              {report.partner_name} · All pickup times in {formatTimeZoneLabel(report.timezone)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {file.name} · {formatFileSize(file.size)}
          </p>
        </div>

        <ReportBanner report={report} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="group" aria-label="Filter rows" className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={filter === option.value ? "default" : "outline"}
                aria-pressed={filter === option.value}
                className={cn("min-h-11 min-w-16", filter !== option.value && "bg-surface dark:bg-surface")}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {shown.rows.length} of {shown.matching} rows
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Row #</TableHead>
              <TableHead>External booking number</TableHead>
              <TableHead>Pickup time</TableHead>
              <TableHead>Flight no.</TableHead>
              <TableHead>Seat category</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.rows.map((row) => (
              <TableRow key={row.row_number} data-status={row.status} className={cn(row.status === "error" && "bg-danger-bg/40")}>
                <TableCell>{row.row_number}</TableCell>
                <TableCell>{row.external_booking_number || "—"}</TableCell>
                <TableCell>{row.pickup_time || "—"}</TableCell>
                <TableCell>{row.flight_number || "—"}</TableCell>
                <TableCell>{row.seat_category || "—"}</TableCell>
                <TableCell>
                  {row.status === "valid" ? (
                    <Badge variant="success">
                      <CircleCheck aria-hidden="true" />
                      Valid
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <CircleAlert aria-hidden="true" />
                      Error
                    </Badge>
                  )}
                </TableCell>
                <TableCell className={cn(row.error && "text-danger-fg")}>{row.error ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {report.valid} bookings will be created{report.invalid > 0 ? ` · ${report.invalid} rows excluded` : ""}
          </p>
          <div className="flex items-center gap-2">
            <Link href="/bookings" className={buttonVariants({ variant: "outline", className: OUTLINE_BUTTON })}>
              Cancel
            </Link>
            <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={onReplaceFile}>
              Replace file
            </Button>
            <Button type="button" className="min-h-11 px-4" disabled>
              Confirm import
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
