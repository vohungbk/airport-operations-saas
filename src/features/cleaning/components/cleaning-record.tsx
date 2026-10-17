import type { ReactNode } from "react";

import type { CleaningRecord as CleaningRecordItem } from "@/features/cleaning/lib/get-cleaning-context";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";

interface CleaningRecordProps {
  record: CleaningRecordItem;
  timeZone: string;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** Read-only: a recorded cleaning is kept as history and not edited. */
export function CleaningRecord({ record, timeZone }: CleaningRecordProps) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Detail label="Seat">{record.seat_serial_number ?? "-"}</Detail>
      <Detail label="Cleaning time">
        {record.completed_at
          ? formatBookingDateTime(record.completed_at, timeZone)
          : "-"}
      </Detail>
      <Detail label="Recorded by">{record.recorded_by ?? "Staff"}</Detail>
      <Detail label="Recorded at">
        {formatBookingDateTime(record.created_at, timeZone)}
      </Detail>
      <Detail label="Cleaning notes">{record.notes ?? "-"}</Detail>
    </dl>
  );
}
