import type { ReactNode } from "react";

import type { InspectionRecord as InspectionRecordItem } from "@/features/inspections/lib/get-inspection-context";
import { inspectionResultLabel } from "@/features/inspections/schemas/record-inspection.schema";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";

interface InspectionRecordProps {
  record: InspectionRecordItem;
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

/** Read-only: a recorded inspection is kept as history and not edited. */
export function InspectionRecord({
  record,
  timeZone,
}: InspectionRecordProps) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Detail label="Seat">{record.seat_serial_number ?? "-"}</Detail>
      <Detail label="Inspection result">
        {inspectionResultLabel(record.result)}
      </Detail>
      <Detail label="Recorded by">{record.recorded_by ?? "Staff"}</Detail>
      <Detail label="Recorded at">
        {formatBookingDateTime(record.created_at, timeZone)}
      </Detail>
      <Detail label="Inspection notes">{record.notes ?? "-"}</Detail>
    </dl>
  );
}
