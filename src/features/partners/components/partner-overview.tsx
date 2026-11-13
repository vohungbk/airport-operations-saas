import Link from "next/link";

import { Badge } from "@/components/ui/badge";
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
import { PARTNER_FINANCE_HREF } from "@/features/partners/lib/partner-home-items";
import type { PartnerOverviewView } from "@/features/partners/lib/partner-overview";

interface PartnerOverviewProps {
  /** The figures, ready from `buildPartnerOverview`; nothing is calculated here. */
  view: PartnerOverviewView;
  /** `null` when the bookings could not be read. */
  upcoming: readonly UpcomingPartnerRental[] | null;
}

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
 * The Partner Overview as the design draws it (UI-F06-S04, VI-F11-S10): eight tiles, Revenue and invoices,
 * Launch credit and the upcoming rentals. The figures come ready in `view`; a figure with no source shows a
 * dash. Selecting a figure opens its related screen (NAV-2).
 */
export function PartnerOverview({ view, upcoming }: PartnerOverviewProps) {
  const { launch_credit: launch } = view;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {view.tiles.map((tile) => (
          <OverviewTile
            key={tile.label}
            label={tile.label}
            value={tile.value}
            caption={tile.caption}
            href={tile.href}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <SectionTitle>Revenue and invoices</SectionTitle>
            <dl className="flex flex-col gap-3 text-sm">
              {view.revenue.map((row) => (
                <div key={row.label} className="flex min-w-0 gap-3">
                  <dt className="min-w-0 flex-1 text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="min-w-0 flex-1 text-right text-foreground">
                    <Link
                      href={PARTNER_FINANCE_HREF}
                      aria-label={`${row.label}: ${row.value}`}
                      className="hover:underline"
                    >
                      {row.value}
                    </Link>
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
            {launch && <Badge variant="info">{launch.share}</Badge>}
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {launch ? launch.amount : "—"}
            </p>
            <div
              aria-hidden="true"
              className="h-2.5 w-full overflow-hidden rounded-lg bg-muted"
            >
              {launch && (
                <div
                  className="h-full rounded-lg bg-primary"
                  style={{ width: `${launch.percent}%` }}
                />
              )}
            </div>
            <div className="flex min-w-0 gap-3 text-sm">
              <span className="min-w-0 flex-1 text-muted-foreground">
                Progress to target
              </span>
              <span className="min-w-0 flex-1 text-right text-foreground">
                {launch ? launch.progress : "—"}
              </span>
            </div>
            {launch?.note && (
              <p className="text-sm text-muted-foreground">{launch.note}</p>
            )}
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
