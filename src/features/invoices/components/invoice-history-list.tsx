import { PageEmpty } from "@/components/shared/page-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildHistoryEvents,
  formatHistoryTime,
  type InvoiceHistoryRow,
} from "@/features/invoices/lib/invoice-history";

interface InvoiceHistoryListProps {
  rows: readonly InvoiceHistoryRow[];
}

/**
 * The history card of the design (VI-F09-S10, R9): one row for each creation or change of status, oldest first, with what
 * happened and the end of the invoice number, the time, the actor and the reason that was kept. It is read-only: there
 * is nothing to change or delete here. No events is said, not drawn.
 */
export function InvoiceHistoryList({ rows }: InvoiceHistoryListProps) {
  const events = buildHistoryEvents(rows);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Invoice history</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <PageEmpty message="No invoice history for this selection." />
        ) : (
          <ol className="flex flex-col">
            {events.map((event) => (
              <li
                key={event.id}
                className="grid min-w-0 gap-x-6 gap-y-1 border-l-2 border-border py-3 pl-4 sm:grid-cols-[minmax(0,1fr)_13rem_11rem]"
              >
                <p className="min-w-0 font-semibold break-words text-foreground">{event.title}</p>
                <time dateTime={event.occurred_at} className="text-sm tabular-nums text-muted-foreground">
                  {formatHistoryTime(event.occurred_at)}
                </time>
                <p className="min-w-0 text-sm break-words text-foreground">{event.actor}</p>
                {event.note && <p className="min-w-0 text-sm break-words text-muted-foreground sm:col-start-1">{event.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
