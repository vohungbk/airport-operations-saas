import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";
import { InspectionResultLabel } from "@/features/inspections/components/inspection-result-label";
import type { InspectionHistoryItem } from "@/features/inspections/lib/get-inspection-history";

interface InspectionHistoryProps {
  items: InspectionHistoryItem[];
  timeZone: string;
}

/** Read only: past inspections are kept and have no delete action. */
export function InspectionHistory({ items, timeZone }: InspectionHistoryProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">
          Inspection history
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-text-muted">No inspection recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Inspector</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatBookingDateTime(item.created_at, timeZone)}</TableCell>
                  <TableCell>{item.inspector ?? "Staff"}</TableCell>
                  <TableCell>
                    <InspectionResultLabel result={item.result} />
                  </TableCell>
                  <TableCell className="whitespace-normal break-words">
                    {item.notes ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
