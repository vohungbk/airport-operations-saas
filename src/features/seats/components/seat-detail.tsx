import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChangeSeatStatusDialog } from "@/features/seats/components/change-seat-status-dialog";
import { SeatQrCard } from "@/features/seats/components/seat-qr-card";
import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";
import { SeatStatusHistory } from "@/features/seats/components/seat-status-history";
import { getAllowedManualTransitions } from "@/features/seats/lib/seat-status";
import type { SeatDetailItem } from "@/features/seats/lib/get-seats";
import type { SeatStatusHistoryResult } from "@/features/seats/lib/get-seat-status-history";

interface SeatDetailProps {
  seat: SeatDetailItem;
  history: SeatStatusHistoryResult;
  /** The booking whose return chain holds the seat; null when the seat is not in the chain. */
  chainBookingId?: string | null;
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 text-sm leading-5">
      <dt className="min-w-0 flex-1 text-text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-right text-foreground">{children}</dd>
    </div>
  );
}

export function SeatDetail({ seat, history, chainBookingId }: SeatDetailProps) {
  const isRetired = seat.status === "retired";
  const allowedTransitions = getAllowedManualTransitions(seat.status);
  const airportLabel = seat.airport
    ? `${seat.airport.name} (${seat.airport.code})`
    : "-";

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-2 print:hidden">
        <div className="flex items-center gap-4">
          <h1 className="min-w-0 flex-1 text-3xl leading-tight font-semibold text-foreground">
            {seat.serial_number}
          </h1>
          {chainBookingId && (
            <Link
              href={`/return-queue/${chainBookingId}`}
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11 bg-surface px-4")}
            >
              Open chain step
            </Link>
          )}
          {!isRetired && (
            <Link
              href={`/seats/${seat.id}/edit`}
              className={cn(buttonVariants({ variant: "default" }), "min-h-11 min-w-[110px]")}
            >
              Edit seat
            </Link>
          )}
        </div>
        <p className="text-sm leading-5 text-text-muted">
          <Link href="/seats" className="hover:underline">
            ← Back to Seats
          </Link>
          <span aria-hidden="true">{"   ·   "}</span>
          {airportLabel}
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-stretch">
        <section
          aria-labelledby="seat-information"
          className="flex w-full min-w-0 flex-1 flex-col gap-4 rounded-xl border border-border bg-surface p-5 print:hidden"
        >
          <h2
            id="seat-information"
            className="text-base leading-snug font-semibold text-foreground"
          >
            Seat information
          </h2>
          <div>
            <SeatStatusBadge status={seat.status} />
          </div>
          <dl className="flex flex-col gap-4">
            <InfoRow label="Serial">{seat.serial_number}</InfoRow>
            <InfoRow label="Airport">{airportLabel}</InfoRow>
            <InfoRow label="Category">{seat.category?.name ?? "-"}</InfoRow>
            {seat.status === "quarantine" && seat.quarantine_reason && (
              <InfoRow label="Quarantine reason">
                {seat.quarantine_reason}
              </InfoRow>
            )}
          </dl>
          {allowedTransitions.length > 0 && (
            <div>
              <ChangeSeatStatusDialog
                seatId={seat.id}
                serialNumber={seat.serial_number}
                currentStatus={seat.status}
                airportLabel={seat.airport ? airportLabel : undefined}
                allowedStatuses={allowedTransitions}
              />
            </div>
          )}
        </section>

        <SeatQrCard
          seatId={seat.id}
          serialNumber={seat.serial_number}
          publicToken={seat.public_token}
        />
      </div>

      <div className="print:hidden">
        <SeatStatusHistory
          history={history.items}
          truncated={history.truncated}
        />
      </div>
    </div>
  );
}
