import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";
import type { ScannedSeat } from "@/features/seats/lib/get-seat-by-token";
import type { SeatScanView } from "@/features/seats/lib/seat-scan-access";

interface ScannedSeatCardProps {
  seat: ScannedSeat;
  view: Pick<SeatScanView, "showQuarantineReason" | "showCleaningLink" | "backHref" | "backLabel">;
}

/**
 * CO-F04-S13: the seat a QR code names. Read only: a scan identifies the seat and performs
 * nothing. The only links lead to other pages, which check access on their own.
 */
export function ScannedSeatCard({ seat, view }: ScannedSeatCardProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {seat.serial_number}
        </h1>
        <div>
          <SeatStatusBadge status={seat.status} />
        </div>
      </div>

      <dl className="grid max-w-lg grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Category</dt>
          <dd className="mt-1 text-sm text-foreground">{seat.category?.name ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Airport</dt>
          <dd className="mt-1 text-sm text-foreground">
            {seat.airport ? `${seat.airport.code} - ${seat.airport.name}` : "-"}
          </dd>
        </div>
        {seat.status === "quarantine" && view.showQuarantineReason && seat.quarantine_reason && (
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted-foreground">Quarantine reason</dt>
            <dd className="mt-1 text-sm text-foreground">{seat.quarantine_reason}</dd>
          </div>
        )}
        {seat.retired_at && (
          <div>
            <dt className="text-sm text-muted-foreground">Retired</dt>
            <dd className="mt-1 text-sm text-foreground">
              {new Date(seat.retired_at).toLocaleDateString()}
            </dd>
          </div>
        )}
      </dl>

      <div className="flex items-center gap-2">
        {view.showCleaningLink && (
          <Link
            href={`/seats/${seat.id}/cleaning`}
            className={buttonVariants({ variant: "outline" })}
          >
            Cleaning
          </Link>
        )}
        <Link href={view.backHref} className={buttonVariants({ variant: "outline" })}>
          {view.backLabel}
        </Link>
      </div>
    </div>
  );
}
