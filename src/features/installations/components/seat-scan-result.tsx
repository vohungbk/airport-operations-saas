import Link from "next/link";
import { CircleAlert, ScanLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScanBanner } from "@/features/installations/components/scan-banner";
import {
  cleaningOutcome,
  formatCheck,
  inspectionOutcome,
} from "@/features/installations/lib/seat-check-text";
import type { SeatScanView } from "@/features/installations/lib/seat-scan-result";
import {
  KeyValue,
  NONE,
  SectionCard,
} from "@/features/jobs/components/today-parts";

interface SeatScanResultProps {
  scan: SeatScanView;
  /** The zone of the airport of the booking: the checks are written in it. */
  timeZone: string;
  /** Where "Continue to checklist" goes. */
  continueHref: string;
  /** The incident form of the job; null hides "Report mismatch". */
  reportHref: string | null;
  onScanAgain: () => void;
}

const seatLine = (serial: string | null, category: string | null) =>
  [serial ?? NONE, category].filter(Boolean).join(" · ");

/** The two screens that follow a scan (UI-F07-S02, spec E2): the seat matches, or it is not the assigned one. */
export function SeatScanResult({
  scan,
  timeZone,
  continueHref,
  reportHref,
  onScanAgain,
}: SeatScanResultProps) {
  const { assigned, scanned, checks } = scan;

  if (scan.match) {
    return (
      <>
        <ScanBanner tone="success" title="Seat matches this booking">
          {`Scanned ${scanned.serial_number} · Assigned ${assigned.serial_number} · ${[assigned.category_name, assigned.airport_code].filter(Boolean).join(" · ")}`}
        </ScanBanner>
        <SectionCard title="Verified seat">
          <KeyValue label="Seat" mono>
            {assigned.serial_number}
          </KeyValue>
          <KeyValue label="Last cleaning">
            {checks?.last_cleaning
              ? formatCheck(
                  checks.last_cleaning.at,
                  timeZone,
                  cleaningOutcome(checks.last_cleaning.passed),
                )
              : NONE}
          </KeyValue>
          <KeyValue label="Last inspection">
            {checks?.last_inspection
              ? formatCheck(
                  checks.last_inspection.at,
                  timeZone,
                  inspectionOutcome(checks.last_inspection.result),
                )
              : NONE}
          </KeyValue>
        </SectionCard>
        <Link
          href={continueHref}
          className={buttonVariants({ className: "min-h-11 px-4" })}
        >
          Continue to checklist
        </Link>
      </>
    );
  }

  return (
    <>
      <ScanBanner tone="danger" title="This is not the assigned seat">
        {`Scanned ${scanned.serial_number ?? NONE}. This booking requires ${assigned.serial_number}. Do not install this seat.`}
      </ScanBanner>
      <SectionCard title="Verification mismatch">
        <KeyValue label="Expected" mono>
          {seatLine(assigned.serial_number, assigned.category_name)}
        </KeyValue>
        <KeyValue label="Scanned" mono>
          {seatLine(scanned.serial_number, scanned.category_name)}
        </KeyValue>
        {scanned.status === "reserved" && (
          <div>
            <Badge variant="destructive">
              <CircleAlert aria-hidden="true" />
              Reserved for another booking
            </Badge>
          </div>
        )}
      </SectionCard>
      <Button
        type="button"
        onClick={onScanAgain}
        className="min-h-11 px-4"
      >
        <ScanLine aria-hidden="true" data-icon="inline-start" />
        Scan again
      </Button>
      {reportHref && (
        <Link
          href={reportHref}
          className={buttonVariants({
            variant: "outline",
            className: "min-h-11 px-4",
          })}
        >
          Report mismatch
        </Link>
      )}
    </>
  );
}
