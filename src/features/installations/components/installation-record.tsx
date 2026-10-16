import type { ReactNode } from "react";

import type { InstallationRecord as InstallationRecordItem } from "@/features/installations/lib/get-installation-context";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";

interface InstallationRecordProps {
  record: InstallationRecordItem;
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

/** Read-only: a recorded installation is kept as history and not edited. */
export function InstallationRecord({
  record,
  timeZone,
}: InstallationRecordProps) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Detail label="Seat">{record.seat_serial_number ?? "-"}</Detail>
      <Detail label="Installation time">
        {record.completed_at
          ? formatBookingDateTime(record.completed_at, timeZone)
          : "-"}
      </Detail>
      <Detail label="Recorded by">{record.recorded_by ?? "Staff"}</Detail>
      <Detail label="Recorded at">
        {formatBookingDateTime(record.created_at, timeZone)}
      </Detail>
      <Detail label="Installation notes">{record.notes ?? "-"}</Detail>
    </dl>
  );
}
