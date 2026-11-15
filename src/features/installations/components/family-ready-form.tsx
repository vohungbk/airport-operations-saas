"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScanBanner } from "@/features/installations/components/scan-banner";
import { useMarkFamilyReady } from "@/features/installations/hooks/use-mark-family-ready";
import { FAMILY_READY_CHECKS } from "@/features/installations/lib/family-ready";
import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";
import { OfflineBanner } from "@/features/jobs/components/offline-banner";
import {
  KeyValue,
  NONE,
  SectionCard,
} from "@/features/jobs/components/today-parts";

interface FamilyReadyFormProps {
  jobId: string;
  jobNumber: string;
  bookingNumber: string;
  timeZone: string;
  /** The line under the banner: who recorded the installation, and when. */
  installedLine: string;
  vehicle: string | null;
  bay: string | null;
}

/** The screen "Mark vehicle Family Ready" of the installation (ME3). */
export function FamilyReadyForm({
  jobId,
  jobNumber,
  bookingNumber,
  timeZone,
  installedLine,
  vehicle,
  bay,
}: FamilyReadyFormProps) {
  const { checked, toggle, submit, isPending, result, canSubmit } =
    useMarkFamilyReady(jobId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight break-words text-foreground">
          Mark vehicle Family Ready
        </h1>
        <p className="text-sm text-muted-foreground">
          {jobNumber} · {bookingNumber} · {timeZone}
        </p>
      </div>
      <OfflineBanner />
      <ScanBanner tone="success" title="Installation completed">
        {installedLine}
      </ScanBanner>
      {result && !result.success && result.error && (
        <JobActionErrorAlert
          error={result.error}
          onRetry={submit}
          fallbackTitle="Could not mark the vehicle Family Ready"
        />
      )}
      <SectionCard title="Mark vehicle Family Ready">
        <ul className="flex flex-col gap-2">
          {FAMILY_READY_CHECKS.map((check) => (
            <li key={check.key}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground">
                <Checkbox
                  checked={checked.includes(check.key)}
                  onCheckedChange={() => toggle(check.key)}
                />
                <span>{check.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <KeyValue label="Vehicle">{vehicle ?? NONE}</KeyValue>
        <KeyValue label="Bay">{bay ?? NONE}</KeyValue>
        <Button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="min-h-11 self-start px-4"
        >
          {isPending ? "Saving..." : "Mark vehicle Family Ready"}
        </Button>
      </SectionCard>
    </div>
  );
}
