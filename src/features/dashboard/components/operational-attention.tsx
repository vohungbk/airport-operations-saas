import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** The queues of the design. How each one is counted and what comes next in it is another ticket. */
const QUEUES = [
  "Today's arrivals",
  "Upcoming bookings",
  "Seats requiring allocation",
  "Installations due",
  "Cleaning queue",
  "Inspection queue",
  "Damaged or quarantined",
  "Technician assignments",
  "Overdue tasks",
] as const;

/**
 * The table of the design (UI-F06-S04): the queue, its next item and its status. The queues are laid out
 * and named; the next item and the status are a dash until they are built (another ticket).
 */
export function OperationalAttention() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Operational attention
        </h3>
        <div className="min-w-0 sm:overflow-hidden sm:rounded-lg sm:border sm:bg-card">
          <Table stacked>
            <TableHeader className="sm:bg-muted [&_th]:h-13 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase">
              <TableRow>
                <TableHead>Queue</TableHead>
                <TableHead>Next item</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="sm:[&_tr]:border-0">
              {QUEUES.map((queue) => (
                <TableRow key={queue} className="sm:h-13">
                  <TableCell data-label="Queue">{queue}</TableCell>
                  <TableCell data-label="Next item">—</TableCell>
                  <TableCell data-label="Status">—</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
