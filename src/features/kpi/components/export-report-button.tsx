"use client";

import { Download } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useExportReport } from "@/features/kpi/hooks/use-export-report";

interface ExportReportButtonProps {
  /** The address of the report, which holds the period and the search of the screen. */
  href: string;
}

/**
 * The Export report button of the KPI and ROI dashboards (VI-F05-T03). It downloads the CSV of the period on the
 * screen. When the export fails, the message shows under the button and the button stays enabled, so the user
 * can retry.
 */
export function ExportReportButton({ href }: ExportReportButtonProps) {
  const { pending, error, exportReport } = useExportReport(href);

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" variant="outline" className="min-h-11 px-4" disabled={pending} onClick={exportReport}>
        <Download aria-hidden="true" />
        Export report
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
