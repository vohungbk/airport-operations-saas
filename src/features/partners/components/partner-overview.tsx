import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OverviewTile } from "@/features/dashboard/components/overview-tile";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import { formatBookingDateTime } from "@/features/bookings/lib/booking-time";
import type { UpcomingPartnerRental } from "@/features/partners/lib/get-upcoming-partner-rentals";

interface PartnerOverviewProps {
  /** `null` when the bookings could not be read. */
  upcoming: readonly UpcomingPartnerRental[] | null;
}

/** The tiles of the design, in its order. Their formulas are another ticket, so each has a dash. */
const TILES = [
  "Rentals today",
  "Active rentals",
  "Upcoming reservations",
  "Family Ready vehicles",
  "Correct-seat fulfilment",
  "On-time readiness",
  "Operational incidents",
  "Completed rentals",
] as const;

const REVENUE_ROWS = [
  "Gross child-seat revenue",
  "Partner revenue share",
  "Amount payable",
  "Open invoices",
  "Outstanding invoice value",
] as const;

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-base font-semibold tracking-tight text-foreground">
      {children}
    </h3>
  );
}

function statusLabel(status: string): string {
  return (
    BOOKING_STATUS_LABEL[status as keyof typeof BOOKING_STATUS_LABEL] ?? status
  );
}

/**
 * The Partner Overview as the design draws it (UI-F06-S04): eight tiles, Revenue and invoices, Launch
 * credit and the upcoming rentals. Only the upcoming rentals are read today; the tiles, the revenue rows and
 * the launch credit are laid out with a dash until their formulas are built (another ticket).
 */
export function PartnerOverview({ upcoming }: PartnerOverviewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((label) => (
          <OverviewTile key={label} label={label} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <SectionTitle>Revenue and invoices</SectionTitle>
            <dl className="flex flex-col gap-3 text-sm">
              {REVENUE_ROWS.map((row) => (
                <div key={row} className="flex min-w-0 gap-3">
                  <dt className="min-w-0 flex-1 text-muted-foreground">
                    {row}
                  </dt>
                  <dd className="min-w-0 flex-1 text-right text-foreground">
                    —
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted-foreground">
              View invoices and booking-level statements in Finance.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <SectionTitle>Launch credit</SectionTitle>
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              —
            </p>
            <div
              aria-hidden="true"
              className="h-2.5 w-full rounded-lg bg-muted"
            />
            <div className="flex min-w-0 gap-3 text-sm">
              <span className="min-w-0 flex-1 text-muted-foreground">
                Progress to target
              </span>
              <span className="min-w-0 flex-1 text-right text-foreground">
                —
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <SectionTitle>Upcoming partner rentals</SectionTitle>
          {upcoming === null ? (
            <p className="text-sm text-muted-foreground">
              The upcoming rentals could not be read.
            </p>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming rentals.
            </p>
          ) : (
            <div className="min-w-0 sm:overflow-hidden sm:rounded-lg sm:border sm:bg-card">
              <Table stacked>
                <TableHeader className="sm:bg-muted [&_th]:h-13 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase">
                  <TableRow>
                    <TableHead>Booking</TableHead>
                    <TableHead>Pickup</TableHead>
                    <TableHead>Seat</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="sm:[&_tr]:border-0">
                  {upcoming.map((rental) => (
                    <TableRow key={rental.id} className="sm:h-13">
                      <TableCell
                        data-label="Booking"
                        className="font-mono text-[13px]"
                      >
                        {rental.booking_number}
                      </TableCell>
                      <TableCell data-label="Pickup">
                        {formatBookingDateTime(
                          rental.pickup_at,
                          rental.timezone,
                        )}
                      </TableCell>
                      <TableCell data-label="Seat">
                        {rental.seat_serial ?? "—"}
                      </TableCell>
                      <TableCell data-label="Status">
                        {statusLabel(rental.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
