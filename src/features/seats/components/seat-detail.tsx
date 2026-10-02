import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ChangeSeatStatusDialog } from "@/features/seats/components/change-seat-status-dialog";
import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";
import { SeatStatusHistory } from "@/features/seats/components/seat-status-history";
import { getAllowedManualTransitions } from "@/features/seats/lib/seat-status";
import type { SeatDetailItem } from "@/features/seats/lib/get-seats";
import type { SeatStatusHistoryResult } from "@/features/seats/lib/get-seat-status-history";

interface SeatDetailProps {
  seat: SeatDetailItem;
  history: SeatStatusHistoryResult;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function SeatDetail({ seat, history }: SeatDetailProps) {
  const isRetired = seat.status === "retired";
  const allowedTransitions = getAllowedManualTransitions(seat.status);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {seat.serial_number}
          </h1>
          <div>
            <SeatStatusBadge status={seat.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isRetired && (
            <Link
              href={`/seats/${seat.id}/edit`}
              className={buttonVariants({ variant: "outline" })}
            >
              Edit
            </Link>
          )}
          {allowedTransitions.length > 0 && (
            <ChangeSeatStatusDialog
              seatId={seat.id}
              serialNumber={seat.serial_number}
              allowedStatuses={allowedTransitions}
            />
          )}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
        <Detail label="Category">{seat.category?.name ?? "-"}</Detail>
        <Detail label="Airport">
          {seat.airport ? `${seat.airport.code} - ${seat.airport.name}` : "-"}
        </Detail>
        <Detail label="Public token">
          <span className="font-mono text-xs break-all">
            {seat.public_token}
          </span>
        </Detail>
        <Detail label="Manufacturer">{seat.manufacturer}</Detail>
        <Detail label="Model">{seat.model}</Detail>
        <Detail label="Rental cycles">
          {seat.rental_cycles} / {seat.max_rental_cycles}
        </Detail>
        <Detail label="Manufactured">{seat.manufacture_date}</Detail>
        <Detail label="Purchased">{seat.purchase_date}</Detail>
        <Detail label="Created">
          {formatDate(seat.created_at)}
        </Detail>
        <Detail label="Last cleaned">
          {formatDate(seat.last_cleaned_at)}
        </Detail>
        <Detail label="Last inspected">
          {formatDate(seat.last_inspected_at)}
        </Detail>
        {seat.status === "quarantine" && seat.quarantine_reason && (
          <Detail label="Quarantine reason">{seat.quarantine_reason}</Detail>
        )}
        {seat.retired_at && (
          <Detail label="Retired">{formatDate(seat.retired_at)}</Detail>
        )}
      </dl>

      <SeatStatusHistory
        history={history.items}
        truncated={history.truncated}
      />
    </div>
  );
}
