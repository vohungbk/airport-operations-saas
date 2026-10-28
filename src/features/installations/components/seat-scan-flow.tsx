"use client";

import { useState, type FormEvent } from "react";
import { Flashlight, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanBanner } from "@/features/installations/components/scan-banner";
import { SeatScanResult } from "@/features/installations/components/seat-scan-result";
import { useSeatScanner } from "@/features/installations/hooks/use-seat-scanner";
import { NONE } from "@/features/jobs/components/today-parts";

interface SeatScanFlowProps {
  jobId: string;
  bookingNumber: string;
  /** The zone of the airport of the booking. */
  timeZone: string;
  assignedSerial: string;
  /** The incident form of the job; null when the user may not report one. */
  reportHref: string | null;
}

/**
 * The scan of the seat of a job, as the three screens of the design draw it (UI-F07-S02): the scanner, the
 * seat matches, and the seat is not the assigned one. The result is only a check; the installation still
 * checks the job, the seat and the technician when it is recorded (spec R8).
 */
export function SeatScanFlow({
  jobId,
  bookingNumber,
  timeZone,
  assignedSerial,
  reportHref,
}: SeatScanFlowProps) {
  const {
    videoRef,
    camera,
    torchSupported,
    torchOn,
    toggleTorch,
    typing,
    setTyping,
    submit,
    result,
    isPending,
    scanAgain,
  } = useSeatScanner(jobId);
  const [code, setCode] = useState("");
  const scan = result?.success ? result.scan : null;

  const title = !scan
    ? "Scan seat QR"
    : scan.match
      ? "Seat verified · Match"
      : "Seat verification · Mismatch";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(code);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm break-words text-muted-foreground">
          {NONE} · {bookingNumber} · {timeZone}
        </p>
      </div>

      {scan ? (
        <SeatScanResult
          scan={scan}
          timeZone={timeZone}
          continueHref={`/jobs/${jobId}/installation`}
          reportHref={reportHref}
          onScanAgain={() => {
            setCode("");
            scanAgain();
          }}
        />
      ) : (
        <>
          {result && !result.success && (
            <ScanBanner tone="danger" title="Could not check the seat">
              {result.error?.message ?? "Try again."}
            </ScanBanner>
          )}

          <div className="relative flex min-h-115 flex-col items-center justify-center gap-6 overflow-hidden rounded-xl bg-background p-6">
            <video
              ref={videoRef}
              muted
              playsInline
              className="absolute inset-0 size-full object-cover opacity-60"
              hidden={camera !== "ready"}
            />
            <p className="relative z-10 text-xl font-semibold text-foreground">
              Align seat QR inside the frame
            </p>
            <div className="relative z-10 flex size-62.5 items-center justify-center rounded-2xl border-3 border-primary">
              <ScanLine aria-hidden="true" className="size-20 text-foreground" />
            </div>
            <p className="relative z-10 text-sm text-foreground">
              Camera preview · QR scan only opens the seat
            </p>
            {torchSupported && (
              <Button
                type="button"
                variant="outline"
                onClick={toggleTorch}
                aria-pressed={torchOn}
                className="relative z-10 min-h-11 px-4"
              >
                <Flashlight aria-hidden="true" data-icon="inline-start" />
                {torchOn ? "Torch on" : "Torch off"}
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setTyping(true)}
            className="min-h-11 px-4"
          >
            Type code instead
          </Button>

          {typing && (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              {camera === "unavailable" && (
                <p className="text-sm text-muted-foreground">
                  The camera is not available. Type the seat code.
                </p>
              )}
              <Label htmlFor="seat-code">Seat code</Label>
              <Input
                id="seat-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="font-mono"
              />
              <Button
                type="submit"
                disabled={isPending || code.trim() === ""}
                className="min-h-11 px-4"
              >
                Check seat
              </Button>
            </form>
          )}

          <p className="text-sm text-muted-foreground">
            Expected seat {assignedSerial} · Sign-in and permission required
            for actions.
          </p>
        </>
      )}
    </div>
  );
}
